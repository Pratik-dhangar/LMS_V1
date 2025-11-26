from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import os
import uuid
import mimetypes
import logging
from pathlib import Path

from app.db.session import get_db
from app.schemas.learning_content import (
    LearningContentCreate,
    LearningContentUpdate,
    LearningContentResponse
)
from app.models.user_model import User, HeadProfile
from app.core.deps import get_current_admin, get_current_head
from app.core.config import settings
from app.crud import learning_content_crud
from app.utils.s3_utils import S3Manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/learning-content", tags=["Learning Content"])

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
    # Fallback to local storage
    BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
    UPLOAD_DIR = BASE_DIR / "uploads" / "learning_content"
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
        '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image', '.webp': 'image',
        '.pdf': 'pdf',
        '.mp4': 'video', '.avi': 'video', '.mov': 'video', '.mkv': 'video', '.webm': 'video',
        '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio', '.m4a': 'audio',
        '.doc': 'document', '.docx': 'document', '.txt': 'document', '.ppt': 'document', '.pptx': 'document'
    }
    return content_type_map.get(file_extension, 'document')

async def save_upload_file(upload_file: UploadFile) -> dict:
    """Save uploaded file to S3 or local storage"""
    try:
        # Read file content
        file_content = await upload_file.read()
        file_size = len(file_content)
        
        # Validate file size (max 500MB for videos, 50MB for others)
        file_category = get_file_category(upload_file.filename)
        max_size = 500 * 1024 * 1024 if file_category == 'video' else 50 * 1024 * 1024
        
        if file_size > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds {max_size / (1024*1024):.0f}MB limit"
            )
        
        content_type = get_content_type(upload_file.filename)
        file_category = get_file_category(upload_file.filename)
        
        if settings.USE_S3:
            # Upload to S3
            s3_key = s3_manager.upload_file(
                file_content,
                folder="learning-content",
                filename=f"{uuid.uuid4()}{os.path.splitext(upload_file.filename)[1]}",
                content_type=content_type
            )
            
            # Generate and upload thumbnail
            thumbnail_s3_key = None
            if file_category in ['image', 'video']:
                try:
                    thumbnail_bytes = s3_manager.generate_thumbnail(file_content, file_category)
                    if thumbnail_bytes:
                        thumbnail_filename = f"{uuid.uuid4()}_thumbnail.jpg"
                        thumbnail_s3_key = s3_manager.upload_file(
                            thumbnail_bytes,
                            folder="learning-content",
                            filename=thumbnail_filename,
                            content_type="image/jpeg"
                        )
                except Exception as e:
                    logger.warning(f"Failed to generate thumbnail: {str(e)}")
            
            file_url = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
            thumbnail_url = f"s3://{settings.S3_BUCKET_NAME}/{thumbnail_s3_key}" if thumbnail_s3_key else None
            
            return {
                "file_url": file_url,
                "thumbnail_url": thumbnail_url,
                "file_size": file_size,
                "content_type": file_category,
                "original_filename": upload_file.filename,
                "s3_key": s3_key,
                "thumbnail_s3_key": thumbnail_s3_key
            }
        
        else:
            # Local storage fallback
            file_extension = os.path.splitext(upload_file.filename)[1].lower()
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            file_path = UPLOAD_DIR / unique_filename
            
            with open(file_path, "wb") as buffer:
                buffer.write(file_content)
            
            return {
                "file_url": f"/uploads/learning_content/{unique_filename}",
                "file_size": file_size,
                "content_type": file_category,
                "original_filename": upload_file.filename
            }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving upload file: {str(e)}")
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
            filename = file_url.split('/')[-1]
            file_path = UPLOAD_DIR / filename
            if file_path.exists():
                os.remove(file_path)
                return True
            return False
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        return False

def get_presigned_url(file_url: str) -> str:
    """Convert S3 URL to presigned HTTPS URL or return local path"""
    try:
        if settings.USE_S3 and file_url.startswith("s3://"):
            # Extract S3 key and generate presigned URL
            s3_key = file_url.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
            presigned_url = s3_manager.get_presigned_url(s3_key, expiration=3600)
            return presigned_url
        else:
            # Return local path as-is (backend serves it)
            return file_url
    except Exception as e:
        logger.error(f"Error generating presigned URL: {str(e)}")
        return file_url  # Fallback to original URL

