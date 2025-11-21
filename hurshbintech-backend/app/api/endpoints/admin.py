"""
Admin CRUD endpoints - Manage Heads
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.db.session import get_db
from app.schemas.user import HeadCreate, HeadUpdate, HeadResponse, TrainerResponse, LearnerResponse
from app.models.user_model import User, HeadProfile
from app.core.deps import get_current_admin
from app.crud import user_crud

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

# dashboard stats
@router.get("/dashboard/stats")
async def get_admin_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    stats = await user_crud.get_admin_dashboard_stats(db)
    return stats


# head management

@router.post("/heads", response_model=HeadResponse, status_code=status.HTTP_201_CREATED)
async def create_new_head(
    head_data: HeadCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):

    # Check if contact number already exists
    existing_head = await user_crud.get_head_by_contact(db, head_data.contact_no)
    if existing_head:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists with this contact number"
        )
    
    # Create head
    new_head = await user_crud.create_head(db, head_data, current_admin.id)
    return HeadResponse.from_orm_with_user(new_head)


# Get all heads
@router.get("/heads", response_model=List[HeadResponse])
async def get_all_heads_list(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    
    heads = await user_crud.get_all_heads(db)
    return [HeadResponse.from_orm_with_user(head) for head in heads]


# Get head details
@router.get("/heads/{head_id}", response_model=HeadResponse)
async def get_head_by_id(
    head_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    
    head = await user_crud.get_head_by_id(db, head_id)
    
    if not head:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Head not found"
        )
    
    return HeadResponse.from_orm_with_user(head)


# Update head profile
@router.patch("/heads/{head_id}", response_model=HeadResponse)
async def update_head_profile(
    head_id: int,
    head_update: HeadUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    
    head = await user_crud.get_head_by_id(db, head_id)
    
    if not head:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Head not found"
        )
    
    # If updating contact number, check for duplicates
    if head_update.contact_no and head_update.contact_no != head.contact_no:
        existing = await user_crud.get_head_by_contact(db, head_update.contact_no)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already exists with this contact number"
            )
    
    updated_head = await user_crud.update_head(db, head_id, head_update)
    return HeadResponse.from_orm_with_user(updated_head)


# Delete head account
@router.delete("/heads/{head_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_head_account(
    head_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
   
    success = await user_crud.delete_head(db, head_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Head not found"
        )


# Get all trainers (read-only for admin)
@router.get("/trainers", response_model=List[TrainerResponse])
async def get_all_trainers_list(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get all trainers - admin can view all trainers in the system"""
    trainers = await user_crud.get_all_trainers_system_wide(db)
    return [TrainerResponse.from_orm_with_user(trainer) for trainer in trainers]


# Get all learners (read-only for admin)
@router.get("/learners", response_model=List[LearnerResponse])
async def get_all_learners_list(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get all learners - admin can view all learners in the system"""
    learners = await user_crud.get_all_learners_system_wide(db)
    return [LearnerResponse.from_orm_with_user(learner) for learner in learners]
