"""
Assigned Training endpoints - Admin CRUD and user viewing
"""

from typing import List, Optional
import os
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
)
from app.utils.file_handler import upload_file
from app.core.config import settings
from app.utils.s3_utils import S3Manager

router = APIRouter(prefix="/api", tags=["Assigned Trainings"])


# ========== FILE UPLOAD ENDPOINTS ==========

@router.post("/upload/training-file")
async def upload_training_file(
    file: UploadFile = File(...),
    folder: str = Form(default="trainings"),
    current_admin: User = Depends(get_current_admin),
):
    """Upload a training file (Admin only)"""
    
    # Validate file
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided",
        )
    
    # Validate file size (100MB max)
    max_size = 100 * 1024 * 1024
    file_content = await file.read()
    if len(file_content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Max size is 100MB",
        )
    
    try:
        # Upload file
        file_url = await upload_file(
            file_content=file_content,
            folder=folder,
            filename=file.filename,
            content_type=file.content_type or "application/octet-stream",
        )
        
        return {
            "success": True,
            "filename": file.filename,
            "file_url": file_url,
            "size": len(file_content),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}",
        )


# ========== ADMIN ENDPOINTS (CRUD) ==========

@router.post("/admin/assigned-trainings", response_model=AssignedTrainingResponse, status_code=status.HTTP_201_CREATED)
async def create_assigned_training(
    payload: AssignedTrainingCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Create a new assigned training (Admin only)"""
    
    # Normalize target_roles to lowercase
    normalized_roles = [role.lower() for role in payload.target_roles]
    
    training = await assigned_training_crud.create_assigned_training(
        db,
        title=payload.title,
        description=payload.description,
        custom_content=payload.custom_content,
        training_ref_ids=payload.training_ref_ids,
        target_roles=normalized_roles,
        assigned_by_admin=current_admin.id,
        active=payload.active,
        custom_metadata=payload.custom_metadata,
    )
    
    return AssignedTrainingResponse.from_orm(training)


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
    """Delete an assigned training (Admin only)"""
    
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
