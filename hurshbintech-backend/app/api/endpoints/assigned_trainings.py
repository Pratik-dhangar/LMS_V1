"""
Assigned Training endpoints - Admin CRUD and user viewing
"""

from typing import List, Optional
import os
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_current_user
from app.db.session import get_db
from app.models.user_model import User
from app.crud.assigned_training_crud import assigned_training_crud, assigned_training_user_crud
from app.schemas.assigned_training import (
    AssignedTrainingCreate,
    AssignedTrainingUpdate,
    AssignedTrainingResponse,
    AssignedTrainingListResponse,
    AssignedTrainingUserResponse,
    TrainingFileInfo,
)
from app.utils.training_file_handler import training_file_handler
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Assigned Trainings"])


# ========== FILE UPLOAD ENDPOINTS ==========

@router.post("/admin/trainings/upload-featured-image")
async def upload_featured_image(
    file: UploadFile = File(...),
    current_admin: User = Depends(get_current_admin),
):
    """Upload featured image for training (Admin only)"""
    
    try:
        if not file or not file.filename:
            logger.error("No file provided in upload request")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided",
            )
        
        logger.info(f"Uploading featured image: {file.filename}")
        file_content = await file.read()
        
        if not file_content:
            logger.error("File content is empty")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File is empty",
            )
        
        # Create temporary training folder for featured image
        # We'll use timestamp-based folder for now
        from datetime import datetime
        from pathlib import Path
        from app.utils.training_file_handler import LOCAL_UPLOADS_DIR
        
        temp_folder_name = f"training_featured_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        temp_folder = str(LOCAL_UPLOADS_DIR / temp_folder_name)
        
        logger.info(f"Using temporary folder: {temp_folder}")
        
        # Upload featured image
        result = training_file_handler.upload_training_file(
            file_content=file_content,
            filename=file.filename,
            training_folder=temp_folder,
            file_type="image",
        )
        
        logger.info(f"Featured image uploaded successfully: {result['file_url']}")
        
        return {
            "success": True,
            "file_url": result["file_url"],
            "original_filename": result["original_filename"],
        }
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error(f"Error uploading featured image: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload featured image: {str(e)}",
        )


@router.post("/admin/trainings/upload-files")
async def upload_training_files(
    files: List[UploadFile] = File(...),
    current_admin: User = Depends(get_current_admin),
):
    """Upload training content files (Admin only)"""
    
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided",
        )
    
    # Create training folder for files
    from datetime import datetime
    from pathlib import Path
    from app.utils.training_file_handler import LOCAL_UPLOADS_DIR
    
    temp_folder_name = f"training_files_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    temp_folder = str(LOCAL_UPLOADS_DIR / temp_folder_name)
    
    uploaded_files = []
    errors = []
    
    for file in files:
        try:
            if not file.filename:
                errors.append({"file": "unknown", "error": "No filename"})
                continue
            
            file_content = await file.read()
            
            # Upload file
            result = training_file_handler.upload_training_file(
                file_content=file_content,
                filename=file.filename,
                training_folder=temp_folder,
            )
            
            # Create file info
            file_category = training_file_handler._get_file_category(file.filename)
            file_info = {
                "name": result["original_filename"],
                "url": result["file_url"],
                "size": len(file_content),
                "type": file_category,
            }
            
            uploaded_files.append(file_info)
            
        except ValueError as e:
            errors.append({"file": file.filename, "error": str(e)})
        except Exception as e:
            logger.error(f"Error uploading file {file.filename}: {str(e)}")
            errors.append({"file": file.filename, "error": str(e)})
    
    return {
        "success": len(uploaded_files) > 0,
        "uploaded_files": uploaded_files,
        "errors": errors,
        "temporary_folder": temp_folder,
    }




# ========== ADMIN ENDPOINTS (CRUD) ==========

