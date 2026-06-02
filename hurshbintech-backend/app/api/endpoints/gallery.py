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
from app.crud.gallery_crud import GalleryCRUD
from app.models.user_model import User
from app.schemas.gallery import Gallery, GalleryCreate, GalleryUpdate, GalleryListResponse
from app.services.cache_service import cache_service
from app.utils.s3_utils import S3Manager, convert_s3_url_to_proxy

logger = logging.getLogger(__name__)
router = APIRouter()
gallery_crud = GalleryCRUD()

# Initialize S3 manager if S3 is enabled
s3_manager = None
if settings.USE_S3:
    try:
        s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
        s3_manager.create_s3_folders()
        logger.info("S3 manager initialized successfully for gallery")
    except Exception as e:
        logger.error(f"Failed to initialize S3 manager: {str(e)}")
else:
    # Local storage
    UPLOAD_DIR = "uploads/gallery"
    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    logger.info(f"Gallery photos will be stored locally in: {UPLOAD_DIR}")

ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"]
MAX_IMAGE_SIZE = 50 * 1024 * 1024  # 50MB
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


def convert_gallery_response(gallery) -> Gallery:
    """Convert S3 URLs in gallery response to public HTTPS URLs (no expiration)

    Args:
        gallery: SQLAlchemy Gallery model from database

    Returns:
        Pydantic Gallery schema with converted URLs
    """
    # Convert SQLAlchemy model to Pydantic model
    pydantic_gallery = Gallery.model_validate(gallery)

    # Modify URLs to use public HTTPS (Pydantic v2 models are mutable by default)
    if pydantic_gallery.photo_url:
        pydantic_gallery.photo_url = get_public_url(pydantic_gallery.photo_url)
    if pydantic_gallery.thumbnail_url:
        pydantic_gallery.thumbnail_url = get_public_url(pydantic_gallery.thumbnail_url)
    if pydantic_gallery.video_url:
        pydantic_gallery.video_url = get_public_url(pydantic_gallery.video_url)
    if pydantic_gallery.video_thumbnail_url:
        pydantic_gallery.video_thumbnail_url = get_public_url(pydantic_gallery.video_thumbnail_url)

    return pydantic_gallery


def validate_image_file(file: UploadFile):
    logger.info("=" * 80)
    logger.info(f"[GALLERY] Validating image file: {file.filename}")
    logger.info(f"[GALLERY] Content-Type: {file.content_type}")
    logger.info(f"[GALLERY] Allowed types: {ALLOWED_IMAGE_TYPES}")

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        logger.error(f"[GALLERY] ❌ Invalid file type: {file.content_type} not in {ALLOWED_IMAGE_TYPES}")
        logger.error("=" * 80)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}",
        )

    file_size = 0
    file.file.seek(0, 2)  # Seek to end of file
    file_size = file.file.tell()
    file.file.seek(0)  # Reset file pointer

    logger.info(f"[GALLERY] File size: {file_size} bytes ({file_size / (1024*1024):.2f}MB)")
    logger.info(f"[GALLERY] Max allowed size: {MAX_IMAGE_SIZE} bytes ({MAX_IMAGE_SIZE/(1024*1024):.2f}MB)")

    if file_size > MAX_IMAGE_SIZE:
        logger.error(f"[GALLERY] ❌ File size too large: {file_size} > {MAX_IMAGE_SIZE}")
        logger.error("=" * 80)
        raise HTTPException(
            status_code=400,
            detail=f"File size too large. Maximum size: {MAX_IMAGE_SIZE/1024/1024}MB",
        )

    logger.info(f"[GALLERY] ✅ Image file validation passed")
    logger.info("=" * 80)


