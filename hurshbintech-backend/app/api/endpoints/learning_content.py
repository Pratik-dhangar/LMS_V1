import logging
import mimetypes
import os
import uuid
from pathlib import Path
from typing import List

from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_admin, get_current_head, get_current_trainer, get_current_coach
from app.crud import learning_content_crud
from app.db.session import get_db
from app.models.user_model import HeadProfile, User
from app.schemas.learning_content import (
    LearningContentCreate,
    LearningContentResponse,
    LearningContentUpdate,
)
from app.services.cache_service import cache_service
from app.utils.s3_utils import S3Manager, convert_s3_url_to_proxy

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/learning-content", tags=["Learning Content"])

# Define UPLOAD_DIR globally for local storage
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
UPLOAD_DIR = BASE_DIR / "uploads" / "learning_content"

# Initialize S3 manager if S3 is enabled
s3_manager = None
if settings.USE_S3:
    try:
        s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
        s3_manager.create_s3_folders()
        logger.info("S3 manager initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize S3 manager: {str(e)}")
else:
    # Ensure local upload directory exists
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    logger.info(f"Learning content will be stored locally in: {UPLOAD_DIR}")

# ============ FILE UPLOAD HELPER ============#


def get_content_type(filename: str) -> str:
    """Determine content type based on filename"""
    content_type, _ = mimetypes.guess_type(filename)
    return content_type or "application/octet-stream"


def get_file_category(filename: str) -> str:
    """Categorize file type"""
    file_extension = os.path.splitext(filename)[1].lower()
    content_type_map = {
        ".jpg": "image",
        ".jpeg": "image",
        ".png": "image",
        ".gif": "image",
        ".webp": "image",
        ".pdf": "pdf",
        ".mp4": "video",
        ".avi": "video",
        ".mov": "video",
        ".mkv": "video",
        ".webm": "video",
        ".mp3": "audio",
        ".wav": "audio",
        ".ogg": "audio",
        ".m4a": "audio",
        ".doc": "document",
        ".docx": "document",
        ".txt": "document",
        ".ppt": "document",
        ".pptx": "document",
    }
    return content_type_map.get(file_extension, "document")


async def save_upload_file(upload_file: UploadFile) -> dict:
    """Save uploaded file to S3 or local storage"""
    try:
        logger.info(f"Starting upload for file: {upload_file.filename}")
        
        # Read file content
        file_content = await upload_file.read()
        file_size = len(file_content)
        logger.info(f"File read successfully: {file_size} bytes")

        # Validate file size (max 500MB for videos, 50MB for others)
        file_category = get_file_category(upload_file.filename)
        max_size = 500 * 1024 * 1024 if file_category == "video" else 50 * 1024 * 1024

        if file_size > max_size:
            logger.error(f"File size {file_size} exceeds limit {max_size}")
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds {max_size / (1024*1024):.0f}MB limit",
            )

        content_type = get_content_type(upload_file.filename)
        file_category = get_file_category(upload_file.filename)
        logger.info(f"File category: {file_category}, content type: {content_type}")

        if settings.USE_S3:
            # Upload to S3
            logger.info(f"Uploading {file_category} file to S3...")
            s3_key = s3_manager.upload_file(
                file_content,
                folder="learning-content",
                filename=f"{uuid.uuid4()}{os.path.splitext(upload_file.filename)[1]}",
                content_type=content_type,
            )
            logger.info(f"File uploaded to S3 successfully: {s3_key}")

            # Generate and upload thumbnail
            thumbnail_s3_key = None
            if file_category in ["image", "video"]:
                try:
                    logger.info(f"Generating thumbnail for {file_category}...")
                    thumbnail_bytes = s3_manager.generate_thumbnail(file_content, file_category)
                    if thumbnail_bytes:
                        logger.info(f"Thumbnail generated ({len(thumbnail_bytes)} bytes)")
                        thumbnail_filename = f"{uuid.uuid4()}_thumbnail.jpg"
                        thumbnail_s3_key = s3_manager.upload_file(
                            thumbnail_bytes,
                            folder="learning-content",
                            filename=thumbnail_filename,
                            content_type="image/jpeg",
                        )
                        logger.info(f"Thumbnail uploaded to S3: {thumbnail_s3_key}")
                    else:
                        logger.warning(f"Thumbnail generation returned None")
                except Exception as e:
                    logger.warning(f"Failed to generate thumbnail: {str(e)}", exc_info=True)

            file_url = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
            thumbnail_url = (
                f"s3://{settings.S3_BUCKET_NAME}/{thumbnail_s3_key}" if thumbnail_s3_key else None
            )

            return {
                "file_url": file_url,
                "thumbnail_url": thumbnail_url,
                "file_size": file_size,
                "content_type": file_category,
                "original_filename": upload_file.filename,
                "s3_key": s3_key,
                "thumbnail_s3_key": thumbnail_s3_key,
            }

        else:
            # Local storage fallback
            logger.info("Using local storage fallback")
            file_extension = os.path.splitext(upload_file.filename)[1].lower()
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            file_path = UPLOAD_DIR / unique_filename

            with open(file_path, "wb") as buffer:
                buffer.write(file_content)
            
            logger.info(f"File saved locally: {file_path}")

            return {
                "file_url": f"/uploads/learning_content/{unique_filename}",
                "file_size": file_size,
                "content_type": file_category,
                "original_filename": upload_file.filename,
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving upload file: {str(e)}", exc_info=True)
        raise


def delete_file(file_url: str) -> bool:
    """Delete file from S3 or local storage"""
    try:
        if settings.USE_S3 and file_url.startswith("s3://"):
            # Extract S3 key
            s3_key = file_url.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
            return s3_manager.delete_file(s3_key)
        else:
            # Local storage
            filename = file_url.split("/")[-1]
            file_path = UPLOAD_DIR / filename
            if file_path.exists():
                os.remove(file_path)
                return True
            return False
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        return False


def get_public_url(file_url: str) -> str:
    """
    Convert S3 URL to a permanent backend proxy URL.
    """
    try:
        if settings.USE_S3 and file_url and file_url.startswith("s3://"):
            return convert_s3_url_to_proxy(file_url)
        return file_url
    except Exception as e:
        logger.error(f"Error generating proxy URL: {str(e)}")
        return file_url


def convert_response_urls(response: LearningContentResponse) -> LearningContentResponse:
    """Convert S3 URLs in response to public HTTP URLs (no expiration)"""
    response.file_url = get_public_url(response.file_url)
    if response.thumbnail_url:
        response.thumbnail_url = get_public_url(response.thumbnail_url)
    return response


# ============ SERVE STATIC FILES ============#


@router.get("/files/{filename}")
async def serve_file(filename: str):
    """Serve uploaded file"""
    file_path = UPLOAD_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path)