@router.post("/admin/assigned-trainings", response_model=AssignedTrainingResponse, status_code=status.HTTP_201_CREATED)
async def create_assigned_training(
    payload: AssignedTrainingCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Create a new assigned training with files (Admin only)"""
    
    # Normalize target_roles to lowercase
    normalized_roles = [role.lower() for role in payload.target_roles]
    
    # Convert TrainingFileInfo objects to dictionaries for JSON storage
    training_files_list = None
    if payload.training_files:
        training_files_list = [
            file.dict() if hasattr(file, 'dict') else file
            for file in payload.training_files
        ]
    
    # Create training folder for this training
    # Note: We'll use a temporary ID approach, then update folder name with real ID after creation
    training_folder = None
    
    try:
        # First, create the training
        training = await assigned_training_crud.create_assigned_training(
            db,
            title=payload.title,
            description=payload.description,
            custom_content=payload.custom_content,
            training_ref_ids=payload.training_ref_ids,
            target_roles=normalized_roles,
            assigned_by_admin=current_admin.id,
            featured_image_url=payload.featured_image_url,
            training_files=training_files_list,
            training_folder=training_folder,
            active=payload.active,
            custom_metadata=payload.custom_metadata,
        )
        
        # Now create the actual training folder with the training ID
        if training.id:
            training_folder = training_file_handler.create_training_folder(training.id)
            
            # Update the training with the folder path
            await assigned_training_crud.update_assigned_training(
                db,
                training.id,
                training_folder=training_folder,
            )
            
            # Refresh to get updated data
            training = await assigned_training_crud.get_assigned_training(db, training.id)
        
        return AssignedTrainingResponse.from_orm(training)
        
    except Exception as e:
        logger.error(f"Error creating training: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create training: {str(e)}",
        )


@router.get("/admin/assigned-trainings", response_model=AssignedTrainingListResponse)
async def list_assigned_trainings(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    active_only: bool = Query(False),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get all assigned trainings with pagination (Admin only)"""
    
    trainings, total = await assigned_training_crud.get_assigned_trainings(
        db,
        skip=skip,
        limit=limit,
        active_only=active_only,
        search=search,
    )
    
    return AssignedTrainingListResponse(
        items=[AssignedTrainingResponse.from_orm(t) for t in trainings],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/admin/assigned-trainings/{training_id}", response_model=AssignedTrainingResponse)
async def get_assigned_training_detail(
    training_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get a single assigned training (Admin only)"""
    
    training = await assigned_training_crud.get_assigned_training(db, training_id)
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned training not found",
        )
    
    return AssignedTrainingResponse.from_orm(training)


@router.patch("/admin/assigned-trainings/{training_id}", response_model=AssignedTrainingResponse)
async def update_assigned_training(
    training_id: int,
    payload: AssignedTrainingUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Update an assigned training (Admin only)"""
    
    training = await assigned_training_crud.get_assigned_training(db, training_id)
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned training not found",
        )
    
    # Prepare update data, normalizing roles if provided
    update_data = payload.dict(exclude_unset=True)
    if "target_roles" in update_data and update_data["target_roles"]:
        update_data["target_roles"] = [role.lower() for role in update_data["target_roles"]]
    
    updated_training = await assigned_training_crud.update_assigned_training(db, training_id, **update_data)
    
    return AssignedTrainingResponse.from_orm(updated_training)


@router.delete("/admin/assigned-trainings/{training_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assigned_training(
    training_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Delete an assigned training and its files (Admin only)"""
    
    # Get training to access folder path
    training = await assigned_training_crud.get_assigned_training(db, training_id)
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned training not found",
        )
    
    # Delete training folder and files
    if training.training_folder:
        training_file_handler.delete_training_folder(training.training_folder)
    
    # Delete from database
    success = await assigned_training_crud.delete_assigned_training(db, training_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned training not found",
        )


# ========== USER ENDPOINTS (Read and Mark Complete) ==========

@router.get("/assigned-trainings/me", response_model=AssignedTrainingListResponse)
async def get_my_assigned_trainings(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get trainings assigned to the current user based on their role"""
    
    # Determine user role (ensure it's a string)
    user_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    
    trainings, total = await assigned_training_crud.get_trainings_for_user(
        db,
        user_role=user_role,
        skip=skip,
        limit=limit,
        active_only=True,
    )
    
    # Enrich trainings with user-specific progress data
    enriched_trainings = []
    for training in trainings:
        training_response = AssignedTrainingResponse.from_orm(training)
        
        # Get user's specific assignment status
        user_assignment = await assigned_training_user_crud.get_user_assignment(
            db,
            training.id,
            current_user.id,
        )
        
        if user_assignment:
            training_response.user_status = user_assignment.status
            training_response.user_progress = user_assignment.progress
            training_response.user_started_at = user_assignment.started_at
            training_response.user_completed_at = user_assignment.completed_at
        
        enriched_trainings.append(training_response)
    
    return AssignedTrainingListResponse(
        items=enriched_trainings,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/assigned-trainings/{training_id}", response_model=AssignedTrainingResponse)
async def get_assigned_training_for_user(
    training_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single assigned training with user-specific progress (if user has access)"""
    
    training = await assigned_training_crud.get_assigned_training(db, training_id)
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned training not found",
        )
    
    # Check if user has access to this training
    user_role = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    normalized_role = user_role.lower()
    
    has_access = "all" in training.target_roles or normalized_role in training.target_roles
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this training",
        )
    
    training_response = AssignedTrainingResponse.from_orm(training)
    
    # Get or create user assignment and enrich response
    user_assignment = await assigned_training_user_crud.create_or_get_user_assignment(
        db,
        training.id,
        current_user.id,
    )
    
    training_response.user_status = user_assignment.status
    training_response.user_progress = user_assignment.progress
    training_response.user_started_at = user_assignment.started_at
    training_response.user_completed_at = user_assignment.completed_at
    
    return training_response


@router.get("/admin/assigned-trainings/{training_id}/users")
async def get_assigned_training_users(
    training_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get all users assigned to a training with their progress (Admin only)"""
    
    training = await assigned_training_crud.get_assigned_training(db, training_id)
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned training not found",
        )
    
    # Get user assignments for this training
    assignments, total = await assigned_training_user_crud.get_user_assignments_for_training(
        db,
        training_id,
        skip=skip,
        limit=limit,
    )
    
    # Enrich with user details
    enriched_assignments = []
    for assignment in assignments:
        # Get user details
        user_result = await db.execute(
            select(User).filter(User.id == assignment.user_id)
        )
        user = user_result.scalar_one_or_none()
        
        if user:
            enriched_assignments.append({
                "user_id": user.id,
                "user_name": user.name,
                "user_email": user.email,
                "user_role": user.role.value if hasattr(user.role, 'value') else str(user.role),
                "status": assignment.status,
                "progress": assignment.progress,
                "started_at": assignment.started_at,
                "completed_at": assignment.completed_at,
                "created_at": assignment.created_at,
                "updated_at": assignment.updated_at,
            })
    
    return {
        "items": enriched_assignments,
        "total": total,
        "skip": skip,
        "limit": limit,
    }