def validate_video_file(file: UploadFile):
    logger.info("=" * 80)
    logger.info(f"[GALLERY] Validating video file: {file.filename}")
    logger.info(f"[GALLERY] Content-Type: {file.content_type}")
    logger.info(f"[GALLERY] Allowed types: {ALLOWED_VIDEO_TYPES}")

    if file.content_type not in ALLOWED_VIDEO_TYPES:
        logger.error(f"[GALLERY] ❌ Invalid file type: {file.content_type} not in {ALLOWED_VIDEO_TYPES}")
        logger.error("=" * 80)
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_VIDEO_TYPES)}",
        )

    file_size = 0
    file.file.seek(0, 2)  # Seek to end of file
    file_size = file.file.tell()
    file.file.seek(0)  # Reset file pointer

    logger.info(f"[GALLERY] File size: {file_size} bytes ({file_size / (1024*1024):.2f}MB)")
    logger.info(f"[GALLERY] Max allowed size: {MAX_VIDEO_SIZE} bytes ({MAX_VIDEO_SIZE/(1024*1024):.2f}MB)")

    if file_size > MAX_VIDEO_SIZE:
        logger.error(f"[GALLERY] ❌ File size too large: {file_size} > {MAX_VIDEO_SIZE}")
        logger.error("=" * 80)
        raise HTTPException(
            status_code=400,
            detail=f"File size too large. Maximum size: {MAX_VIDEO_SIZE/1024/1024}MB",
        )

    logger.info(f"[GALLERY] ✅ Video file validation passed")
    logger.info("=" * 80)


