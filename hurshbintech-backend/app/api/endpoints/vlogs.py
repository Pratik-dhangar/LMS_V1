from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db, get_current_admin_user
from app.crud.vlog_crud import VlogCRUD
from app.schemas.vlog import Vlog, VlogCreate, VlogUpdate
from app.models.user_model import User
import os
import shutil
from pathlib import Path
import uuid

router = APIRouter()
vlog_crud = VlogCRUD()

UPLOAD_DIR = "uploads/vlogs"
ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg"]
MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500MB

# Ensure upload directory exists
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

def validate_video_file(file: UploadFile):
    if file.content_type not in ALLOWED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_VIDEO_TYPES)}"
        )
    
    file_size = 0
    file.file.seek(0, 2)  # Seek to end of file
    file_size = file.file.tell()
    file.file.seek(0)  # Reset file pointer
    
    if file_size > MAX_VIDEO_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File size too large. Maximum size: {MAX_VIDEO_SIZE/1024/1024}MB"
        )

@router.post("/", response_model=Vlog)
async def create_vlog(
    title: str = Form(...),
    description: str = Form(None),
    video_file: UploadFile = File(...),
    thumbnail_file: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    validate_video_file(video_file)
    
    # Generate unique filenames
    video_filename = f"{uuid.uuid4()}{Path(video_file.filename).suffix}"
    video_path = os.path.join(UPLOAD_DIR, video_filename)
    
    # Save video file
    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(video_file.file, buffer)
    
    thumbnail_url = None
    if thumbnail_file:
        if not thumbnail_file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Invalid thumbnail format")
        
        thumbnail_filename = f"{uuid.uuid4()}{Path(thumbnail_file.filename).suffix}"
        thumbnail_path = os.path.join(UPLOAD_DIR, thumbnail_filename)
        
        with open(thumbnail_path, "wb") as buffer:
            shutil.copyfileobj(thumbnail_file.file, buffer)
        thumbnail_url = f"/uploads/vlogs/{thumbnail_filename}"

    # Create vlog entry
    vlog_data = VlogCreate(
        title=title,
        description=description,
        file_url=f"/uploads/vlogs/{video_filename}",
        file_size=os.path.getsize(video_path) / (1024 * 1024),  # Convert to MB
        thumbnail_url=thumbnail_url
    )
    
    return await vlog_crud.create_vlog(db, vlog_data)

@router.get("/", response_model=List[Vlog])
async def get_vlogs(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    vlogs = await vlog_crud.get_vlogs(db, skip=skip, limit=limit)
    return list(vlogs)

@router.get("/{vlog_id}", response_model=Vlog)
async def get_vlog(
    vlog_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    vlog = await vlog_crud.get_vlog(db, vlog_id)
    if not vlog:
        raise HTTPException(status_code=404, detail="Vlog not found")
    return vlog

@router.put("/{vlog_id}", response_model=Vlog)
async def update_vlog(
    vlog_id: int,
    title: str = Form(None),
    description: str = Form(None),
    video_file: UploadFile = File(None),
    thumbnail_file: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    # Get existing vlog
    db_vlog = await vlog_crud.get_vlog(db, vlog_id)
    if not db_vlog:
        raise HTTPException(status_code=404, detail="Vlog not found")
    
    # Prepare update data
    update_data = {}
    
    if title:
        update_data['title'] = title
    
    if description:
        update_data['description'] = description
    
    # Handle video file update
    if video_file and video_file.filename:
        validate_video_file(video_file)
        
        # Delete old video file
        if db_vlog.file_url and os.path.exists(db_vlog.file_url):
            os.remove(db_vlog.file_url)
        
        # Save new video file
        video_filename = f"{uuid.uuid4()}{Path(video_file.filename).suffix}"
        video_path = os.path.join(UPLOAD_DIR, video_filename)
        
        with open(video_path, "wb") as buffer:
            shutil.copyfileobj(video_file.file, buffer)
        
        update_data['file_url'] = f"/uploads/vlogs/{video_filename}"
        update_data['file_size'] = os.path.getsize(video_path) / (1024 * 1024)
    
    # Handle thumbnail file update
    if thumbnail_file and thumbnail_file.filename:
        if not thumbnail_file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Invalid thumbnail format")
        
        # Delete old thumbnail
        if db_vlog.thumbnail_url and os.path.exists(db_vlog.thumbnail_url):
            os.remove(db_vlog.thumbnail_url)
        
        # Save new thumbnail
        thumbnail_filename = f"{uuid.uuid4()}{Path(thumbnail_file.filename).suffix}"
        thumbnail_path = os.path.join(UPLOAD_DIR, thumbnail_filename)
        
        with open(thumbnail_path, "wb") as buffer:
            shutil.copyfileobj(thumbnail_file.file, buffer)
        
        update_data['thumbnail_url'] = f"/uploads/vlogs/{thumbnail_filename}"
    
    # Update vlog with new data
    vlog_update = VlogUpdate(**update_data)
    updated_vlog = await vlog_crud.update_vlog(db, vlog_id, vlog_update)
    
    return updated_vlog

@router.delete("/{vlog_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vlog(
    vlog_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    if not await vlog_crud.delete_vlog(db, vlog_id):
        raise HTTPException(status_code=404, detail="Vlog not found")
    return None