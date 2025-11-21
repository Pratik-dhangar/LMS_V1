from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_db, get_current_admin_user
from app.crud.vlog_crud import VlogCRUD
from app.schemas.vlog import Vlog, VlogCreate, VlogUpdate
from app.models.user_model import User
from app.utils.file_utils import upload_file_to_s3, delete_file_from_s3

router = APIRouter()
vlog_crud = VlogCRUD()

@router.post("/", response_model=Vlog)
async def create_vlog(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    thumbnail: Optional[UploadFile] = File(None),
    video: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Create new vlog with video and optional thumbnail upload to S3"""
    
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create vlogs")
    
    try:
        # Upload video to S3
        video_result = await upload_file_to_s3(
            file=video,
            folder="vlogs/videos",
            allowed_types=['video'],
            make_public=True
        )
        
        # Upload thumbnail if provided
        thumbnail_url = None
        if thumbnail:
            thumbnail_result = await upload_file_to_s3(
                file=thumbnail,
                folder="vlogs/thumbnails",
                allowed_types=['image'],
                make_public=True
            )
            thumbnail_url = thumbnail_result["file_url"]
        
        # Create vlog in database
        vlog_data = VlogCreate(
            title=title,
            description=description,
            file_url=video_result["file_url"],
            thumbnail_url=thumbnail_url,
            file_size=0  # You might want to calculate this if needed
        )
        
        new_vlog = await vlog_crud.create_vlog(db, vlog_data)
        
        return new_vlog
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create vlog: {str(e)}")

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
        # Delete old video file from S3
        if db_vlog.file_url:
            delete_file_from_s3(db_vlog.file_url)
        
        # Upload new video file to S3
        video_result = await upload_file_to_s3(
            file=video_file,
            folder="vlogs/videos",
            allowed_types=['video'],
            make_public=True
        )
        
        update_data['file_url'] = video_result["file_url"]
        update_data['file_size'] = 0  # Update this if you calculate file size
    
    # Handle thumbnail file update
    if thumbnail_file and thumbnail_file.filename:
        # Delete old thumbnail from S3
        if db_vlog.thumbnail_url:
            delete_file_from_s3(db_vlog.thumbnail_url)
        
        # Upload new thumbnail file to S3
        thumbnail_result = await upload_file_to_s3(
            file=thumbnail_file,
            folder="vlogs/thumbnails",
            allowed_types=['image'],
            make_public=True
        )
        
        update_data['thumbnail_url'] = thumbnail_result["file_url"]
    
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
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete vlogs")
    
    # Get vlog
    vlog = await vlog_crud.get_vlog(db, vlog_id)
    if not vlog:
        raise HTTPException(status_code=404, detail="Vlog not found")
    
    # Delete video from S3
    if vlog.file_url:
        delete_success = delete_file_from_s3(vlog.file_url)
        if not delete_success:
            print(f"Warning: Failed to delete S3 video: {vlog.file_url}")
    
    # Delete thumbnail from S3
    if vlog.thumbnail_url:
        delete_success = delete_file_from_s3(vlog.thumbnail_url)
        if not delete_success:
            print(f"Warning: Failed to delete S3 thumbnail: {vlog.thumbnail_url}")
    
    # Delete from database
    await vlog_crud.delete_vlog(db, vlog_id)
    
    return {"message": "Vlog deleted successfully"}