async def save_gallery_file(photo_file: UploadFile) -> dict:
    """Save gallery photo file to S3 or local storage"""
    try:
        logger.info("=" * 80)
        logger.info(f"[GALLERY_SAVE] Starting gallery photo save")
        logger.info(f"[GALLERY_SAVE] Photo file: {photo_file.filename}")
        logger.info(f"[GALLERY_SAVE] S3 Enabled: {settings.USE_S3}")
        if settings.USE_S3:
            logger.info(f"[GALLERY_SAVE] S3 Bucket: {settings.S3_BUCKET_NAME}")
            logger.info(f"[GALLERY_SAVE] S3 Region: {settings.AWS_REGION}")
            logger.info(f"[GALLERY_SAVE] S3 Endpoint: {settings.S3_ENDPOINT_URL or 'AWS S3 (default)'}")

        # Read photo file
        photo_content = await photo_file.read()
        logger.info(f"[GALLERY_SAVE] Photo file read: {len(photo_content)} bytes")

        if settings.USE_S3:
            # Upload photo to S3
            logger.info(f"[GALLERY_SAVE] Uploading photo to S3...")
            try:
                photo_s3_key = s3_manager.upload_file(
                    photo_content,
                    folder="gallery",
                    filename=f"{uuid.uuid4()}{Path(photo_file.filename).suffix}",
                    content_type=photo_file.content_type,
                )
                logger.info(f"[GALLERY_SAVE] ✅ Photo uploaded to S3: {photo_s3_key}")
            except Exception as e:
                logger.error(f"[GALLERY_SAVE] ❌ S3 photo upload failed: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Photo upload failed: {str(e)}")

            # Generate and upload thumbnail
            thumbnail_s3_key = None
            try:
                logger.info(f"[GALLERY_SAVE] Generating photo thumbnail...")
                thumbnail_bytes = s3_manager.generate_thumbnail(photo_content, "image")
                if thumbnail_bytes:
                    logger.info(f"[GALLERY_SAVE] ✅ Auto-generated thumbnail: {len(thumbnail_bytes)} bytes")
                    thumbnail_s3_key = s3_manager.upload_file(
                        thumbnail_bytes,
                        folder="gallery",
                        filename=f"{uuid.uuid4()}_thumbnail.jpg",
                        content_type="image/jpeg",
                    )
                    logger.info(f"[GALLERY_SAVE] ✅ Auto thumbnail uploaded: {thumbnail_s3_key}")
                else:
                    logger.warning(f"[GALLERY_SAVE] ⚠️ Auto thumbnail generation returned None")
            except Exception as e:
                logger.warning(f"[GALLERY_SAVE] ⚠️ Failed to generate auto thumbnail: {str(e)}", exc_info=True)

            photo_url = f"s3://{settings.S3_BUCKET_NAME}/{photo_s3_key}"
            thumbnail_url = (
                f"s3://{settings.S3_BUCKET_NAME}/{thumbnail_s3_key}" if thumbnail_s3_key else None
            )

            logger.info(f"[GALLERY_SAVE] ✅ S3 gallery photo save complete")
            logger.info(f"[GALLERY_SAVE] Photo URL: {photo_url}")
            logger.info(f"[GALLERY_SAVE] Thumbnail URL: {thumbnail_url or 'N/A'}")
            logger.info("=" * 80)

            return {
                "photo_url": photo_url,
                "thumbnail_url": thumbnail_url,
                "photo_size": len(photo_content) / (1024 * 1024),  # MB
                "s3_key": photo_s3_key,
                "thumbnail_s3_key": thumbnail_s3_key,
            }

        else:
            # Local storage fallback
            logger.info("[GALLERY_SAVE] Using local storage fallback")
            photo_filename = f"{uuid.uuid4()}{Path(photo_file.filename).suffix}"
            photo_path = os.path.join(UPLOAD_DIR, photo_filename)

            try:
                with open(photo_path, "wb") as buffer:
                    buffer.write(photo_content)
                logger.info(f"[GALLERY_SAVE] ✅ Photo saved locally: {photo_path}")
            except Exception as e:
                logger.error(f"[GALLERY_SAVE] ❌ Failed to save photo locally: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Failed to save photo: {str(e)}")

            logger.info(f"[GALLERY_SAVE] ✅ Local gallery photo save complete")
            logger.info("=" * 80)

            return {
                "photo_url": f"/uploads/gallery/{photo_filename}",
                "thumbnail_url": None,
                "photo_size": len(photo_content) / (1024 * 1024),  # MB
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[GALLERY_SAVE] ❌ Unexpected error: {str(e)}", exc_info=True)
        logger.error("=" * 80)
        raise HTTPException(status_code=500, detail=f"File save error: {str(e)}")


async def save_gallery_video(video_file: UploadFile) -> dict:
    """Save gallery video file to S3 or local storage"""
    try:
        logger.info("=" * 80)
        logger.info(f"[GALLERY_SAVE] Starting gallery video save")
        logger.info(f"[GALLERY_SAVE] Video file: {video_file.filename}")
        logger.info(f"[GALLERY_SAVE] S3 Enabled: {settings.USE_S3}")
        if settings.USE_S3:
            logger.info(f"[GALLERY_SAVE] S3 Bucket: {settings.S3_BUCKET_NAME}")
            logger.info(f"[GALLERY_SAVE] S3 Region: {settings.AWS_REGION}")
            logger.info(f"[GALLERY_SAVE] S3 Endpoint: {settings.S3_ENDPOINT_URL or 'AWS S3 (default)'}")

        # Read video file
        video_content = await video_file.read()
        logger.info(f"[GALLERY_SAVE] Video file read: {len(video_content)} bytes")

        if settings.USE_S3:
            # Upload video to S3
            logger.info(f"[GALLERY_SAVE] Uploading video to S3...")
            try:
                video_s3_key = s3_manager.upload_file(
                    video_content,
                    folder="gallery",
                    filename=f"{uuid.uuid4()}{Path(video_file.filename).suffix}",
                    content_type=video_file.content_type,
                )
                logger.info(f"[GALLERY_SAVE] ✅ Video uploaded to S3: {video_s3_key}")
            except Exception as e:
                logger.error(f"[GALLERY_SAVE] ❌ S3 video upload failed: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Video upload failed: {str(e)}")

            # Generate and upload video thumbnail
            video_thumbnail_s3_key = None
            try:
                logger.info(f"[GALLERY_SAVE] Generating video thumbnail...")
                thumbnail_bytes = s3_manager.generate_thumbnail(video_content, "video")
                if thumbnail_bytes:
                    logger.info(f"[GALLERY_SAVE] ✅ Auto-generated video thumbnail: {len(thumbnail_bytes)} bytes")
                    video_thumbnail_s3_key = s3_manager.upload_file(
                        thumbnail_bytes,
                        folder="gallery",
                        filename=f"{uuid.uuid4()}_video_thumbnail.jpg",
                        content_type="image/jpeg",
                    )
                    logger.info(f"[GALLERY_SAVE] ✅ Auto video thumbnail uploaded: {video_thumbnail_s3_key}")
                else:
                    logger.warning(f"[GALLERY_SAVE] ⚠️ Auto video thumbnail generation returned None")
            except Exception as e:
                logger.warning(f"[GALLERY_SAVE] ⚠️ Failed to generate auto video thumbnail: {str(e)}", exc_info=True)

            video_url = f"s3://{settings.S3_BUCKET_NAME}/{video_s3_key}"
            video_thumbnail_url = (
                f"s3://{settings.S3_BUCKET_NAME}/{video_thumbnail_s3_key}" if video_thumbnail_s3_key else None
            )

            logger.info(f"[GALLERY_SAVE] ✅ S3 gallery video save complete")
            logger.info(f"[GALLERY_SAVE] Video URL: {video_url}")
            logger.info(f"[GALLERY_SAVE] Video Thumbnail URL: {video_thumbnail_url or 'N/A'}")
            logger.info("=" * 80)

            return {
                "video_url": video_url,
                "video_thumbnail_url": video_thumbnail_url,
                "video_size": len(video_content) / (1024 * 1024),  # MB
                "s3_key": video_s3_key,
                "video_thumbnail_s3_key": video_thumbnail_s3_key,
            }

        else:
            # Local storage fallback
            logger.info("[GALLERY_SAVE] Using local storage fallback")
            video_filename = f"{uuid.uuid4()}{Path(video_file.filename).suffix}"
            video_path = os.path.join(UPLOAD_DIR, video_filename)

            try:
                with open(video_path, "wb") as buffer:
                    buffer.write(video_content)
                logger.info(f"[GALLERY_SAVE] ✅ Video saved locally: {video_path}")
            except Exception as e:
                logger.error(f"[GALLERY_SAVE] ❌ Failed to save video locally: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Failed to save video: {str(e)}")

            logger.info(f"[GALLERY_SAVE] ✅ Local gallery video save complete")
            logger.info("=" * 80)

            return {
                "video_url": f"/uploads/gallery/{video_filename}",
                "video_thumbnail_url": None,
                "video_size": len(video_content) / (1024 * 1024),  # MB
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[GALLERY_SAVE] ❌ Unexpected error: {str(e)}", exc_info=True)
        logger.error("=" * 80)
        raise HTTPException(status_code=500, detail=f"File save error: {str(e)}")


def delete_gallery_files(photo_url: Optional[str], thumbnail_url: Optional[str], video_url: Optional[str] = None, video_thumbnail_url: Optional[str] = None):
    """Delete gallery files from S3 or local storage"""
    if settings.USE_S3:
        # S3 deletion handled by S3 manager or cleanup service
        pass
    else:
        # Local file deletion
        from pathlib import Path

        base_dir = Path(__file__).parent.parent.parent

        if photo_url:
            clean_path = photo_url.lstrip("/").replace("\\", "/")
            file_path = base_dir / clean_path
            if file_path.exists():
                file_path.unlink()

        if thumbnail_url:
            clean_path = thumbnail_url.lstrip("/").replace("\\", "/")
            thumbnail_path = base_dir / clean_path
            if thumbnail_path.exists():
                thumbnail_path.unlink()

        if video_url:
            clean_path = video_url.lstrip("/").replace("\\", "/")
            file_path = base_dir / clean_path
            if file_path.exists():
                file_path.unlink()

        if video_thumbnail_url:
            clean_path = video_thumbnail_url.lstrip("/").replace("\\", "/")
            thumbnail_path = base_dir / clean_path
            if thumbnail_path.exists():
                thumbnail_path.unlink()


# ============================================================================
# ADMIN ENDPOINTS - Authentication required
# ============================================================================

@router.post("/", response_model=Gallery, status_code=status.HTTP_201_CREATED)
async def create_gallery(
    status: str = Form("draft"),
    photo_file: UploadFile = File(None),
    video_file: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    logger.info("=" * 80)
    logger.info(f"[CREATE_GALLERY_ENDPOINT] Creating gallery item by user: {current_user.email}")
    logger.info(f"[CREATE_GALLERY_ENDPOINT] Status: {status}")

    try:
        # Validate that at least one file is provided
        if not photo_file and not video_file:
            raise HTTPException(
                status_code=400,
                detail="Either a photo or video file must be provided",
            )

        gallery_data_dict = {"status": status}

        # Handle photo file
        if photo_file and photo_file.filename:
            validate_image_file(photo_file)
            logger.info(f"[CREATE_GALLERY_ENDPOINT] Saving gallery photo files...")
            file_info = await save_gallery_file(photo_file)
            gallery_data_dict.update({
                "photo_url": file_info["photo_url"],
                "photo_size": file_info["photo_size"],
                "thumbnail_url": file_info.get("thumbnail_url"),
            })

        # Handle video file
        if video_file and video_file.filename:
            validate_video_file(video_file)
            logger.info(f"[CREATE_GALLERY_ENDPOINT] Saving gallery video files...")
            file_info = await save_gallery_video(video_file)
            gallery_data_dict.update({
                "video_url": file_info["video_url"],
                "video_size": file_info["video_size"],
                "video_thumbnail_url": file_info.get("video_thumbnail_url"),
            })

        # Create gallery entry
        logger.info(f"[CREATE_GALLERY_ENDPOINT] Creating gallery database entry...")
        gallery_data = GalleryCreate(**gallery_data_dict)
        created_gallery = await gallery_crud.create_gallery(db, gallery_data)
        logger.info(f"[CREATE_GALLERY_ENDPOINT] ✅ Gallery item created with ID: {created_gallery.id}")

        # Invalidate gallery caches
        logger.info(f"[CREATE_GALLERY_ENDPOINT] Invalidating caches...")
        await cache_service.invalidate_gallery()

        logger.info(f"[CREATE_GALLERY_ENDPOINT] ✅ Gallery creation complete")
        logger.info("=" * 80)

        return convert_gallery_response(created_gallery)
    except Exception as e:
        logger.error(f"[CREATE_GALLERY_ENDPOINT] ❌ Error creating gallery: {str(e)}", exc_info=True)
        logger.error("=" * 80)
        raise


@router.get("/", response_model=List[Gallery])
async def get_galleries(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    galleries = await gallery_crud.get_galleries(db, skip=skip, limit=limit)
    return [convert_gallery_response(g) for g in galleries]


@router.get("/{gallery_id}", response_model=Gallery)
async def get_gallery(
    gallery_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    gallery = await gallery_crud.get_gallery(db, gallery_id)
    if not gallery:
        raise HTTPException(status_code=404, detail="Gallery photo not found")
    return convert_gallery_response(gallery)


@router.put("/{gallery_id}", response_model=Gallery)
async def update_gallery(
    gallery_id: int,
    status: str = Form(None),  # "draft" or "published"
    photo_file: UploadFile = File(None),
    video_file: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    # Get existing gallery
    db_gallery = await gallery_crud.get_gallery(db, gallery_id)
    if not db_gallery:
        raise HTTPException(status_code=404, detail="Gallery item not found")

    # Prepare update data
    update_data = {}

    if status:
        update_data["status"] = status

    # Handle photo file update
    if photo_file and photo_file.filename:
        validate_image_file(photo_file)

        # Delete old photo file
        delete_gallery_files(db_gallery.photo_url, db_gallery.thumbnail_url)

        # Save new photo file
        file_info = await save_gallery_file(photo_file)
        update_data["photo_url"] = file_info["photo_url"]
        update_data["photo_size"] = file_info["photo_size"]
        update_data["thumbnail_url"] = file_info.get("thumbnail_url")

    # Handle video file update
    if video_file and video_file.filename:
        validate_video_file(video_file)

        # Delete old video file
        delete_gallery_files(None, None, db_gallery.video_url, db_gallery.video_thumbnail_url)

        # Save new video file
        file_info = await save_gallery_video(video_file)
        update_data["video_url"] = file_info["video_url"]
        update_data["video_size"] = file_info["video_size"]
        update_data["video_thumbnail_url"] = file_info.get("video_thumbnail_url")

    # Update gallery with new data
    gallery_update = GalleryUpdate(**update_data)
    updated_gallery = await gallery_crud.update_gallery(db, gallery_id, gallery_update)

    # Invalidate gallery caches (detail and lists)
    await cache_service.invalidate_gallery(gallery_id)

    return convert_gallery_response(updated_gallery)


@router.delete("/{gallery_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gallery(
    gallery_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    logger.info(f"[DELETE_GALLERY_ENDPOINT] Request to delete gallery id={gallery_id} by user={current_user.email}")

    db_gallery = await gallery_crud.get_gallery(db, gallery_id)
    if not db_gallery:
        logger.warning(f"[DELETE_GALLERY_ENDPOINT] Gallery id={gallery_id} not found")
        raise HTTPException(status_code=404, detail="Gallery item not found")

    # Delete associated files (local or S3)
    try:
        logger.info(f"[DELETE_GALLERY_ENDPOINT] Deleting files for gallery id={gallery_id}")
        delete_gallery_files(
            db_gallery.photo_url, 
            db_gallery.thumbnail_url,
            db_gallery.video_url,
            db_gallery.video_thumbnail_url
        )
    except Exception as e:
        logger.error(f"[DELETE_GALLERY_ENDPOINT] Error deleting files for gallery id={gallery_id}: {str(e)}", exc_info=True)
        # Continue to attempt DB delete even if file removal failed

    # Delete database record
    try:
        deleted = await gallery_crud.delete_gallery(db, gallery_id)
        if not deleted:
            logger.warning(f"[DELETE_GALLERY_ENDPOINT] Gallery id={gallery_id} not found during delete operation")
            raise HTTPException(status_code=404, detail="Gallery item not found")

        # Invalidate gallery caches
        try:
            await cache_service.invalidate_gallery(gallery_id)
        except Exception:
            logger.warning(f"[DELETE_GALLERY_ENDPOINT] Failed to invalidate cache for gallery id={gallery_id}")

        logger.info(f"[DELETE_GALLERY_ENDPOINT] Successfully deleted gallery id={gallery_id}")
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[DELETE_GALLERY_ENDPOINT] Unexpected error deleting gallery id={gallery_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete gallery item")


# ============================================================================
# PUBLIC ENDPOINTS - No authentication required
# ============================================================================

@router.get("/public/list", response_model=GalleryListResponse)
async def get_public_galleries(
    page: int = 1,
    per_page: int = 12,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get all published gallery photos (Public endpoint) - Cached for 15 minutes"""
    try:
        # Generate cache key from filters
        filters = {"page": page, "per_page": per_page, "search": search, "status": "published"}
        filters_str = json.dumps(filters, sort_keys=True)
        filters_hash = hashlib.md5(filters_str.encode()).hexdigest()
        cache_key = cache_service.key_gallery_list(filters_hash)

        # Try cache first
        cached_data = await cache_service.get(cache_key)
        if cached_data:
            logger.debug(f"Cache HIT: {cache_key}")
            return GalleryListResponse(**cached_data)

        logger.debug(f"Cache MISS: {cache_key}")
        skip = (page - 1) * per_page
        galleries = await gallery_crud.get_galleries(db, skip=skip, limit=per_page)

        # Filter by published status
        galleries = [g for g in galleries if g.status.value == "published"]

        # Search is currently not applied because title/description were removed.
        total = await gallery_crud.count_galleries(db, status_filter="published")
        total_pages = ceil(total / per_page) if per_page > 0 else 0

        response = GalleryListResponse(
            galleries=[convert_gallery_response(g) for g in galleries],
            total=total,
            page=page,
        )

        # Cache response for 15 minutes
        await cache_service.set(cache_key, response.model_dump(), ttl=cache_service.TTL_GALLERY_LIST)

        return response
    except Exception as e:
        logger.error(f"Error fetching public galleries: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch gallery photos")


@router.get("/public/{gallery_id}", response_model=Gallery)
async def get_public_gallery(
    gallery_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific gallery photo by ID (Public endpoint) - Cached for 30 minutes"""
    cache_key = cache_service.key_gallery_detail(gallery_id)

    # Try cache first
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        logger.debug(f"Cache HIT: {cache_key}")
        return Gallery(**cached_data)

    logger.debug(f"Cache MISS: {cache_key}")
    gallery = await gallery_crud.get_gallery(db, gallery_id)
    if not gallery:
        raise HTTPException(status_code=404, detail="Gallery photo not found")

    response = convert_gallery_response(gallery)

    # Cache response for 30 minutes
    await cache_service.set(cache_key, response.model_dump(), ttl=cache_service.TTL_GALLERY_DETAIL)

    return response
