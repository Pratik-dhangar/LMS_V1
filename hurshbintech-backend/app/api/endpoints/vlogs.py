import hashlib
import json
import logging
import os
import uuid
from pathlib import Path
from typing import List, Optional
from math import ceil

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_admin_user, get_db
from app.crud.vlog_crud import VlogCRUD
from app.models.user_model import User
from app.schemas.vlog import Vlog, VlogCreate, VlogUpdate, VlogListResponse
from app.services.cache_service import cache_service
from app.utils.s3_utils import S3Manager, convert_s3_url_to_proxy

logger = logging.getLogger(__name__)
router = APIRouter()
vlog_crud = VlogCRUD()

# Initialize S3 manager if S3 is enabled
s3_manager = None
if settings.USE_S3:
    try:
        s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
        s3_manager.create_s3_folders()
        logger.info("S3 manager initialized successfully for vlogs")
    except Exception as e:
        logger.error(f"Failed to initialize S3 manager: {str(e)}")
else:
    # Local storage
    UPLOAD_DIR = "uploads/vlogs"
    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    logger.info(f"Vlogs will be stored locally in: {UPLOAD_DIR}")

ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg"]
MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500MB


def get_public_url(file_url: str) -> str:
    """
    Convert S3 URL to public HTTPS URL via Nginx proxy (permanent access, no expiration)

    Args:
        file_url: S3 URL (s3://bucket/key) or local path

    Returns:
        Public HTTPS URL through Nginx proxy that never expires until file is deleted
    """
    try:
        if settings.USE_S3 and file_url and file_url.startswith("s3://"):
            return convert_s3_url_to_proxy(file_url)
        else:
            return file_url
    except Exception as e:
        logger.error(f"Error generating public URL: {str(e)}")
        return file_url


def convert_vlog_response(vlog) -> Vlog:
    """Convert S3 URLs in vlog response to public HTTPS URLs (no expiration)

    Args:
        vlog: SQLAlchemy Vlog model from database

    Returns:
        Pydantic Vlog schema with converted URLs
    """
    # Convert SQLAlchemy model to Pydantic model
    pydantic_vlog = Vlog.model_validate(vlog)

    # Modify URLs to use public HTTPS (Pydantic v2 models are mutable by default)
    pydantic_vlog.file_url = get_public_url(pydantic_vlog.file_url)
    if pydantic_vlog.thumbnail_url:
        pydantic_vlog.thumbnail_url = get_public_url(pydantic_vlog.thumbnail_url)

    return pydantic_vlog


def validate_video_file(file: UploadFile):
    logger.info("=" * 80)
    logger.info(f"[VLOG] Validating video file: {file.filename}")
    logger.info(f"[VLOG] Content-Type: {file.content_type}")
    logger.info(f"[VLOG] Allowed types: {ALLOWED_VIDEO_TYPES}")
    
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        logger.error(f"[VLOG] ❌ Invalid file type: {file.content_type} not in {ALLOWED_VIDEO_TYPES}")
        logger.error("=" * 80)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_VIDEO_TYPES)}",
        )

    file_size = 0
    file.file.seek(0, 2)  # Seek to end of file
    file_size = file.file.tell()
    file.file.seek(0)  # Reset file pointer

    logger.info(f"[VLOG] File size: {file_size} bytes ({file_size / (1024*1024):.2f}MB)")
    logger.info(f"[VLOG] Max allowed size: {MAX_VIDEO_SIZE} bytes ({MAX_VIDEO_SIZE/(1024*1024):.2f}MB)")

    if file_size > MAX_VIDEO_SIZE:
        logger.error(f"[VLOG] ❌ File size too large: {file_size} > {MAX_VIDEO_SIZE}")
        logger.error("=" * 80)
        raise HTTPException(
            status_code=400,
            detail=f"File size too large. Maximum size: {MAX_VIDEO_SIZE/1024/1024}MB",
        )
    
    logger.info(f"[VLOG] ✅ Video file validation passed")
    logger.info("=" * 80)