def convert_response_urls(response: LearningContentResponse) -> LearningContentResponse:
    """Convert S3 URLs in response to presigned HTTPS URLs"""
    response.file_url = get_presigned_url(response.file_url)
    if response.thumbnail_url:
        response.thumbnail_url = get_presigned_url(response.thumbnail_url)
    return response

# ============ SERVE STATIC FILES ============#

@router.get("/files/{filename}")
async def serve_file(filename: str):
    """Serve uploaded file"""
    file_path = UPLOAD_DIR / filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(file_path)

# ============ ADMIN ENDPOINTS ============#

@router.post("/upload", status_code=status.HTTP_200_OK)
async def upload_file(
    file: UploadFile = File(...),
    current_admin: User = Depends(get_current_admin)
):
    """Upload a file and get file info (Admin only)"""
    try:
        # Validate file size (max 100MB)
        max_size = 100 * 1024 * 1024  # 100MB
        file.file.seek(0, 2)  # Move to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset to start

        if file_size > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size exceeds 100MB limit"
            )

        file_info = await save_upload_file(file)
        
        # Convert S3 URLs to presigned HTTPS URLs for browser access
        file_url = get_presigned_url(file_info["file_url"])
        thumbnail_url = get_presigned_url(file_info.get("thumbnail_url")) if file_info.get("thumbnail_url") else None
        
        return {
            "message": "File uploaded successfully",
            "file_url": file_url,
            "thumbnail_url": thumbnail_url,
            "file_size": file_info["file_size"],
            "content_type": file_info["content_type"],
            "original_filename": file_info["original_filename"]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"File upload failed: {str(e)}"
        )

@router.post("/admin", response_model=LearningContentResponse, status_code=status.HTTP_201_CREATED)
async def create_learning_content(
    content_data: LearningContentCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Admin creates new learning content"""
    new_content = await learning_content_crud.create_learning_content(
        db, content_data, current_admin.id
    )
    response = LearningContentResponse.from_orm_with_users(new_content)
    return convert_response_urls(response)

@router.get("/admin", response_model=List[LearningContentResponse])
async def get_all_contents_admin(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Admin gets all learning contents"""
    contents = await learning_content_crud.get_all_learning_contents(db)
    responses = [LearningContentResponse.from_orm_with_users(c) for c in contents]
    return [convert_response_urls(r) for r in responses]

@router.get("/admin/{content_id}", response_model=LearningContentResponse)
async def get_content_by_id_admin(
    content_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Admin gets specific learning content"""
    content = await learning_content_crud.get_learning_content_by_id(db, content_id)

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    response = LearningContentResponse.from_orm_with_users(content)
    return convert_response_urls(response)

@router.patch("/admin/{content_id}", response_model=LearningContentResponse)
async def update_content_admin(
    content_id: int,
    content_data: LearningContentUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Admin updates learning content"""
    updated_content = await learning_content_crud.update_learning_content(
        db, content_id, content_data, current_admin.id
    )

    if not updated_content:
        raise HTTPException(status_code=404, detail="Content not found")

    response = LearningContentResponse.from_orm_with_users(updated_content)
    return convert_response_urls(response)

@router.delete("/admin/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content_admin(
    content_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
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

    return None

# ============ HEAD ENDPOINTS ============#

@router.get("/head", response_model=List[LearningContentResponse])
async def get_all_contents_head(
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head)
):
    """Head gets all learning contents (read-only list)"""
    contents = await learning_content_crud.get_all_learning_contents(db)
    responses = [LearningContentResponse.from_orm_with_users(c) for c in contents]
    return [convert_response_urls(r) for r in responses]

@router.get("/head/{content_id}", response_model=LearningContentResponse)
async def get_content_by_id_head(
    content_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head)
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
    current_head: HeadProfile = Depends(get_current_head)
):
    """Head updates learning content (title, description only)"""
    updated_content = await learning_content_crud.update_learning_content(
        db, content_id, content_data, current_head.user_id
    )

    if not updated_content:
        raise HTTPException(status_code=404, detail="Content not found")

    response = LearningContentResponse.from_orm_with_users(updated_content)
    return convert_response_urls(response)
