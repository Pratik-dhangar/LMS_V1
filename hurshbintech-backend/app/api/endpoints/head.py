"""
Head CRUD endpoints - Manage Trainers and Learners
Only accessible by heads
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, date
from pathlib import Path
import logging

from app.core.deps import get_current_head
from app.core.security import decrypt_passcode
from app.core.config import settings
from app.crud import user_crud
from app.crud import subscription_crud
from app.db.session import get_db
from app.models.user_model import HeadProfile
from app.models.subscription import SubscriptionPaymentReceipt, PaymentStatus
from app.schemas.user import (
    LearnerCreate,
    LearnerResponse,
    LearnerUpdate,
    TrainerCreate,
    TrainerResponse,
    TrainerUpdate,
    CoachResponse,
)
from app.schemas.subscription import LearnerSubscriptionCreate
from app.schemas.subscription import (
    SubscriptionPackageCreate,
    SubscriptionPackageUpdate,
    SubscriptionPackageResponse,
    LearnerSubscriptionCreate,
    LearnerSubscriptionBackdateCreate,
    LearnerSubscriptionResponse,
    LearnerSubscriptionDetailResponse,
    PaymentReceiptResponse,
    SessionAdjustmentCreate,
    SessionAdjustmentLogResponse,
    SubscriptionPauseRequest,
    SubscriptionFreezeRequest,
    SubscriptionResumeRequest,
    SubscriptionCancelRequest,
    SubscriptionRefundRequest,
    SubscriptionRefundResponse,
    ExpiringSubscriptionResponse,
    BackdateValidationResponse,
    SessionGapWarning,
)
from app.models.subscription import RefundType

router = APIRouter(prefix="/head", tags=["Head Operations"])


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
    try:
        new_trainer = await user_crud.create_trainer(db, trainer_data, current_head.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
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
    """Create a new learner with optional reference file uploads and initial subscription"""
    
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
    try:
        new_learner = await user_crud.create_learner(db, learner_create, current_head.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Handle reference files upload (including payment receipt)
    payment_receipt_file = None
    if reference_files:
        for idx, ref_file in enumerate(reference_files):
            # Skip if ref_file is None or empty
            if not ref_file or not hasattr(ref_file, 'filename') or not ref_file.filename:
                continue
            
            # The last file in the list is the payment receipt
            is_payment_receipt = (idx == len(reference_files) - 1)
            
            try:
                file_extension = ref_file.filename.split(".")[-1]
                
                if is_payment_receipt:
                    # Store for subscription payment receipt with learner name
                    filename = f"Payment_Receipt_of_{new_learner.user.name}.{file_extension}"
                    payment_receipt_file = ref_file
                else:
                    # Regular reference data
                    filename = f"learner_{new_learner.id}_ref_{ref_file.filename}"
                
                if settings.USE_S3:
                    # Save to S3
                    from app.utils.s3_utils import S3Manager
                    s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
                    await ref_file.seek(0)
                    file_content = await ref_file.read()
                    content_type = ref_file.content_type or "application/octet-stream"
                    
                    if is_payment_receipt:
                        s3_key = s3_manager.upload_file(
                            file_content,
                            folder="payment_receipts",
                            filename=filename,
                            content_type=content_type,
                        )
                    else:
                        s3_key = s3_manager.upload_file(
                            file_content,
                            folder="reference_data",
                            filename=filename,
                            content_type=content_type,
                        )
                    
                    file_url = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
                else:
                    if is_payment_receipt:
                        upload_dir = Path("uploads/payment_receipts")
                    else:
                        upload_dir = Path("uploads/reference_data")
                    upload_dir.mkdir(parents=True, exist_ok=True)
                    file_path = upload_dir / filename
                    content = await ref_file.read()
                    with open(file_path, "wb") as f:
                        f.write(content)
                    file_url = f"/uploads/payment_receipts/{filename}" if is_payment_receipt else f"/uploads/reference_data/{filename}"
                
                if not is_payment_receipt:
                    # Save reference data entry in database
                    await user_crud.create_learner_reference_data(
                        db,
                        learner_id=new_learner.id,
                        file_url=file_url,
                        file_type=file_extension,
                        description=ref_file.filename
                    )
                    logging.info(f"Saved reference data for learner {new_learner.id}: {file_url}")
                else:
                    # Store payment receipt file info for later use
                    payment_receipt_file = {
                        'file_url': file_url,
                        'file_name': filename,
                        'file_size': len(file_content) if 'file_content' in locals() else None,
                        'storage_type': 's3' if settings.USE_S3 else 'local'
                    }
                    logging.info(f"Saved payment receipt for learner {new_learner.id}: {file_url}")
            except Exception as e:
                # Log error but don't fail
                filename_str = getattr(ref_file, 'filename', 'unknown')
                logging.warning(f"Failed to upload file {filename_str}: {str(e)}")
    
    # Store learner ID before attempting subscription creation (for error handling)
    learner_id = new_learner.id
    logging.info(f"Created learner with ID: {learner_id}")
    
    # Create initial subscription if package_id is provided
    if learner_create.package_id:
        logging.info(f"Attempting to create subscription for learner {learner_id} with package {learner_create.package_id}")
        try:
            # Get the package
            package = await subscription_crud.get_package_by_id(db, learner_create.package_id)
            if not package:
                logging.error(f"Package {learner_create.package_id} not found")
                raise HTTPException(status_code=400, detail="Invalid package selected")
            
            logging.info(f"Found package: {package.package_name} (ID: {package.id})")
            
            # Create subscription
            from datetime import date
            subscription_data = LearnerSubscriptionCreate(
                learner_id=learner_id,
                package_id=learner_create.package_id,
                start_date=date.today(),
                discount_code=learner_create.discount_code
            )
            
            subscription, error = await subscription_crud.create_subscription(
                db, subscription_data, current_head.user_id
            )
            
            if error or not subscription:
                # Rollback on subscription creation error
                logging.error(f"Subscription creation returned error: {error}")
                await db.rollback()
                logging.warning(f"Failed to create subscription for learner {learner_id}: {error}")
            else:
                logging.info(f"Subscription created successfully: {subscription.id}, current_head_id: {subscription.current_head_id}")
                # Upload payment receipt if provided
                if payment_receipt_file and isinstance(payment_receipt_file, dict):
                    receipt_model = SubscriptionPaymentReceipt(
                        subscription_id=subscription.id,
                        uploaded_by_head_id=current_head.user_id,
                        file_name=payment_receipt_file['file_name'],
                        file_path=payment_receipt_file['file_url'],
                        file_size=payment_receipt_file.get('file_size'),
                        storage_type=payment_receipt_file.get('storage_type', 'local'),
                        payment_status=PaymentStatus.PENDING
                    )
                    db.add(receipt_model)
                    logging.info(f"Added payment receipt for subscription {subscription.id}")
                
                # Commit the entire transaction (learner + subscription + receipt)
                await db.commit()
                logging.info(f"Transaction committed. Created subscription {subscription.id} for learner {learner_id}")
        except HTTPException:
            await db.rollback()
            raise
        except Exception as e:
            await db.rollback()
            logging.error(f"Exception during subscription creation: {type(e).__name__}: {str(e)}", exc_info=True)
    else:
        logging.info(f"No package_id provided, skipping subscription creation")
        # No subscription requested, commit just the learner creation
        await db.commit()
        logging.info(f"Transaction committed. Learner {learner_id} created without subscription")
    
    # Refresh learner to load user relationship
    await db.refresh(new_learner, ['reference_data', 'user'])
    
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

    # Get active subscription for this learner to fetch package_id and discount_code
    from app.crud import subscription_crud
    active_subscription = await subscription_crud.get_active_subscription_for_learner(db, learner_id)
    
    response_dict = LearnerResponse.from_orm_with_user(learner).dict()
    
    # Add subscription data if exists
    if active_subscription:
        response_dict['package_id'] = active_subscription.package_id
        response_dict['discount_code'] = active_subscription.discount_code
    
    return response_dict


@router.get("/learners/{learner_id}/subscriptions", response_model=List[LearnerSubscriptionResponse])
async def get_learner_subscriptions(
    learner_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Get all subscriptions for a specific learner"""
    from app.crud import subscription_crud
    from app.schemas.subscription import LearnerSubscriptionResponse
    
    # Verify learner belongs to current head
    learner = await user_crud.get_learner_by_id(db, learner_id)
    if not learner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learner not found")
    
    if learner.created_by_head_id != current_head.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this learner's subscriptions"
        )
    
    subscriptions = await subscription_crud.get_subscriptions_by_learner(db, learner_id)
    
    enriched = []
    for sub in subscriptions:
        # Get learner name
        learner_name = None
        if sub.learner and hasattr(sub.learner, 'name'):
            learner_name = sub.learner.name
        else:
            learner_name = learner.user.name
        
        # Get head name
        head_name = None
        if sub.current_head and hasattr(sub.current_head, 'name'):
            head_name = sub.current_head.name
        
        sub_dict = {
            "id": sub.id,
            "learner_id": sub.learner_id,
            "learner_name": learner_name,
            "package_id": sub.package_id,
            "created_by_head_id": sub.created_by_head_id,
            "current_head_id": sub.current_head_id,
            "head_name": head_name,
            "package_name": sub.package_name,
            "package_sessions": sub.package_sessions,
            "package_validity_days": sub.package_validity_days,
            "package_original_price": sub.package_original_price,
            "start_date": sub.start_date,
            "expiry_date": sub.expiry_date,
            "status": sub.status,
            "sessions_total": sub.sessions_total,
            "sessions_completed": sub.sessions_completed,
            "sessions_remaining": sub.sessions_remaining,
            "discount_applied": sub.discount_applied,
            "discount_code_id": sub.discount_code_id,
            "applied_by_head_id": sub.applied_by_head_id,
            "net_price_paid": sub.net_price_paid,
            "paused_at": sub.paused_at,
            "paused_duration_days": sub.paused_duration_days,
            "frozen_at": sub.frozen_at,
            "frozen_duration_days": sub.frozen_duration_days,
            "renewed_from_subscription_id": sub.renewed_from_subscription_id,
            "renewed_to_subscription_id": sub.renewed_to_subscription_id,
            "refund_amount": sub.refund_amount,
            "refund_type": sub.refund_type,
            "refund_date": sub.refund_date,
            "refund_reason": sub.refund_reason,
            "created_at": sub.created_at,
            "updated_at": sub.updated_at,
        }
        enriched.append(LearnerSubscriptionResponse(**sub_dict))
    
    return enriched


