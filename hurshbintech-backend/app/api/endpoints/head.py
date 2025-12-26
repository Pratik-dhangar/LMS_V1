"""
Head CRUD endpoints - Manage Trainers and Learners
Only accessible by heads
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from pathlib import Path
import logging

from app.core.deps import get_current_head
from app.core.security import decrypt_passcode
from app.core.config import settings
from app.crud import user_crud
from app.db.session import get_db
from app.models.user_model import HeadProfile
from app.schemas.user import (
    LearnerCreate,
    LearnerResponse,
    LearnerUpdate,
    TrainerCreate,
    TrainerResponse,
    TrainerUpdate,
    CoachResponse,
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
    # Text fields using Form
    name: str = Form(None),
    email: str = Form(None),
    age: int = Form(None),
    address: str = Form(None),
    contact_no: str = Form(None),
    qualification: str = Form(None),
    experience: str = Form(None),
    date_of_joining: str = Form(None),
    experience_with_hurshbin: str = Form(None),
    interest: str = Form(None),
    self_description: str = Form(None),
    future_vision: str = Form(None),
    number_of_sessions_done: int = Form(None),
    head_description: str = Form(None),
    learners_guardian_description: str = Form(None),
    input_at_hurshbin: str = Form(None),
    note_box: str = Form(None),
    message_box: str = Form(None),
    # File uploads
    reference_files: List[UploadFile] = File(None),
    # Dependencies
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Create a new trainer with optional reference file uploads"""

    # Check if contact number already exists
    if contact_no:
        existing_trainer = await user_crud.get_trainer_by_contact(db, contact_no)
        if existing_trainer:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already exists with this contact number",
            )

    # Convert date_of_joining from string to date object if provided
    date_of_joining_obj = None
    if date_of_joining:
        try:
            date_of_joining_obj = datetime.strptime(date_of_joining, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format for date_of_joining. Use YYYY-MM-DD",
            )

    # Prepare trainer data
    trainer_data = TrainerCreate(
        name=name,
        email=email,
        age=age,
        address=address,
        contact_no=contact_no,
        qualification=qualification,
        experience=experience,
        date_of_joining=date_of_joining_obj,
        experience_with_hurshbin=experience_with_hurshbin,
        interest=interest,
        self_description=self_description,
        future_vision=future_vision,
        number_of_sessions_done=number_of_sessions_done,
        head_description=head_description,
        learners_guardian_description=learners_guardian_description,
        input_at_hurshbin=input_at_hurshbin,
        note_box=note_box,
        message_box=message_box,
    )

    # Create trainer
    new_trainer = await user_crud.create_trainer(db, trainer_data, current_head.id)
    
    # Handle reference files upload
    if reference_files:
        for ref_file in reference_files:
            # Skip if ref_file is None or empty
            if not ref_file or not hasattr(ref_file, 'filename') or not ref_file.filename:
                continue
                
            try:
                file_extension = ref_file.filename.split(".")[-1]
                filename = f"trainer_{new_trainer.id}_ref_{ref_file.filename}"
                
                if settings.USE_S3:
                    # Save to S3
                    from app.utils.s3_utils import S3Manager
                    s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
                    await ref_file.seek(0)
                    file_content = await ref_file.read()
                    content_type = ref_file.content_type or "application/octet-stream"
                    s3_key = s3_manager.upload_file(
                        file_content,
                        folder="reference_data",
                        filename=filename,
                        content_type=content_type,
                    )
                    file_url = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
                else:
                    upload_dir = Path("uploads/reference_data")
                    upload_dir.mkdir(parents=True, exist_ok=True)
                    file_path = upload_dir / filename
                    content = await ref_file.read()
                    with open(file_path, "wb") as f:
                        f.write(content)
                    file_url = f"/uploads/reference_data/{filename}"
                
                # Save reference data entry in database
                await user_crud.create_trainer_reference_data(
                    db,
                    trainer_id=new_trainer.id,
                    file_url=file_url,
                    file_type=file_extension,
                    description=ref_file.filename
                )
            except Exception as e:
                # Log error but don't fail
                filename_str = getattr(ref_file, 'filename', 'unknown')
                logging.warning(f"Failed to upload reference file {filename_str}: {str(e)}")
    
    # Refresh trainer to get the reference_data relationship
    await db.refresh(new_trainer, ['reference_data'])
    
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
    # Text fields using Form (all optional for PATCH)
    name: str = Form(None),
    email: str = Form(None),
    age: int = Form(None),
    address: str = Form(None),
    contact_no: str = Form(None),
    qualification: str = Form(None),
    experience: str = Form(None),
    date_of_joining: str = Form(None),
    experience_with_hurshbin: str = Form(None),
    interest: str = Form(None),
    self_description: str = Form(None),
    future_vision: str = Form(None),
    number_of_sessions_done: int = Form(None),
    head_description: str = Form(None),
    learners_guardian_description: str = Form(None),
    input_at_hurshbin: str = Form(None),
    note_box: str = Form(None),
    message_box: str = Form(None),
    # File uploads
    reference_files: List[UploadFile] = File(None),
    # Dependencies
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Update trainer profile with optional reference file uploads"""

    trainer = await user_crud.get_trainer_by_id(db, trainer_id)

    if not trainer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trainer not found")

    # Verify trainer belongs to current head
    if trainer.created_by_head_id != current_head.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this trainer"
        )

    # If updating contact number, check for duplicates
    if contact_no and contact_no != trainer.contact_no:
        existing = await user_crud.get_trainer_by_contact(db, contact_no)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already exists with this contact number",
            )

    # Convert date_of_joining from string to date object if provided
    date_of_joining_obj = None
    if date_of_joining:
        try:
            date_of_joining_obj = datetime.strptime(date_of_joining, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format for date_of_joining. Use YYYY-MM-DD",
            )

    # Prepare update data
    trainer_update = TrainerUpdate(
        name=name,
        email=email,
        age=age,
        address=address,
        contact_no=contact_no,
        qualification=qualification,
        experience=experience,
        date_of_joining=date_of_joining_obj,
        experience_with_hurshbin=experience_with_hurshbin,
        interest=interest,
        self_description=self_description,
        future_vision=future_vision,
        number_of_sessions_done=number_of_sessions_done,
        head_description=head_description,
        learners_guardian_description=learners_guardian_description,
        input_at_hurshbin=input_at_hurshbin,
        note_box=note_box,
        message_box=message_box,
    )

    updated_trainer = await user_crud.update_trainer(db, trainer_id, trainer_update)
    
    # Handle reference files upload
    if reference_files:
        for ref_file in reference_files:
            # Skip if ref_file is None or empty
            if not ref_file or not hasattr(ref_file, 'filename') or not ref_file.filename:
                continue
                
            try:
                file_extension = ref_file.filename.split(".")[-1]
                filename = f"trainer_{trainer_id}_ref_{ref_file.filename}"
                
                if settings.USE_S3:
                    # Save to S3
                    from app.utils.s3_utils import S3Manager
                    s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
                    await ref_file.seek(0)
                    file_content = await ref_file.read()
                    content_type = ref_file.content_type or "application/octet-stream"
                    s3_key = s3_manager.upload_file(
                        file_content,
                        folder="reference_data",
                        filename=filename,
                        content_type=content_type,
                    )
                    file_url = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
                else:
                    upload_dir = Path("uploads/reference_data")
                    upload_dir.mkdir(parents=True, exist_ok=True)
                    file_path = upload_dir / filename
                    content = await ref_file.read()
                    with open(file_path, "wb") as f:
                        f.write(content)
                    file_url = f"/uploads/reference_data/{filename}"
                
                # Save reference data entry in database
                await user_crud.create_trainer_reference_data(
                    db,
                    trainer_id=trainer_id,
                    file_url=file_url,
                    file_type=file_extension,
                    description=ref_file.filename
                )
            except Exception as e:
                # Log error but don't fail
                filename_str = getattr(ref_file, 'filename', 'unknown')
                logging.warning(f"Failed to upload reference file {filename_str}: {str(e)}")
    
    return TrainerResponse.from_orm_with_user(updated_trainer)


# Delete trainer reference file
@router.delete("/trainers/{trainer_id}/reference/{reference_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trainer_reference_file(
    trainer_id: int,
    reference_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Delete a specific reference file for a trainer"""
    from app.models.user_model import TrainerReferenceData
    import os
    
    # Get the trainer first to verify ownership
    trainer = await user_crud.get_trainer_by_id(db, trainer_id)
    if not trainer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Trainer not found")
    
    # Verify trainer belongs to current head
    if trainer.created_by_head_id != current_head.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Not authorized to delete this trainer's files"
        )
    
    # Get the reference data
    result = await db.execute(
        select(TrainerReferenceData).where(
            TrainerReferenceData.id == reference_id,
            TrainerReferenceData.trainer_id == trainer_id
        )
    )
    ref_data = result.scalar_one_or_none()
    
    if not ref_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reference file not found"
        )
    
    # Delete physical file
    if ref_data.file_path:
        if ref_data.file_path.startswith("s3://"):
            # Delete from S3
            try:
                from app.utils.s3_utils import S3Manager
                s3_key = ref_data.file_path.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
                s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
                s3_manager.delete_file(s3_key)
            except Exception as e:
                logging.warning(f"Failed to delete S3 file: {str(e)}")
        elif ref_data.file_path.startswith("/uploads/"):
            # Delete local file
            try:
                file_path = Path(ref_data.file_path.lstrip("/"))
                if file_path.exists():
                    os.remove(file_path)
            except Exception as e:
                logging.warning(f"Failed to delete physical file: {str(e)}")
    
    # Delete from database
    await db.delete(ref_data)
    await db.commit()
    
    return None


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


