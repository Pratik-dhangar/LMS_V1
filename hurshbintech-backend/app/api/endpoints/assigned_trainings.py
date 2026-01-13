"""
Assigned Training endpoints - Admin CRUD and user viewing
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
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
    MarkCompleteRequest,
)

router = APIRouter(prefix="/api", tags=["Assigned Trainings"])


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


@router.post("/assigned-trainings/{training_id}/mark-complete", response_model=AssignedTrainingResponse)
async def mark_training_complete(
    training_id: int,
    payload: MarkCompleteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark an assigned training as completed by the current user"""
    
    training = await assigned_training_crud.get_assigned_training(db, training_id)
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned training not found",
        )
    
    # Update user assignment status
    user_assignment = await assigned_training_user_crud.update_user_assignment_status(
        db,
        training.id,
        current_user.id,
        status="COMPLETED",
        evidence=payload.evidence,
    )
    
    if not user_assignment:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update training status",
        )
    
    training_response = AssignedTrainingResponse.from_orm(training)
    training_response.user_status = user_assignment.status
    training_response.user_progress = user_assignment.progress
    training_response.user_completed_at = user_assignment.completed_at
    
    return training_response


@router.post("/assigned-trainings/{training_id}/mark-in-progress", response_model=AssignedTrainingResponse)
async def mark_training_in_progress(
    training_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark an assigned training as in-progress by the current user"""
    
    training = await assigned_training_crud.get_assigned_training(db, training_id)
    if not training:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned training not found",
        )
    
    # Update user assignment status
    user_assignment = await assigned_training_user_crud.update_user_assignment_status(
        db,
        training.id,
        current_user.id,
        status="IN_PROGRESS",
    )
    
    if not user_assignment:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update training status",
        )
    
    training_response = AssignedTrainingResponse.from_orm(training)
    training_response.user_status = user_assignment.status
    training_response.user_started_at = user_assignment.started_at
    
    return training_response