async def save_vlog_file(video_file: UploadFile, thumbnail_file: UploadFile = None) -> dict:
    """Save vlog files to S3 or local storage"""
    try:
        logger.info("=" * 80)
        logger.info(f"[VLOG_SAVE] Starting vlog file save")
        logger.info(f"[VLOG_SAVE] Video file: {video_file.filename}")
        logger.info(f"[VLOG_SAVE] Thumbnail provided: {thumbnail_file is not None and thumbnail_file.filename is not None}")
        logger.info(f"[VLOG_SAVE] S3 Enabled: {settings.USE_S3}")
        if settings.USE_S3:
            logger.info(f"[VLOG_SAVE] S3 Bucket: {settings.S3_BUCKET_NAME}")
            logger.info(f"[VLOG_SAVE] S3 Region: {settings.AWS_REGION}")
            logger.info(f"[VLOG_SAVE] S3 Endpoint: {settings.S3_ENDPOINT_URL or 'AWS S3 (default)'}")
        
        # Read video file
        video_content = await video_file.read()
        logger.info(f"[VLOG_SAVE] Video file read: {len(video_content)} bytes")

        if settings.USE_S3:
            # Upload video to S3
            logger.info(f"[VLOG_SAVE] Uploading video to S3...")
            try:
                video_s3_key = s3_manager.upload_file(
                    video_content,
                    folder="vlogs",
                    filename=f"{uuid.uuid4()}{Path(video_file.filename).suffix}",
                    content_type=video_file.content_type,
                )
                logger.info(f"[VLOG_SAVE] ✅ Video uploaded to S3: {video_s3_key}")
            except Exception as e:
                logger.error(f"[VLOG_SAVE] ❌ S3 video upload failed: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Video upload failed: {str(e)}")

            # Generate and upload video thumbnail
            thumbnail_s3_key = None
            try:
                logger.info(f"[VLOG_SAVE] Generating video thumbnail...")
                thumbnail_bytes = s3_manager.generate_thumbnail(video_content, "video")
                if thumbnail_bytes:
                    logger.info(f"[VLOG_SAVE] ✅ Auto-generated thumbnail: {len(thumbnail_bytes)} bytes")
                    thumbnail_s3_key = s3_manager.upload_file(
                        thumbnail_bytes,
                        folder="vlogs",
                        filename=f"{uuid.uuid4()}_thumbnail.jpg",
                        content_type="image/jpeg",
                    )
                    logger.info(f"[VLOG_SAVE] ✅ Auto thumbnail uploaded: {thumbnail_s3_key}")
                else:
                    logger.warning(f"[VLOG_SAVE] ⚠️ Auto thumbnail generation returned None")
            except Exception as e:
                logger.warning(f"[VLOG_SAVE] ⚠️ Failed to generate auto thumbnail: {str(e)}", exc_info=True)

            # Handle user-provided thumbnail if present
            if thumbnail_file and thumbnail_file.filename:
                logger.info(f"[VLOG_SAVE] User-provided thumbnail: {thumbnail_file.filename}")
                if not thumbnail_file.content_type.startswith("image/"):
                    logger.error(f"[VLOG_SAVE] ❌ Invalid thumbnail type: {thumbnail_file.content_type}")
                    raise HTTPException(status_code=400, detail="Invalid thumbnail format")

                user_thumbnail_content = await thumbnail_file.read()
                logger.info(f"[VLOG_SAVE] User thumbnail size: {len(user_thumbnail_content)} bytes")
                
                try:
                    user_thumbnail_s3_key = s3_manager.upload_file(
                        user_thumbnail_content,
                        folder="vlogs",
                        filename=f"{uuid.uuid4()}_user_thumbnail.jpg",
                        content_type=thumbnail_file.content_type,
                    )
                    logger.info(f"[VLOG_SAVE] ✅ User thumbnail uploaded: {user_thumbnail_s3_key}")
                    thumbnail_s3_key = user_thumbnail_s3_key
                except Exception as e:
                    logger.error(f"[VLOG_SAVE] ❌ User thumbnail upload failed: {str(e)}", exc_info=True)
                    raise HTTPException(status_code=500, detail=f"Thumbnail upload failed: {str(e)}")

            video_url = f"s3://{settings.S3_BUCKET_NAME}/{video_s3_key}"
            thumbnail_url = (
                f"s3://{settings.S3_BUCKET_NAME}/{thumbnail_s3_key}" if thumbnail_s3_key else None
            )

            logger.info(f"[VLOG_SAVE] ✅ S3 vlog save complete")
            logger.info(f"[VLOG_SAVE] Video URL: {video_url}")
            logger.info(f"[VLOG_SAVE] Thumbnail URL: {thumbnail_url or 'N/A'}")
            logger.info("=" * 80)

            return {
                "file_url": video_url,
                "thumbnail_url": thumbnail_url,
                "file_size": len(video_content) / (1024 * 1024),  # MB
                "s3_key": video_s3_key,
                "thumbnail_s3_key": thumbnail_s3_key,
            }

        else:
            # Local storage fallback
            logger.info("[VLOG_SAVE] Using local storage fallback")
            video_filename = f"{uuid.uuid4()}{Path(video_file.filename).suffix}"
            video_path = os.path.join(UPLOAD_DIR, video_filename)

            try:
                with open(video_path, "wb") as buffer:
                    buffer.write(video_content)
                logger.info(f"[VLOG_SAVE] ✅ Video saved locally: {video_path}")
            except Exception as e:
                logger.error(f"[VLOG_SAVE] ❌ Failed to save video locally: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Failed to save video: {str(e)}")

            thumbnail_url = None
            if thumbnail_file and thumbnail_file.filename:
                logger.info(f"[VLOG_SAVE] Saving user-provided thumbnail locally: {thumbnail_file.filename}")
                if not thumbnail_file.content_type.startswith("image/"):
                    logger.error(f"[VLOG_SAVE] ❌ Invalid thumbnail type: {thumbnail_file.content_type}")
                    raise HTTPException(status_code=400, detail="Invalid thumbnail format")

                thumbnail_content = await thumbnail_file.read()
                logger.info(f"[VLOG_SAVE] Thumbnail size: {len(thumbnail_content)} bytes")
                thumbnail_filename = f"{uuid.uuid4()}{Path(thumbnail_file.filename).suffix}"
                thumbnail_path = os.path.join(UPLOAD_DIR, thumbnail_filename)

                try:
                    with open(thumbnail_path, "wb") as buffer:
                        buffer.write(thumbnail_content)
                    logger.info(f"[VLOG_SAVE] ✅ Thumbnail saved locally: {thumbnail_path}")
                    thumbnail_url = f"/uploads/vlogs/{thumbnail_filename}"
                except Exception as e:
                    logger.error(f"[VLOG_SAVE] ❌ Failed to save thumbnail: {str(e)}", exc_info=True)
                    raise HTTPException(status_code=500, detail=f"Failed to save thumbnail: {str(e)}")

            logger.info(f"[VLOG_SAVE] ✅ Local vlog save complete")
            logger.info("=" * 80)

            return {
                "file_url": f"/uploads/vlogs/{video_filename}",
                "thumbnail_url": thumbnail_url,
                "file_size": len(video_content) / (1024 * 1024),
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[VLOG_SAVE] ❌ Error saving vlog file: {str(e)}", exc_info=True)
        logger.error(f"[VLOG_SAVE] Exception type: {type(e).__name__}")
        logger.error("=" * 80)
        raise HTTPException(status_code=500, detail=f"Failed to save vlog: {str(e)}")


def delete_vlog_files(file_url: str, thumbnail_url: str = None) -> bool:
    """Delete vlog files from S3 or local storage"""
    try:
        if settings.USE_S3:
            if file_url and file_url.startswith("s3://"):
                s3_key = file_url.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
                s3_manager.delete_file(s3_key)

            if thumbnail_url and thumbnail_url.startswith("s3://"):
                thumb_s3_key = thumbnail_url.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
                s3_manager.delete_file(thumb_s3_key)

        else:
            # Local storage
            if file_url:
                filename = file_url.split("/")[-1]
                file_path = os.path.join(UPLOAD_DIR, filename)
                if os.path.exists(file_path):
                    os.remove(file_path)

            if thumbnail_url:
                filename = thumbnail_url.split("/")[-1]
                file_path = os.path.join(UPLOAD_DIR, filename)
                if os.path.exists(file_path):
                    os.remove(file_path)

        return True
    except Exception as e:
        logger.error(f"Error deleting vlog files: {str(e)}")
        return False


@router.post("/", response_model=Vlog)
async def create_vlog(
    title: str = Form(...),
    description: str = Form(None),
    status: str = Form("draft"),  # "draft" or "published"
    video_file: UploadFile = File(...),
    thumbnail_file: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    logger.info("=" * 80)
    logger.info(f"[CREATE_VLOG_ENDPOINT] Creating vlog by user: {current_user.email}")
    logger.info(f"[CREATE_VLOG_ENDPOINT] Title: {title}")
    logger.info(f"[CREATE_VLOG_ENDPOINT] Status: {status}")
    
    try:
        validate_video_file(video_file)

        # Save files
        logger.info(f"[CREATE_VLOG_ENDPOINT] Saving vlog files...")
        file_info = await save_vlog_file(video_file, thumbnail_file)

        # Create vlog entry
        logger.info(f"[CREATE_VLOG_ENDPOINT] Creating vlog database entry...")
        vlog_data = VlogCreate(
            title=title,
            description=description,
            file_url=file_info["file_url"],
            file_size=file_info["file_size"],
            thumbnail_url=file_info.get("thumbnail_url"),
            status=status,
        )

        created_vlog = await vlog_crud.create_vlog(db, vlog_data)
        logger.info(f"[CREATE_VLOG_ENDPOINT] ✅ Vlog created with ID: {created_vlog.id}")
        
        # Invalidate vlog caches
        logger.info(f"[CREATE_VLOG_ENDPOINT] Invalidating caches...")
        await cache_service.invalidate_vlogs()
        
        logger.info(f"[CREATE_VLOG_ENDPOINT] ✅ Vlog creation complete")
        logger.info("=" * 80)
        
        return convert_vlog_response(created_vlog)
    except Exception as e:
        logger.error(f"[CREATE_VLOG_ENDPOINT] ❌ Error creating vlog: {str(e)}", exc_info=True)
        logger.error("=" * 80)
        raise


@router.get("/", response_model=List[Vlog])
async def get_vlogs(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    vlogs = await vlog_crud.get_vlogs(db, skip=skip, limit=limit)
    return [convert_vlog_response(v) for v in vlogs]


# ============================================================================
# PUBLIC ENDPOINTS - No authentication required
# ============================================================================

@router.get("/public", response_model=VlogListResponse)
async def get_public_vlogs(
    page: int = 1,
    per_page: int = 10,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get all published vlogs (Public endpoint) - Cached for 15 minutes"""
    try:
        # Generate cache key from filters
        filters = {"page": page, "per_page": per_page, "search": search, "status": "published"}
        filters_str = json.dumps(filters, sort_keys=True)
        filters_hash = hashlib.md5(filters_str.encode()).hexdigest()
        cache_key = cache_service.key_vlogs_list(filters_hash)
        
        # Try cache first
        cached_data = await cache_service.get(cache_key)
        if cached_data:
            logger.debug(f"Cache HIT: {cache_key}")
            return VlogListResponse(**cached_data)
        
        logger.debug(f"Cache MISS: {cache_key}")
        skip = (page - 1) * per_page
        vlogs = await vlog_crud.get_vlogs(db, skip=skip, limit=per_page)
        
        # Filter by published status
        vlogs = [v for v in vlogs if v.status.value == "published"]
        
        # Filter vlogs by search term if provided
        if search:
            vlogs = [
                v for v in vlogs
                if search.lower() in v.title.lower() or
                   (v.description and search.lower() in v.description.lower())
            ]
        
        total = len(vlogs) if search else await vlog_crud.count_vlogs(db, status_filter="published")
        total_pages = ceil(total / per_page) if per_page > 0 else 0
        
        response = VlogListResponse(
            vlogs=[convert_vlog_response(v) for v in vlogs],
            total=total,
            page=page,
            per_page=per_page,
            total_pages=total_pages
        )
        
        # Cache response for 15 minutes
        await cache_service.set(cache_key, response.model_dump(), ttl=cache_service.TTL_VLOGS_LIST)
        
        return response
    except Exception as e:
        logger.error(f"Error fetching public vlogs: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch vlogs"
        )


@router.get("/public/{vlog_id}", response_model=Vlog)
async def get_public_vlog(
    vlog_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific vlog by ID (Public endpoint) - Cached for 30 minutes"""
    cache_key = cache_service.key_vlog_detail(vlog_id)
    
    # Try cache first
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        logger.debug(f"Cache HIT: {cache_key}")
        return Vlog(**cached_data)
    
    logger.debug(f"Cache MISS: {cache_key}")
    vlog = await vlog_crud.get_vlog(db, vlog_id)
    if not vlog:
        raise HTTPException(
            status_code=404,
            detail="Vlog not found"
        )
    
    response = convert_vlog_response(vlog)
    
    # Cache response for 30 minutes
    await cache_service.set(cache_key, response.model_dump(), ttl=cache_service.TTL_VLOG_DETAIL)
    
    return response


@router.get("/{vlog_id}", response_model=Vlog)
async def get_vlog(
    vlog_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    vlog = await vlog_crud.get_vlog(db, vlog_id)
    if not vlog:
        raise HTTPException(status_code=404, detail="Vlog not found")
    return convert_vlog_response(vlog)


@router.put("/{vlog_id}", response_model=Vlog)
async def update_vlog(
    vlog_id: int,
    title: str = Form(None),
    description: str = Form(None),
    status: str = Form(None),  # "draft" or "published"
    video_file: UploadFile = File(None),
    thumbnail_file: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    # Get existing vlog
    db_vlog = await vlog_crud.get_vlog(db, vlog_id)
    if not db_vlog:
        raise HTTPException(status_code=404, detail="Vlog not found")

    # Prepare update data
    update_data = {}

    if title:
        update_data["title"] = title

    if description:
        update_data["description"] = description

    if status:
        update_data["status"] = status

    # Handle video file update
    if video_file and video_file.filename:
        validate_video_file(video_file)

        # Delete old video file
        delete_vlog_files(db_vlog.file_url, db_vlog.thumbnail_url)

        # Save new video file
        file_info = await save_vlog_file(video_file, thumbnail_file)
        update_data["file_url"] = file_info["file_url"]
        update_data["file_size"] = file_info["file_size"]
        update_data["thumbnail_url"] = file_info.get("thumbnail_url")

    elif thumbnail_file and thumbnail_file.filename:
        # Update only thumbnail
        if not thumbnail_file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Invalid thumbnail format")

        # Delete old thumbnail if exists
        if db_vlog.thumbnail_url:
            delete_vlog_files(None, db_vlog.thumbnail_url)

        # Save new thumbnail
        if settings.USE_S3:
            thumbnail_content = await thumbnail_file.read()
            thumbnail_s3_key = s3_manager.upload_file(
                thumbnail_content,
                folder="vlogs",
                filename=f"{uuid.uuid4()}{Path(thumbnail_file.filename).suffix}",
                content_type=thumbnail_file.content_type,
            )
            update_data["thumbnail_url"] = f"s3://{settings.S3_BUCKET_NAME}/{thumbnail_s3_key}"
        else:
            thumbnail_content = await thumbnail_file.read()
            thumbnail_filename = f"{uuid.uuid4()}{Path(thumbnail_file.filename).suffix}"
            thumbnail_path = os.path.join(UPLOAD_DIR, thumbnail_filename)

            with open(thumbnail_path, "wb") as buffer:
                buffer.write(thumbnail_content)

            update_data["thumbnail_url"] = f"/uploads/vlogs/{thumbnail_filename}"

    # Update vlog with new data
    vlog_update = VlogUpdate(**update_data)
    updated_vlog = await vlog_crud.update_vlog(db, vlog_id, vlog_update)

    # Invalidate vlog caches (detail and lists)
    await cache_service.invalidate_vlog(vlog_id)

    return convert_vlog_response(updated_vlog)


@router.delete("/{vlog_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vlog(
    vlog_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    db_vlog = await vlog_crud.get_vlog(db, vlog_id)
    if not db_vlog:
        raise HTTPException(status_code=404, detail="Vlog not found")

    # Delete associated files
    delete_vlog_files(db_vlog.file_url, db_vlog.thumbnail_url)

    # Delete database record
    if not await vlog_crud.delete_vlog(db, vlog_id):
        raise HTTPException(status_code=404, detail="Vlog not found")
    
    # Invalidate vlog caches
    await cache_service.invalidate_vlog(vlog_id)
    
    return None