# ----coach management----


# ---coach management (Read-only for heads) ---
# NOTE: Coach creation/updates are now managed by admin endpoints


# get all coaches
@router.get("/coaches", response_model=List[CoachResponse])
async def get_my_coaches(
    db: AsyncSession = Depends(get_db), current_head: HeadProfile = Depends(get_current_head)
):

    coaches = await user_crud.get_coaches_by_head(db, current_head.id)
    return [CoachResponse.from_orm_with_user(coach) for coach in coaches]


# get coach details
@router.get("/coaches/{coach_id}", response_model=CoachResponse)
async def get_coach_details(
    coach_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):

    coach = await user_crud.get_coach_by_id(db, coach_id)

    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")

    return CoachResponse.from_orm_with_user(coach)


# delete coach account
@router.delete("/coaches/{coach_id}")
async def delete_coach_account(
    coach_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):

    coach = await user_crud.get_coach_by_id(db, coach_id)

    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")

    result = await user_crud.delete_coach(db, coach_id)
    return {"message": result}


# ----Learner management----


#  create learner
@router.post("/learners", response_model=LearnerResponse, status_code=status.HTTP_201_CREATED)
async def create_new_learner(
    learner_data: str = Form(...),
    reference_files: List[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Create a new learner with optional reference file uploads"""
    
    # Parse the JSON string to LearnerCreate object
    import json
    try:
        learner_dict = json.loads(learner_data)
        learner_create = LearnerCreate(**learner_dict)
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid learner data format: {str(e)}"
        )

    # Check if learner name already exists
    existing_learner = await user_crud.get_learner_by_name(db, learner_create.name)
    if existing_learner:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User already exists with this name"
        )

    # Create learner
    new_learner = await user_crud.create_learner(db, learner_create, current_head.id)
    
    # Handle reference files upload
    if reference_files:
        for ref_file in reference_files:
            # Skip if ref_file is None or empty
            if not ref_file or not hasattr(ref_file, 'filename') or not ref_file.filename:
                continue
                
            try:
                file_extension = ref_file.filename.split(".")[-1]
                filename = f"learner_{new_learner.id}_ref_{ref_file.filename}"
                
                if settings.USE_S3:
                    # Save to S3
                    from app.utils.s3_utils import S3Manager
                    s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
                    await ref_file.seek(0)
                    file_content = await ref_file.read()
                    content_type = ref_file.content_type or "application/octet-stream"
                    s3_key = s3_manager.upload_file(
                        file_content,
                        folder="reference_data",
                        filename=filename,
                        content_type=content_type,
                    )
                    file_url = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
                else:
                    upload_dir = Path("uploads/reference_data")
                    upload_dir.mkdir(parents=True, exist_ok=True)
                    file_path = upload_dir / filename
                    content = await ref_file.read()
                    with open(file_path, "wb") as f:
                        f.write(content)
                    file_url = f"/uploads/reference_data/{filename}"
                
                # Save reference data entry in database
                await user_crud.create_learner_reference_data(
                    db,
                    learner_id=new_learner.id,
                    file_url=file_url,
                    file_type=file_extension,
                    description=ref_file.filename
                )
                logging.info(f"Saved reference data for learner {new_learner.id}: {file_url}")
            except Exception as e:
                # Log error but don't fail
                filename_str = getattr(ref_file, 'filename', 'unknown')
                logging.warning(f"Failed to upload reference file {filename_str}: {str(e)}")
    
    # Refresh learner to get the reference_data relationship
    await db.refresh(new_learner, ['reference_data'])
    
    return LearnerResponse.from_orm_with_user(new_learner)


# get all learners
@router.get("/learners", response_model=List[LearnerResponse])
async def get_my_learners(
    db: AsyncSession = Depends(get_db), current_head: HeadProfile = Depends(get_current_head)
):

    learners = await user_crud.get_learners_by_head(db, current_head.id)
    logger.info(f"Head {current_head.user_id} (ID: {current_head.id}) has {len(learners)} learners")
    for learner in learners:
        logger.info(f"  - Learner {learner.user.id}: {learner.user.name} (role: {learner.user.role.value})")
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
    learner_update: str = Form(None),
    reference_files: List[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Update learner profile with optional reference file uploads"""

    learner = await user_crud.get_learner_by_id(db, learner_id)

    if not learner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learner not found")

    # Verify learner belongs to current head
    if learner.created_by_head_id != current_head.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this learner"
        )

    # Parse the JSON string to LearnerUpdate object if provided
    if learner_update:
        import json
        try:
            learner_dict = json.loads(learner_update)
            learner_update_obj = LearnerUpdate(**learner_dict)
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid learner data format: {str(e)}"
            )
        
        updated_learner = await user_crud.update_learner(db, learner_id, learner_update_obj)
    else:
        updated_learner = learner
    
    # Handle reference files upload
    if reference_files:
        for ref_file in reference_files:
            # Skip if ref_file is None or empty
            if not ref_file or not hasattr(ref_file, 'filename') or not ref_file.filename:
                continue
                
            try:
                file_extension = ref_file.filename.split(".")[-1]
                filename = f"learner_{learner_id}_ref_{ref_file.filename}"
                
                if settings.USE_S3:
                    # Save to S3
                    from app.utils.s3_utils import S3Manager
                    s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
                    await ref_file.seek(0)
                    file_content = await ref_file.read()
                    content_type = ref_file.content_type or "application/octet-stream"
                    s3_key = s3_manager.upload_file(
                        file_content,
                        folder="reference_data",
                        filename=filename,
                        content_type=content_type,
                    )
                    file_url = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
                else:
                    upload_dir = Path("uploads/reference_data")
                    upload_dir.mkdir(parents=True, exist_ok=True)
                    file_path = upload_dir / filename
                    content = await ref_file.read()
                    with open(file_path, "wb") as f:
                        f.write(content)
                    file_url = f"/uploads/reference_data/{filename}"
                
                # Save reference data entry in database
                await user_crud.create_learner_reference_data(
                    db,
                    learner_id=learner_id,
                    file_url=file_url,
                    file_type=file_extension,
                    description=ref_file.filename
                )
                logging.info(f"Saved reference data for learner {learner_id}: {file_url}")
            except Exception as e:
                # Log error but don't fail
                filename_str = getattr(ref_file, 'filename', 'unknown')
                logging.warning(f"Failed to upload reference file {filename_str}: {str(e)}")
    
    # Refresh learner to get the updated reference_data relationship
    await db.refresh(updated_learner, ['reference_data'])
    
    return LearnerResponse.from_orm_with_user(updated_learner)


