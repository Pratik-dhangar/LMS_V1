"""
Head CRUD endpoints - Manage Trainers and Consultants
Only accessible by heads
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.core.deps import get_current_head
from app.core.security import decrypt_passcode
from app.crud import user_crud
from app.db.session import get_db
from app.models.user_model import HeadProfile
from app.schemas.user import (
    ConsultantCreate,
    ConsultantResponse,
    ConsultantUpdate,
    LearnerCreate,
    LearnerResponse,
    LearnerUpdate,
    TrainerCreate,
    TrainerResponse,
    TrainerUpdate,
)

router = APIRouter(prefix="/head", tags=["Head Operations"])


# dashboard stats
@router.get("/dashboard/stats", response_model=dict)
async def get_head_dashboard_statistics(
    db: AsyncSession = Depends(get_db), current_head: HeadProfile = Depends(get_current_head)
):
    stats = await user_crud.get_head_dashboard_stats(db)
    return stats


# ---trainer management---


#  create trainer
@router.post("/trainers", response_model=TrainerResponse, status_code=status.HTTP_201_CREATED)
async def create_new_trainer(
    trainer_data: TrainerCreate,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):

    # Check if contact number already exists
    existing_trainer = await user_crud.get_trainer_by_contact(db, trainer_data.contact_no)
    if existing_trainer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists with this contact number",
        )

    # Create trainer
    new_trainer = await user_crud.create_trainer(db, trainer_data, current_head.id)
    return TrainerResponse.from_orm_with_user(new_trainer)


# get all trainers
@router.get("/trainers", response_model=List[TrainerResponse])
async def get_my_trainers(
    db: AsyncSession = Depends(get_db), current_head: HeadProfile = Depends(get_current_head)
):

    trainers = await user_crud.get_trainers_by_head(db, current_head.id)
    return [TrainerResponse.from_orm_with_user(trainer) for trainer in trainers]


@router.get("/trainers/{trainer_id}", response_model=TrainerResponse)
async def get_trainer_details(
    trainer_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):

    trainer = await user_crud.get_trainer_by_id(db, trainer_id)

    if not trainer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trainer not found")

    # Verify trainer belongs to current head
    if trainer.created_by_head_id != current_head.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this trainer"
        )

    return TrainerResponse.from_orm_with_user(trainer)


@router.patch("/trainers/{trainer_id}", response_model=TrainerResponse)
async def update_trainer_profile(
    trainer_id: int,
    trainer_update: TrainerUpdate,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):

    trainer = await user_crud.get_trainer_by_id(db, trainer_id)

    if not trainer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trainer not found")

    # Verify trainer belongs to current head
    if trainer.created_by_head_id != current_head.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this trainer"
        )

    # If updating contact number, check for duplicates
    if trainer_update.contact_no and trainer_update.contact_no != trainer.contact_no:
        existing = await user_crud.get_trainer_by_contact(db, trainer_update.contact_no)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already exists with this contact number",
            )

    updated_trainer = await user_crud.update_trainer(db, trainer_id, trainer_update)
    return TrainerResponse.from_orm_with_user(updated_trainer)


# delete trainer
@router.delete("/trainers/{trainer_id}")
async def delete_trainer_account(
    trainer_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):

    trainer = await user_crud.get_trainer_by_id(db, trainer_id)

    if not trainer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trainer not found")

    # Verify trainer belongs to current head
    if trainer.created_by_head_id != current_head.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this trainer"
        )

    result = await user_crud.delete_trainer(db, trainer_id)
    return {"message": result}


# ----consultant management----


# create consultant
@router.post("/consultants", response_model=ConsultantResponse, status_code=status.HTTP_201_CREATED)
async def create_new_consultant(
    consultant_data: ConsultantCreate,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):

    # Check if contact number already exists
    existing_consultant = await user_crud.get_consultant_by_contact(db, consultant_data.contact_no)
    if existing_consultant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists with this contact number",
        )

    # Create consultant
    new_consultant = await user_crud.create_consultant(db, consultant_data, current_head.id)
    return ConsultantResponse.from_orm_with_user(new_consultant)


# get all consultants
@router.get("/consultants", response_model=List[ConsultantResponse])
async def get_my_consultants(
    db: AsyncSession = Depends(get_db), current_head: HeadProfile = Depends(get_current_head)
):

    consultants = await user_crud.get_consultants_by_head(db, current_head.id)
    return [ConsultantResponse.from_orm_with_user(consultant) for consultant in consultants]


# get consultant details
@router.get("/consultants/{consultant_id}", response_model=ConsultantResponse)
async def get_consultant_details(
    consultant_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):

    consultant = await user_crud.get_consultant_by_id(db, consultant_id)

    if not consultant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultant not found")

    # Verify consultant belongs to current head
    if consultant.created_by_head_id != current_head.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this consultant"
        )

    return ConsultantResponse.from_orm_with_user(consultant)


# update consultant profile
@router.patch("/consultants/{consultant_id}", response_model=ConsultantResponse)
async def update_consultant_profile(
    consultant_id: int,
    consultant_update: ConsultantUpdate,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):

    consultant = await user_crud.get_consultant_by_id(db, consultant_id)

    if not consultant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultant not found")

    # Verify consultant belongs to current head
    if consultant.created_by_head_id != current_head.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this consultant"
        )

    # If updating contact number, check for duplicates
    if consultant_update.contact_no and consultant_update.contact_no != consultant.contact_no:
        existing = await user_crud.get_consultant_by_contact(db, consultant_update.contact_no)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already exists with this contact number",
            )

    updated_consultant = await user_crud.update_consultant(db, consultant_id, consultant_update)
    return ConsultantResponse.from_orm_with_user(updated_consultant)


# delete consultant account
@router.delete("/consultants/{consultant_id}")
async def delete_consultant_account(
    consultant_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):

    consultant = await user_crud.get_consultant_by_id(db, consultant_id)

    if not consultant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consultant not found")

    # Verify consultant belongs to current head
    if consultant.created_by_head_id != current_head.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this consultant"
        )

    result = await user_crud.delete_consultant(db, consultant_id)
    return {"message": result}


# ----Learner management----


#  create learner
@router.post("/learners", response_model=LearnerResponse, status_code=status.HTTP_201_CREATED)
async def create_new_learner(
    learner_data: LearnerCreate,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):

    # Check if contact number already exists
    existing_learner = await user_crud.get_learner_by_name(db, learner_data.name)
    if existing_learner:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists with this name"
        )

    # Create learner
    new_learner = await user_crud.create_learner(db, learner_data, current_head.id)
    return LearnerResponse.from_orm_with_user(new_learner)


# get all learners
@router.get("/learners", response_model=List[LearnerResponse])
async def get_my_learners(
    db: AsyncSession = Depends(get_db), current_head: HeadProfile = Depends(get_current_head)
):

    learners = await user_crud.get_learners_by_head(db, current_head.id)
    return [LearnerResponse.from_orm_with_user(learner) for learner in learners]


@router.get("/learners/{learner_id}", response_model=LearnerResponse)
async def get_learner_details(
    learner_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):

    learner = await user_crud.get_learner_by_id(db, learner_id)

    if not learner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learner not found")

    # Verify learner belongs to current head
    if learner.created_by_head_id != current_head.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this learner"
        )

    return LearnerResponse.from_orm_with_user(learner)


@router.patch("/learners/{learner_id}", response_model=LearnerResponse)
async def update_learner_profile(
    learner_id: int,
    learner_update: LearnerUpdate,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):

    learner = await user_crud.get_learner_by_id(db, learner_id)

    if not learner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learner not found")

    # Verify learner belongs to current head
    if learner.created_by_head_id != current_head.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this learner"
        )

    # If updating contact number, check for duplicates
    # if learner_update.contact_no and learner_update.contact_no != learner.contact_no:
    #     existing = await user_crud.get_learner_by_contact(db, learner_update.contact_no)
    #     if existing:
    #         raise HTTPException(
    #             status_code=status.HTTP_400_BAD_REQUEST,
    #             detail="User already exists with this contact number"
    #         )

    updated_learner = await user_crud.update_learner(db, learner_id, learner_update)
    return LearnerResponse.from_orm_with_user(updated_learner)


# delete learner
@router.delete("/learners/{learner_id}")
async def delete_learner_account(
    learner_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):

    learner = await user_crud.get_learner_by_id(db, learner_id)

    if not learner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learner not found")

    # Verify learner belongs to current head
    if learner.created_by_head_id != current_head.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this learner"
        )

    result = await user_crud.delete_learner(db, learner_id)
    return {"message": result}


# --- Reveal Passcode Endpoint (Secure) ---
logger = logging.getLogger(__name__)


@router.get("/users/{user_id}/reveal-passcode", response_model=dict)
async def reveal_user_passcode(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """
    Decrypt and return a user's plaintext passcode for admin viewing.
    
    Security considerations:
    - Only accessible by authenticated head users
    - Verifies user belongs to current head
    - Logs all reveal requests for audit trail
    - Should only be used when absolutely necessary
    """
    
    # Get user from database
    user = await user_crud.get_user_by_id(db, user_id)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify user belongs to current head (check profile created_by_head_id)
    is_authorized = False
    if user.role.value == "trainer" and user.trainer_profile:
        is_authorized = user.trainer_profile.created_by_head_id == current_head.id
    elif user.role.value == "consultant" and user.consultant_profile:
        is_authorized = user.consultant_profile.created_by_head_id == current_head.id
    elif user.role.value == "learner" and user.learner_profile:
        is_authorized = user.learner_profile.created_by_head_id == current_head.id
    
    if not is_authorized:
        # Log unauthorized attempt
        logger.warning(
            f"Unauthorized passcode reveal attempt - Head ID: {current_head.id}, "
            f"User ID: {user_id}, User Role: {user.role.value}"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this user's passcode"
        )
    
    try:
        # Decrypt the passcode
        plaintext_passcode = decrypt_passcode(user.passcode)
        
        # Log successful reveal for audit trail
        logger.info(
            f"Passcode revealed - Head ID: {current_head.id}, Head Name: {current_head.user.name}, "
            f"User ID: {user_id}, User Name: {user.name}, User Role: {user.role.value}"
        )
        
        return {
            "user_id": user_id,
            "name": user.name,
            "role": user.role.value,
            "passcode": plaintext_passcode
        }
        
    except ValueError as e:
        logger.error(f"Failed to decrypt passcode for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to decrypt passcode"
        )
