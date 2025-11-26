from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import os
import uuid
import shutil
from pathlib import Path

from app.db.session import get_db
from app.schemas.learning_content import (
    LearningContentCreate,
    LearningContentUpdate,
    LearningContentResponse
)
from app.models.user_model import User, HeadProfile
from app.core.deps import get_current_admin, get_current_head, get_current_trainer
from app.crud import learning_content_crud

router = APIRouter(prefix="/learning-content", tags=["Learning Content"])

# Directory to store uploaded files (static directory in project)
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
UPLOAD_DIR = BASE_DIR / "uploads" / "learning_content"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

print(f"Learning content will be stored in: {UPLOAD_DIR}")

# ============ FILE UPLOAD HELPER ============#

async def save_upload_file(upload_file: UploadFile) -> dict:
    """Save uploaded file to static directory and return file info"""
    # Generate unique filename
    file_extension = os.path.splitext(upload_file.filename)[1].lower()
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = UPLOAD_DIR / unique_filename

    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

    # Get file size
    file_size = os.path.getsize(file_path)

    # Determine content type based on extension
    content_type_map = {
        '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image', '.webp': 'image',
        '.pdf': 'pdf',
        '.mp4': 'video', '.avi': 'video', '.mov': 'video', '.mkv': 'video', '.webm': 'video',
        '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio', '.m4a': 'audio',
        '.doc': 'document', '.docx': 'document', '.txt': 'document', '.ppt': 'document', '.pptx': 'document'
    }
    content_type = content_type_map.get(file_extension, 'document')

    return {
        "file_url": f"/uploads/learning_content/{unique_filename}",
        "file_size": file_size,
        "content_type": content_type,
        "original_filename": upload_file.filename
    }

def delete_file(file_url: str) -> bool:
    """Delete file from static directory"""
    try:
        # Extract filename from URL
        filename = file_url.split('/')[-1]
        file_path = UPLOAD_DIR / filename

        if file_path.exists():
            os.remove(file_path)
            return True
        return False
    except Exception as e:
        print(f"Error deleting file: {e}")
        return False

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
        return {
            "message": "File uploaded successfully",
            "file_url": file_info["file_url"],
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
    return LearningContentResponse.from_orm_with_users(new_content)

@router.get("/admin", response_model=List[LearningContentResponse])
async def get_all_contents_admin(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Admin gets all learning contents"""
    contents = await learning_content_crud.get_all_learning_contents(db)
    return [LearningContentResponse.from_orm_with_users(c) for c in contents]

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

    return LearningContentResponse.from_orm_with_users(content)

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

    return LearningContentResponse.from_orm_with_users(updated_content)

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
    return [LearningContentResponse.from_orm_with_users(c) for c in contents]

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

    return LearningContentResponse.from_orm_with_users(content)

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

    return LearningContentResponse.from_orm_with_users(updated_content)

# ============ TRAINER ENDPOINTS ============#

@router.post("/trainer", response_model=LearningContentResponse, status_code=status.HTTP_201_CREATED)
async def create_learning_content_trainer(
    content_data: LearningContentCreate,
    db: AsyncSession = Depends(get_db),
    current_trainer: User = Depends(get_current_trainer)
):
    """Trainer creates new learning content"""
    new_content = await learning_content_crud.create_learning_content(
        db, content_data, current_trainer.id
    )
    return LearningContentResponse.from_orm_with_users(new_content)

@router.get("/trainer", response_model=List[LearningContentResponse])
async def get_all_contents_trainer(
    db: AsyncSession = Depends(get_db),
    current_trainer: User = Depends(get_current_trainer)
):
    """Trainer gets all learning contents"""
    contents = await learning_content_crud.get_all_learning_contents(db)
    return [LearningContentResponse.from_orm_with_users(c) for c in contents]

@router.get("/trainer/{content_id}", response_model=LearningContentResponse)
async def get_content_by_id_trainer(
    content_id: int,
    db: AsyncSession = Depends(get_db),
    current_trainer: User = Depends(get_current_trainer)
):
    """Trainer gets specific learning content"""
    content = await learning_content_crud.get_learning_content_by_id(db, content_id)

    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    return LearningContentResponse.from_orm_with_users(content)

@router.patch("/trainer/{content_id}", response_model=LearningContentResponse)
async def update_content_trainer(
    content_id: int,
    content_data: LearningContentUpdate,
    db: AsyncSession = Depends(get_db),
    current_trainer: User = Depends(get_current_trainer)
):
    """Trainer updates learning content"""
    updated_content = await learning_content_crud.update_learning_content(
        db, content_id, content_data, current_trainer.id
    )

    if not updated_content:
        raise HTTPException(status_code=404, detail="Content not found")

    return LearningContentResponse.from_orm_with_users(updated_content)