# Delete learner reference file
@router.delete("/learners/{learner_id}/reference/{reference_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_learner_reference_file(
    learner_id: int,
    reference_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Delete a specific reference file for a learner"""
    from app.models.user_model import LearnerReferenceData
    import os
    
    # Get the learner first to verify ownership
    learner = await user_crud.get_learner_by_id(db, learner_id)
    if not learner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learner not found")
    
    # Verify learner belongs to current head
    if learner.created_by_head_id != current_head.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Not authorized to delete this learner's files"
        )
    
    # Get the reference data
    result = await db.execute(
        select(LearnerReferenceData).where(
            LearnerReferenceData.id == reference_id,
            LearnerReferenceData.learner_id == learner_id
        )
    )
    ref_data = result.scalar_one_or_none()
    
    if not ref_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reference file not found"
        )
    
    # Delete physical file
    if ref_data.file_path:
        if ref_data.file_path.startswith("s3://"):
            # Delete from S3
            try:
                from app.utils.s3_utils import S3Manager
                s3_key = ref_data.file_path.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
                s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
                s3_manager.delete_file(s3_key)
            except Exception as e:
                logging.warning(f"Failed to delete S3 file: {str(e)}")
        elif ref_data.file_path.startswith("/uploads/"):
            # Delete local file
            try:
                file_path = Path(ref_data.file_path.lstrip("/"))
                if file_path.exists():
                    os.remove(file_path)
            except Exception as e:
                logging.warning(f"Failed to delete physical file: {str(e)}")
    
    # Delete from database
    await db.delete(ref_data)
    await db.commit()
    
    return None


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
    if user.role.value == "TRAINER" and user.trainer_profile:
        is_authorized = user.trainer_profile.created_by_head_id == current_head.id
    elif user.role.value == "LEARNER" and user.learner_profile:
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