@router.patch("/learners/{learner_id}", response_model=LearnerResponse)
async def update_learner_profile(
    learner_id: int,
    learner_update: str = Form(None),
    reference_files: List[UploadFile] = File(None),
    payment_receipt: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Update learner profile with optional reference file and payment receipt uploads"""

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
    
    # Handle payment receipt upload if provided
    if payment_receipt and payment_receipt.filename:
        try:
            from app.crud import subscription_crud
            
            # Get active subscription for this learner
            active_subscription = await subscription_crud.get_active_subscription_for_learner(db, learner_id)
            
            if active_subscription:
                file_extension = payment_receipt.filename.split(".")[-1]
                filename = f"Payment_Receipt_of_{learner.user.name}.{file_extension}"
                
                if settings.USE_S3:
                    # Save to S3
                    from app.utils.s3_utils import S3Manager
                    s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
                    await payment_receipt.seek(0)
                    file_content = await payment_receipt.read()
                    content_type = payment_receipt.content_type or "application/octet-stream"
                    s3_key = s3_manager.upload_file(
                        file_content,
                        folder="payment_receipts",
                        filename=filename,
                        content_type=content_type,
                    )
                    file_path = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
                else:
                    upload_dir = Path("uploads/payment_receipts")
                    upload_dir.mkdir(parents=True, exist_ok=True)
                    file_path_obj = upload_dir / filename
                    content = await payment_receipt.read()
                    with open(file_path_obj, "wb") as f:
                        f.write(content)
                    file_path = f"/uploads/payment_receipts/{filename}"
                
                # Create payment receipt record with PENDING status
                from app.models.subscription_model import SubscriptionPaymentReceipt, PaymentStatus
                new_receipt = SubscriptionPaymentReceipt(
                    subscription_id=active_subscription.id,
                    uploaded_by_head_id=current_head.user_id,
                    file_name=filename,
                    file_path=file_path,
                    file_size=len(content),
                    storage_type="s3" if settings.USE_S3 else "local",
                    payment_status=PaymentStatus.PENDING,
                    uploaded_at=func.now()
                )
                db.add(new_receipt)
                await db.commit()
                logging.info(f"Payment receipt uploaded for learner {learner_id}: {file_path}")
            else:
                logging.warning(f"No active subscription found for learner {learner_id}, payment receipt not saved")
        except Exception as e:
            logging.error(f"Failed to upload payment receipt for learner {learner_id}: {str(e)}")
            # Don't fail the entire request if receipt upload fails
    
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
    
    # Get active subscription for response
    from app.crud import subscription_crud
    active_subscription = await subscription_crud.get_active_subscription_for_learner(db, learner_id)
    
    response_dict = LearnerResponse.from_orm_with_user(updated_learner).dict()
    
    # Add subscription data if exists
    if active_subscription:
        response_dict['package_id'] = active_subscription.package_id
        response_dict['discount_code'] = active_subscription.discount_code
    
    return response_dict


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


# ============ SUBSCRIPTION PACKAGE MANAGEMENT ============

@router.post("/subscription-packages", response_model=SubscriptionPackageResponse, status_code=status.HTTP_201_CREATED)
async def create_subscription_package(
    package_data: SubscriptionPackageCreate,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Create a new subscription package"""
    package = await subscription_crud.create_package(db, package_data, current_head.user_id)
    return package


@router.get("/subscription-packages", response_model=List[SubscriptionPackageResponse])
async def get_my_subscription_packages(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Get all subscription packages created by current HEAD"""
    logger.info(f"Fetching packages for HEAD user_id={current_head.user_id}, head_id={current_head.id}, active_only={active_only}")
    packages = await subscription_crud.get_packages_by_head(db, current_head.user_id, active_only)
    logger.info(f"Found {len(packages)} packages for HEAD {current_head.user_id}")
    return packages


@router.get("/subscription-packages/{package_id}", response_model=SubscriptionPackageResponse)
async def get_subscription_package_details(
    package_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Get subscription package details"""
    package = await subscription_crud.get_package_by_id(db, package_id)
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")
    
    # Verify package belongs to current head
    if package.head_id != current_head.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this package")
    
    return package


@router.patch("/subscription-packages/{package_id}", response_model=SubscriptionPackageResponse)
async def update_subscription_package(
    package_id: int,
    package_data: SubscriptionPackageUpdate,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Update a subscription package"""
    package = await subscription_crud.get_package_by_id(db, package_id)
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")
    
    # Verify package belongs to current head
    if package.head_id != current_head.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this package")
    
    updated_package = await subscription_crud.update_package(db, package_id, package_data)
    return updated_package


@router.delete("/subscription-packages/{package_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subscription_package(
    package_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Delete a subscription package (hard delete if no subscriptions, soft delete if subscriptions exist)"""
    package = await subscription_crud.get_package_by_id(db, package_id)
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")
    
    # Verify package belongs to current head
    if package.head_id != current_head.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this package")
    
    await subscription_crud.soft_delete_package(db, package_id)
    return None


# ============ LEARNER SUBSCRIPTION MANAGEMENT ============

@router.post("/subscriptions", response_model=LearnerSubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_learner_subscription(
    subscription_data: LearnerSubscriptionCreate,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Create a new subscription for a learner"""
    subscription, error = await subscription_crud.create_subscription(db, subscription_data, current_head.user_id)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    
    return subscription


@router.post("/subscriptions/backdate", response_model=LearnerSubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_backdated_subscription(
    subscription_data: LearnerSubscriptionBackdateCreate,
    old_subscription_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Create a backdated subscription renewal within grace period"""
    subscription, error = await subscription_crud.create_backdated_subscription(
        db, subscription_data, current_head.user_id, old_subscription_id
    )
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    
    return subscription


@router.get("/subscriptions/validate-backdate", response_model=BackdateValidationResponse)
async def validate_backdate(
    learner_id: int,
    old_subscription_id: int,
    new_start_date: date,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Validate backdate request and check for session gaps"""
    old_sub = await subscription_crud.get_subscription_by_id(db, old_subscription_id)
    if not old_sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Previous subscription not found")
    
    # Check grace period
    days_since_expiry = (date.today() - old_sub.expiry_date).days
    within_grace = days_since_expiry <= settings.SUBSCRIPTION_GRACE_PERIOD_DAYS
    
    if not within_grace:
        return BackdateValidationResponse(
            is_valid=False,
            within_grace_period=False,
            error_message=f"Backdate exceeds grace period of {settings.SUBSCRIPTION_GRACE_PERIOD_DAYS} days"
        )
    
    # Check for sessions in gap
    has_sessions, session_count = await subscription_crud.validate_backdate_for_renewal(
        db, learner_id, old_sub.expiry_date, new_start_date
    )
    
    warning = None
    if has_sessions:
        warning = SessionGapWarning(
            has_sessions_in_gap=True,
            session_count=session_count,
            gap_start_date=old_sub.expiry_date,
            gap_end_date=new_start_date,
            warning_message=f"⚠️ Warning: Learner has {session_count} sessions between expiry ({old_sub.expiry_date}) and selected backdate ({new_start_date}). Backdating may cause data inconsistency."
        )
    
    return BackdateValidationResponse(
        is_valid=True,
        within_grace_period=True,
        session_gap_warning=warning
    )


@router.get("/subscriptions", response_model=List[LearnerSubscriptionResponse])
async def get_my_subscriptions(
    status: Optional[str] = None,
    limit: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Get all subscriptions managed by current HEAD"""
    from app.models.subscription import SubscriptionStatus
    from app.schemas.subscription import LearnerSubscriptionResponse
    
    status_enum = None
    if status:
        try:
            status_enum = SubscriptionStatus[status.upper()]
        except KeyError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")
    
    subscriptions = await subscription_crud.get_subscriptions_by_head(db, current_head.user_id, status_enum, limit)
    
    # Enrich with learner_name and head_name
    enriched = []
    for sub in subscriptions:
        # Get learner name - check if learner exists and has a name
        learner_name = None
        if sub.learner and hasattr(sub.learner, 'name'):
            learner_name = sub.learner.name
        
        # Get head name - check if head exists and has a name
        head_name = None
        if sub.current_head and hasattr(sub.current_head, 'name'):
            head_name = sub.current_head.name
        
        sub_dict = {
            "id": sub.id,
            "learner_id": sub.learner_id,
            "learner_name": learner_name,
            "package_id": sub.package_id,
            "created_by_head_id": sub.created_by_head_id,
            "current_head_id": sub.current_head_id,
            "head_name": head_name,
            "package_name": sub.package_name,
            "package_sessions": sub.package_sessions,
            "package_validity_days": sub.package_validity_days,
            "package_original_price": sub.package_original_price,
            "start_date": sub.start_date,
            "expiry_date": sub.expiry_date,
            "status": sub.status,
            "sessions_total": sub.sessions_total,
            "sessions_completed": sub.sessions_completed,
            "sessions_remaining": sub.sessions_remaining,
            "discount_applied": sub.discount_applied,
            "discount_code_id": sub.discount_code_id,
            "applied_by_head_id": sub.applied_by_head_id,
            "net_price_paid": sub.net_price_paid,
            "paused_at": sub.paused_at,
            "paused_duration_days": sub.paused_duration_days,
            "frozen_at": sub.frozen_at,
            "frozen_duration_days": sub.frozen_duration_days,
            "renewed_from_subscription_id": sub.renewed_from_subscription_id,
            "renewed_to_subscription_id": sub.renewed_to_subscription_id,
            "refund_amount": sub.refund_amount,
            "refund_type": sub.refund_type,
            "refund_date": sub.refund_date,
            "refund_reason": sub.refund_reason,
            "created_at": sub.created_at,
            "updated_at": sub.updated_at,
        }
        enriched.append(LearnerSubscriptionResponse(**sub_dict))
    
    return enriched


@router.get("/subscriptions/{subscription_id}", response_model=LearnerSubscriptionDetailResponse)
async def get_subscription_details(
    subscription_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Get detailed subscription information"""
    subscription = await subscription_crud.get_subscription_by_id(db, subscription_id, load_relations=True)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    
    # Verify subscription belongs to current head
    if subscription.current_head_id != current_head.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this subscription")
    
    return subscription


@router.get("/subscriptions/{subscription_id}/renewal-chain", response_model=List[LearnerSubscriptionResponse])
async def get_subscription_renewal_chain(
    subscription_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Get full renewal chain for a subscription (A→B→C)"""
    subscription = await subscription_crud.get_subscription_by_id(db, subscription_id)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    
    # Verify subscription belongs to current head
    if subscription.current_head_id != current_head.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this subscription")
    
    chain = await subscription_crud.get_renewal_chain(db, subscription_id)
    return chain


@router.post("/subscriptions/{subscription_id}/pause", response_model=LearnerSubscriptionResponse)
async def pause_subscription(
    subscription_id: int,
    pause_data: SubscriptionPauseRequest,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Pause a subscription (stops expiry, allows sessions)"""
    subscription = await subscription_crud.get_subscription_by_id(db, subscription_id)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    
    # Verify subscription belongs to current head
    if subscription.current_head_id != current_head.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to pause this subscription")
    
    subscription, error = await subscription_crud.pause_subscription(db, subscription_id, pause_data.reason)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    
    return subscription


@router.post("/subscriptions/{subscription_id}/freeze", response_model=LearnerSubscriptionResponse)
async def freeze_subscription(
    subscription_id: int,
    freeze_data: SubscriptionFreezeRequest,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Freeze a subscription (blocks sessions, stops expiry)"""
    subscription = await subscription_crud.get_subscription_by_id(db, subscription_id)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    
    # Verify subscription belongs to current head
    if subscription.current_head_id != current_head.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to freeze this subscription")
    
    subscription, error = await subscription_crud.freeze_subscription(db, subscription_id, freeze_data.reason)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    
    return subscription


@router.post("/subscriptions/{subscription_id}/resume", response_model=LearnerSubscriptionResponse)
async def resume_subscription(
    subscription_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Resume a paused/frozen subscription"""
    subscription = await subscription_crud.get_subscription_by_id(db, subscription_id)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    
    # Verify subscription belongs to current head
    if subscription.current_head_id != current_head.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to resume this subscription")
    
    subscription, error = await subscription_crud.resume_subscription(db, subscription_id)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    
    return subscription


@router.post("/subscriptions/{subscription_id}/cancel", response_model=LearnerSubscriptionResponse)
async def cancel_subscription(
    subscription_id: int,
    cancel_data: SubscriptionCancelRequest,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Cancel a subscription"""
    subscription = await subscription_crud.get_subscription_by_id(db, subscription_id)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    
    # Verify subscription belongs to current head
    if subscription.current_head_id != current_head.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to cancel this subscription")
    
    subscription, error = await subscription_crud.cancel_subscription(db, subscription_id, cancel_data.reason)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    
    return subscription


@router.post("/subscriptions/{subscription_id}/refund", response_model=SubscriptionRefundResponse)
async def process_subscription_refund(
    subscription_id: int,
    refund_data: SubscriptionRefundRequest,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Process refund for a subscription"""
    subscription = await subscription_crud.get_subscription_by_id(db, subscription_id)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    
    # Verify subscription belongs to current head
    if subscription.current_head_id != current_head.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to refund this subscription")
    
    refund_amount, error = await subscription_crud.process_refund(db, refund_data)
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    
    # Refresh subscription after refund
    await db.refresh(subscription)
    
    return SubscriptionRefundResponse(
        subscription_id=subscription.id,
        refund_amount=refund_amount,
        refund_type=refund_data.refund_type,
        sessions_remaining=subscription.sessions_remaining,
        sessions_total=subscription.sessions_total,
        net_price_paid=subscription.net_price_paid
    )


@router.post("/subscriptions/{subscription_id}/adjust-sessions", response_model=SessionAdjustmentLogResponse)
async def adjust_subscription_sessions(
    subscription_id: int,
    adjustment_data: SessionAdjustmentCreate,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Manually adjust session count for a subscription"""
    subscription = await subscription_crud.get_subscription_by_id(db, subscription_id)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    
    # Verify subscription belongs to current head
    if subscription.current_head_id != current_head.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to adjust this subscription")
    
    # Verify adjustment amount
    if adjustment_data.adjustment_amount > settings.MAX_SESSION_ADJUSTMENT_AMOUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Adjustment amount cannot exceed {settings.MAX_SESSION_ADJUSTMENT_AMOUNT}"
        )
    
    adjustment_log, error = await subscription_crud.create_session_adjustment(
        db, adjustment_data, current_head.id, "HEAD"
    )
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    
    return adjustment_log


@router.post("/subscriptions/{subscription_id}/upload-receipt", response_model=PaymentReceiptResponse)
async def upload_payment_receipt(
    subscription_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Upload payment receipt for a subscription"""
    subscription = await subscription_crud.get_subscription_by_id(db, subscription_id)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    
    # Verify subscription belongs to current head
    if subscription.current_head_id != current_head.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to upload receipt for this subscription")
    
    # Generate filename
    file_extension = file.filename.split(".")[-1] if file.filename else "pdf"
    filename = f"receipt_sub_{subscription_id}_{datetime.utcnow().timestamp()}.{file_extension}"
    
    try:
        if settings.USE_S3:
            # Upload to S3
            from app.utils.s3_utils import S3Manager
            s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
            file_content = await file.read()
            content_type = file.content_type or "application/pdf"
            s3_key = s3_manager.upload_file(
                file_content,
                folder="payment_receipts",
                filename=filename,
                content_type=content_type,
            )
            file_path = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
            storage_type = "s3"
        else:
            # Save locally
            upload_dir = Path("uploads/payment_receipts")
            upload_dir.mkdir(parents=True, exist_ok=True)
            file_path_local = upload_dir / filename
            content = await file.read()
            with open(file_path_local, "wb") as f:
                f.write(content)
            file_path = f"/uploads/payment_receipts/{filename}"
            storage_type = "local"
        
        # Create receipt record
        receipt = await subscription_crud.create_payment_receipt(
            db,
            subscription_id=subscription_id,
            uploaded_by_head_id=current_head.id,
            file_name=filename,
            file_path=file_path,
            file_size=len(content) if 'content' in locals() else len(file_content),
            storage_type=storage_type
        )
        
        return receipt
        
    except Exception as e:
        logger.error(f"Failed to upload payment receipt: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload payment receipt"
        )


@router.get("/subscriptions/expiring-soon", response_model=List[ExpiringSubscriptionResponse])
async def get_expiring_subscriptions(
    days: int = 7,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Get subscriptions expiring in the next N days"""
    if days < 1 or days > 30:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Days must be between 1 and 30")
    
    subscriptions = await subscription_crud.get_expiring_subscriptions(db, current_head.id, days)
    
    # Build response with learner details
    result = []
    for sub in subscriptions:
        learner = await user_crud.get_user_by_id(db, sub.learner_id)
        days_until_expiry = (sub.expiry_date - date.today()).days
        
        result.append(ExpiringSubscriptionResponse(
            subscription_id=sub.id,
            learner_id=sub.learner_id,
            learner_name=learner.name if learner else "Unknown",
            learner_email=learner.email if learner else None,
            package_name=sub.package_name,
            expiry_date=sub.expiry_date,
            days_until_expiry=days_until_expiry,
            sessions_remaining=sub.sessions_remaining,
            net_price_paid=sub.net_price_paid
        ))
    
    return result