@router.get("/s3-files/{file_key:path}")
async def serve_s3_file_legacy(file_key: str):
    """
    Legacy alias — redirects to the generic media proxy.
    Kept for backward compatibility with any s3-files URLs already stored in the database.
    """
    return RedirectResponse(url=f"/api/media/s3/{file_key}", status_code=301)


# ============ ADMIN ENDPOINTS ============#


@router.post("/upload", status_code=status.HTTP_200_OK)
async def upload_file(
    file: UploadFile = File(...), current_admin: User = Depends(get_current_admin)
):
    """Upload a file and get file info (Admin only)"""
    try:
        # Validate file size (max 100MB)
        max_size = 100 * 1024 * 1024  # 100MB
        file.file.seek(0, 2)  # Move to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to start

        if file_size > max_size:
            logger.error(f"Upload rejected: file too large ({file_size} > {max_size})")
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size exceeds 100MB limit",
            )

        logger.info(f"Processing upload: {file.filename} ({file_size} bytes)")
        file_info = await save_upload_file(file)

        # Convert S3 URLs to public URLs (no expiration, accessible to all users)
        file_url = get_public_url(file_info["file_url"])
        thumbnail_url = (
            get_public_url(file_info.get("thumbnail_url"))
            if file_info.get("thumbnail_url")
            else None
        )

        logger.info(f"Upload completed successfully for: {file.filename}")
        return {
            "message": "File uploaded successfully",
            "file_url": file_url,
            "thumbnail_url": thumbnail_url,
            "file_size": file_info["file_size"],
            "content_type": file_info["content_type"],
            "original_filename": file_info["original_filename"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File upload failed: {str(e)}",
        )


@router.post("/admin", response_model=LearningContentResponse, status_code=status.HTTP_201_CREATED)
async def create_learning_content(
    content_data: LearningContentCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin creates new learning content"""
    new_content = await learning_content_crud.create_learning_content(
        db, content_data, current_admin.id
    )
    
    # Invalidate all learning content caches
    await cache_service.invalidate_learning_content_lists()
    
    response = LearningContentResponse.from_orm_with_users(new_content)
    return convert_response_urls(response)


@router.get("/admin", response_model=List[LearningContentResponse])
async def get_all_contents_admin(
    db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)
):
    """Admin gets all learning contents - Cached for 10 minutes"""
    cache_key = cache_service.key_learning_content_list("admin")
    
    # Try cache first
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        logger.debug(f"Cache HIT: {cache_key}")
        return [LearningContentResponse(**item) for item in cached_data]
    
    logger.debug(f"Cache MISS: {cache_key}")
    contents = await learning_content_crud.get_all_learning_contents(db)
    responses = [LearningContentResponse.from_orm_with_users(c) for c in contents]
    result = [convert_response_urls(r) for r in responses]
    
    # Cache for 10 minutes
    await cache_service.set(cache_key, [r.model_dump() for r in result], ttl=cache_service.TTL_LEARNING_CONTENT)
    
    return result


@router.get("/admin/{content_id}", response_model=LearningContentResponse)
async def get_content_by_id_admin(
    content_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin gets specific learning content - Cached for 15 minutes"""
    cache_key = cache_service.key_learning_content_detail(content_id)
    
    # Try cache first
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        logger.debug(f"Cache HIT: {cache_key}")
        return LearningContentResponse(**cached_data)
    
    logger.debug(f"Cache MISS: {cache_key}")
    content = await learning_content_crud.get_learning_content_by_id(db, content_id)

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    response = LearningContentResponse.from_orm_with_users(content)
    result = convert_response_urls(response)
    
    # Cache for 15 minutes
    await cache_service.set(cache_key, result.model_dump(), ttl=cache_service.TTL_LEARNING_CONTENT_DETAIL)
    
    return result


@router.patch("/admin/{content_id}", response_model=LearningContentResponse)
async def update_content_admin(
    content_id: int,
    content_data: LearningContentUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin updates learning content"""
    updated_content = await learning_content_crud.update_learning_content(
        db, content_id, content_data, current_admin.id
    )

    if not updated_content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Invalidate learning content caches
    await cache_service.invalidate_learning_content(content_id)

    response = LearningContentResponse.from_orm_with_users(updated_content)
    return convert_response_urls(response)


@router.delete("/admin/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content_admin(
    content_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin deletes learning content and associated file"""
    # Get content to retrieve file URL
    content = await learning_content_crud.get_learning_content_by_id(db, content_id)

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Delete file from static directory
    delete_file(content.file_url)

    # Delete database record
    success = await learning_content_crud.delete_learning_content(db, content_id)

    if not success:
        raise HTTPException(status_code=404, detail="Content not found")

    # Invalidate learning content caches
    await cache_service.invalidate_learning_content(content_id)

    return None


# ============ HEAD ENDPOINTS ============#


@router.get("/head", response_model=List[LearningContentResponse])
async def get_all_contents_head(
    db: AsyncSession = Depends(get_db), current_head: HeadProfile = Depends(get_current_head)
):
    """Head gets all learning contents (read-only list) - Cached for 10 minutes"""
    cache_key = cache_service.key_learning_content_list("head")
    
    # Try cache first
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        logger.debug(f"Cache HIT: {cache_key}")
        return [LearningContentResponse(**item) for item in cached_data]
    
    logger.debug(f"Cache MISS: {cache_key}")
    contents = await learning_content_crud.get_all_learning_contents(db)
    responses = [LearningContentResponse.from_orm_with_users(c) for c in contents]
    result = [convert_response_urls(r) for r in responses]
    
    # Cache for 10 minutes
    await cache_service.set(cache_key, [r.model_dump() for r in result], ttl=cache_service.TTL_LEARNING_CONTENT)
    
    return result


@router.get("/head/{content_id}", response_model=LearningContentResponse)
async def get_content_by_id_head(
    content_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Head gets specific learning content"""
    content = await learning_content_crud.get_learning_content_by_id(db, content_id)

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    response = LearningContentResponse.from_orm_with_users(content)
    return convert_response_urls(response)


@router.patch("/head/{content_id}", response_model=LearningContentResponse)
async def update_content_head(
    content_id: int,
    content_data: LearningContentUpdate,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Head updates learning content (title, description only)"""
    updated_content = await learning_content_crud.update_learning_content(
        db, content_id, content_data, current_head.user_id
    )

    if not updated_content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Invalidate learning content caches
    await cache_service.invalidate_learning_content(content_id)

    response = LearningContentResponse.from_orm_with_users(updated_content)
    return convert_response_urls(response)


# ============ TRAINER ENDPOINTS ============#


@router.post(
    "/trainer", response_model=LearningContentResponse, status_code=status.HTTP_201_CREATED
)
async def create_learning_content_trainer(
    content_data: LearningContentCreate,
    db: AsyncSession = Depends(get_db),
    current_trainer: User = Depends(get_current_trainer),
):
    """Trainer creates new learning content"""
    new_content = await learning_content_crud.create_learning_content(
        db, content_data, current_trainer.id
    )
    return LearningContentResponse.from_orm_with_users(new_content)


@router.get("/trainer", response_model=List[LearningContentResponse])
async def get_all_contents_trainer(
    db: AsyncSession = Depends(get_db), current_trainer: User = Depends(get_current_trainer)
):
    """Trainer gets all learning contents - Cached for 10 minutes"""
    cache_key = cache_service.key_learning_content_list("trainer")
    
    # Try cache first
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        logger.debug(f"Cache HIT: {cache_key}")
        return [LearningContentResponse(**item) for item in cached_data]
    
    logger.debug(f"Cache MISS: {cache_key}")
    contents = await learning_content_crud.get_all_learning_contents(db)
    responses = [LearningContentResponse.from_orm_with_users(c) for c in contents]
    result = [convert_response_urls(r) for r in responses]
    
    # Cache for 10 minutes
    await cache_service.set(cache_key, [r.model_dump() for r in result], ttl=cache_service.TTL_LEARNING_CONTENT)
    
    return result


@router.get("/trainer/{content_id}", response_model=LearningContentResponse)
async def get_content_by_id_trainer(
    content_id: int,
    db: AsyncSession = Depends(get_db),
    current_trainer: User = Depends(get_current_trainer),
):
    """Trainer gets specific learning content"""
    content = await learning_content_crud.get_learning_content_by_id(db, content_id)

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    response = LearningContentResponse.from_orm_with_users(content)
    return convert_response_urls(response)


@router.patch("/trainer/{content_id}", response_model=LearningContentResponse)
async def update_content_trainer(
    content_id: int,
    content_data: LearningContentUpdate,
    db: AsyncSession = Depends(get_db),
    current_trainer: User = Depends(get_current_trainer),
):
    """Trainer updates learning content"""
    updated_content = await learning_content_crud.update_learning_content(
        db, content_id, content_data, current_trainer.id
    )

    if not updated_content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Invalidate learning content caches
    await cache_service.invalidate_learning_content(content_id)

    return LearningContentResponse.from_orm_with_users(updated_content)


# ============ COACH ENDPOINTS ============#


@router.post(
    "/coach", response_model=LearningContentResponse, status_code=status.HTTP_201_CREATED
)
async def create_learning_content_coach(
    content_data: LearningContentCreate,
    db: AsyncSession = Depends(get_db),
    current_coach: User = Depends(get_current_coach),
):
    """Coach creates new learning content"""
    new_content = await learning_content_crud.create_learning_content(
        db, content_data, current_coach.id
    )
    response = LearningContentResponse.from_orm_with_users(new_content)
    return convert_response_urls(response)


@router.get("/coach", response_model=List[LearningContentResponse])
async def get_all_contents_coach(
    db: AsyncSession = Depends(get_db), current_coach: User = Depends(get_current_coach)
):
    """Coach gets all learning contents - Cached for 10 minutes"""
    cache_key = cache_service.key_learning_content_list("coach")
    
    # Try cache first
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        logger.debug(f"Cache HIT: {cache_key}")
        return [LearningContentResponse(**item) for item in cached_data]
    
    logger.debug(f"Cache MISS: {cache_key}")
    contents = await learning_content_crud.get_all_learning_contents(db)
    responses = [LearningContentResponse.from_orm_with_users(c) for c in contents]
    result = [convert_response_urls(r) for r in responses]
    
    # Cache for 10 minutes
    await cache_service.set(cache_key, [r.model_dump() for r in result], ttl=cache_service.TTL_LEARNING_CONTENT)
    
    return result


@router.get("/coach/{content_id}", response_model=LearningContentResponse)
async def get_content_by_id_coach(
    content_id: int,
    db: AsyncSession = Depends(get_db),
    current_coach: User = Depends(get_current_coach),
):
    """Coach gets specific learning content"""
    content = await learning_content_crud.get_learning_content_by_id(db, content_id)

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    response = LearningContentResponse.from_orm_with_users(content)
    return convert_response_urls(response)


@router.patch("/coach/{content_id}", response_model=LearningContentResponse)
async def update_content_coach(
    content_id: int,
    content_data: LearningContentUpdate,
    db: AsyncSession = Depends(get_db),
    current_coach: User = Depends(get_current_coach),
):
    """Coach updates learning content"""
    updated_content = await learning_content_crud.update_learning_content(
        db, content_id, content_data, current_coach.id
    )

    if not updated_content:
        raise HTTPException(status_code=404, detail="Content not found")

    # Invalidate learning content caches
    await cache_service.invalidate_learning_content(content_id)

    response = LearningContentResponse.from_orm_with_users(updated_content)
    return convert_response_urls(response)
