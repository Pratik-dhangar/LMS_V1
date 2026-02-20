"""
Admin CRUD endpoints - Manage Heads and Coaches
"""

import hashlib
import json
from typing import List, Optional
from pathlib import Path
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
import logging

from app.core.deps import get_current_admin
from app.core.config import settings
from app.core.security import decrypt_passcode
from app.crud import user_crud
from app.crud import subscription_crud
from app.db.session import get_db
from app.models.user_model import User
from app.schemas.user import HeadCreate, HeadResponse, HeadUpdate, LearnerResponse, TrainerResponse, CoachResponse, CoachCreate, CoachUpdate
from app.schemas.subscription import (
    SubscriptionDiscountCreate,
    SubscriptionDiscountBulkCreate,
    SubscriptionDiscountUpdate,
    SubscriptionDiscountResponse,
    LearnerSubscriptionResponse,
    SubscriptionStatsResponse,
    RevenueByHeadResponse,
    SessionAdjustmentCreate,
    SessionAdjustmentLogResponse,
    SubscriptionPackageCreate,
    SubscriptionPackageUpdate,
    SubscriptionPackageResponse,
)
from app.services.cache_service import cache_service

router = APIRouter(prefix="/admin", tags=["Admin Operations"])


# head management


@router.post("/heads", response_model=HeadResponse, status_code=status.HTTP_201_CREATED)
async def create_new_head(
    # Text fields using Form
    name: str = Form(...),
    email: str = Form(None),
    age: int = Form(None),
    address: str = Form(None),
    contact_number: str = Form(None),  # Contact number now stored in Users table
    qualification: str = Form(None),
    experience: str = Form(None),
    date_of_joining: str = Form(None),
    experience_with_hurshbin: str = Form(None),
    interest: str = Form(None),
    self_description: str = Form(None),
    future_vision: str = Form(None),
    number_of_sessions_done: int = Form(0),
    head_description: str = Form(None),
    learners_guardian_description: str = Form(None),
    input_at_hurshbin: str = Form(None),
    note_box: str = Form(None),
    message_box: str = Form(None),
    # File uploads
    reference_files: List[UploadFile] = File(None),
    # Dependencies
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Create a new head with optional reference data file uploads"""

    # Check if contact number already exists in Users table
    if contact_number:
        existing_user = await db.execute(
            select(User).where(User.contact_number == contact_number)
        )
        if existing_user.scalar_one_or_none():
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

    # Prepare head data
    head_data = HeadCreate(
        name=name,
        email=email,
        age=age,
        address=address,
        contact_number=contact_number,  # Now stored in Users table
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

    # Create head
    new_head = await user_crud.create_head(db, head_data, current_admin.id)
    
    # Update User record with contact_number
    if contact_number:
        new_head.user.contact_number = contact_number
        await db.commit()
        await db.refresh(new_head.user)
    
    # Handle reference files upload
    if reference_files:
        for ref_file in reference_files:
            # Skip if ref_file is None or empty
            if not ref_file or not hasattr(ref_file, 'filename') or not ref_file.filename:
                continue
                
            try:
                file_extension = ref_file.filename.split(".")[-1]
                filename = f"head_{new_head.id}_ref_{ref_file.filename}"
                
                if settings.USE_S3:
                    # Save to S3 - store in s3://bucket/key format
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
                await user_crud.create_head_reference_data(
                    db,
                    head_id=new_head.id,
                    file_url=file_url,
                    file_type=file_extension,
                    description=ref_file.filename
                )
            except Exception as e:
                # Log error but don't fail
                filename_str = getattr(ref_file, 'filename', 'unknown')
                logger.error(f"Failed to upload reference file {filename_str}: {str(e)}")
                # Continue with other files
    
    # Refresh the head object to load reference_data relationship
    await db.refresh(new_head, ['reference_data'])
    
    return HeadResponse.from_orm_with_user(new_head)


# Get all heads
@router.get("/heads", response_model=List[HeadResponse])
async def get_all_heads_list(
    db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)
):

    heads = await user_crud.get_all_heads(db)
    return [HeadResponse.from_orm_with_user(head) for head in heads]


# Get head details
@router.get("/heads/{head_id}", response_model=HeadResponse)
async def get_head_by_id(
    head_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):

    head = await user_crud.get_head_by_id(db, head_id)

    if not head:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Head not found")

    return HeadResponse.from_orm_with_user(head)


# Update head profile
@router.patch("/heads/{head_id}", response_model=HeadResponse)
async def update_head_profile(
    head_id: int,
    # Text fields using Form
    name: str = Form(None),
    email: str = Form(None),
    age: int = Form(None),
    address: str = Form(None),
    contact_number: str = Form(None),  # Contact number now stored in Users table
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
    current_admin: User = Depends(get_current_admin),
):
    """Update head profile with optional reference data file uploads"""

    head = await user_crud.get_head_by_id(db, head_id)

    if not head:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Head not found")

    # If updating contact number, check for duplicates in Users table
    if contact_number and contact_number != head.user.contact_number:
        existing_user = await db.execute(
            select(User).where(User.contact_number == contact_number)
        )
        if existing_user.scalar_one_or_none():
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

    # Prepare update data - only include non-None fields
    update_dict = {}
    if name is not None:
        update_dict['name'] = name
    if email is not None:
        update_dict['email'] = email
    if age is not None:
        update_dict['age'] = age
    if address is not None:
        update_dict['address'] = address
    # Note: contact_number is handled separately below (update User table)
    if qualification is not None:
        update_dict['qualification'] = qualification
    if experience is not None:
        update_dict['experience'] = experience
    if date_of_joining_obj is not None:
        update_dict['date_of_joining'] = date_of_joining_obj
    if experience_with_hurshbin is not None:
        update_dict['experience_with_hurshbin'] = experience_with_hurshbin
    if interest is not None:
        update_dict['interest'] = interest
    if self_description is not None:
        update_dict['self_description'] = self_description
    if future_vision is not None:
        update_dict['future_vision'] = future_vision
    if number_of_sessions_done is not None:
        update_dict['number_of_sessions_done'] = number_of_sessions_done
    if head_description is not None:
        update_dict['head_description'] = head_description
    if learners_guardian_description is not None:
        update_dict['learners_guardian_description'] = learners_guardian_description
    if input_at_hurshbin is not None:
        update_dict['input_at_hurshbin'] = input_at_hurshbin
    if note_box is not None:
        update_dict['note_box'] = note_box
    if message_box is not None:
        update_dict['message_box'] = message_box

    head_update = HeadUpdate(**update_dict)
    updated_head = await user_crud.update_head(db, head_id, head_update)
    
    # Update User record with contact_number
    if contact_number is not None:
        updated_head.user.contact_number = contact_number
        await db.commit()
        await db.refresh(updated_head.user)
    
    # Handle reference files upload
    if reference_files:
        for ref_file in reference_files:
            # Skip if ref_file is None or empty
            if not ref_file or not hasattr(ref_file, 'filename') or not ref_file.filename:
                continue
                
            try:
                file_extension = ref_file.filename.split(".")[-1]
                filename = f"head_{head_id}_ref_{ref_file.filename}"
                
                if settings.USE_S3:
                    # Save to S3 - store in s3://bucket/key format
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
                await user_crud.create_head_reference_data(
                    db,
                    head_id=head_id,
                    file_url=file_url,
                    file_type=file_extension,
                    description=ref_file.filename
                )
            except Exception as e:
                # Log error but don't fail
                filename_str = getattr(ref_file, 'filename', 'unknown')
                logger.error(f"Failed to upload reference file {filename_str}: {str(e)}")
                # Continue with other files
    
    # Invalidate user profile cache for this head
    await cache_service.invalidate_user_profile(updated_head.user_id)
    
    return HeadResponse.from_orm_with_user(updated_head)


# Delete head reference file
@router.delete("/heads/{head_id}/reference/{reference_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_head_reference_file(
    head_id: int,
    reference_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Delete a specific reference file for a head"""
    from app.models.user_model import HeadReferenceData
    import os
    
    # Get the reference data
    result = await db.execute(
        select(HeadReferenceData).where(
            HeadReferenceData.id == reference_id,
            HeadReferenceData.head_id == head_id
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
                logger.warning(f"Failed to delete S3 file: {str(e)}")
        elif ref_data.file_path.startswith("/uploads/"):
            # Delete local file
            try:
                file_path = Path(ref_data.file_path.lstrip("/"))
                if file_path.exists():
                    os.remove(file_path)
            except Exception as e:
                logger.warning(f"Failed to delete physical file: {str(e)}")
    
    # Delete from database
    await db.delete(ref_data)
    await db.commit()
    
    return None


# Delete head account
@router.delete("/heads/{head_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_head_account(
    head_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):

    success = await user_crud.delete_head(db, head_id)

    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Head not found")
    
    return {"message": success}


# Get all trainers (read-only for admin)
@router.get("/trainers", response_model=List[TrainerResponse])
async def get_all_trainers_list(
    db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)
):
    """Get all trainers - admin can view all trainers in the system"""
    trainers = await user_crud.get_all_trainers_system_wide(db)
    return [TrainerResponse.from_orm_with_user(trainer) for trainer in trainers]


# Get all coaches (read-only for admin)
@router.get("/coaches", response_model=List[CoachResponse])
async def get_all_coaches_list(
    db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)
):
    """Get all coaches - admin can view all coaches in the system"""
    coaches = await user_crud.get_all_coaches_system_wide(db)
    return [CoachResponse.from_orm_with_user(coach) for coach in coaches]


# Create coach (admin only)
@router.post("/coaches", response_model=CoachResponse, status_code=status.HTTP_201_CREATED)
async def create_new_coach(
    # Text fields using Form
    name: str = Form(...),
    age: int = Form(None),
    address: str = Form(None),
    contact_number: str = Form(None),  # Contact number now stored in Users table
    qualification: str = Form(None),
    experience: str = Form(None),
    date_of_joining: str = Form(None),
    experience_with_hurshbin: str = Form(None),
    interest: str = Form(None),
    self_description: str = Form(None),
    future_vision: str = Form(None),
    number_of_sessions_done: int = Form(0),
    head_description: str = Form(None),
    learners_guardian_description: str = Form(None),
    input_at_hurshbin: str = Form(None),
    note_box: str = Form(None),
    message_box: str = Form(None),
    availability_days: str = Form(None),
    time_slots: str = Form(None),
    specialization: str = Form(None),
    # File uploads
    profile_picture_url: UploadFile = File(None),
    reference_files: List[UploadFile] = File(None),
    # Dependencies
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Create a new coach with optional file uploads (profile picture and reference data)"""
    
    # Check if contact number already exists in Users table
    if contact_number:
        existing_user = await db.execute(
            select(User).where(User.contact_number == contact_number)
        )
        if existing_user.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already exists with this contact number",
            )

    # Handle profile picture upload
    profile_picture_path = None
    if profile_picture_url:
        if not profile_picture_url.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Profile picture must be an image file",
            )
        
        max_size = 5 * 1024 * 1024  # 5 MB
        content = await profile_picture_url.read()
        if len(content) > max_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds 5 MB limit",
            )
        
        file_extension = profile_picture_url.filename.split(".")[-1]
        filename = f"coach_profile_{name}_{int(datetime.now().timestamp())}.{file_extension}"
        
        try:
            if settings.USE_S3:
                # Save to S3 - store in s3://bucket/key format
                from app.utils.s3_utils import S3Manager
                s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
                await profile_picture_url.seek(0)
                file_content = await profile_picture_url.read()
                s3_key = s3_manager.upload_file(
                    file_content,
                    folder="profile_pictures",
                    filename=filename,
                    content_type=profile_picture_url.content_type or "image/jpeg",
                )
                profile_picture_path = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
            else:
                # Save to local uploads folder
                upload_dir = Path("uploads/profile_pictures")
                upload_dir.mkdir(parents=True, exist_ok=True)
                file_path = upload_dir / filename
                with open(file_path, "wb") as f:
                    f.write(content)
                profile_picture_path = f"/uploads/profile_pictures/{filename}"
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload profile picture: {str(e)}",
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

    # Prepare coach data
    coach_data = CoachCreate(
        name=name,
        age=age,
        address=address,
        contact_number=contact_number,  # Now stored in Users table
        qualification=qualification,
        experience=experience,
        date_of_joining=date_of_joining_obj,
        availability_days=availability_days,
        time_slots=time_slots,
        specialization=specialization,
        profile_picture_url=profile_picture_path,
    )

    # Create coach in database (admin only)
    new_coach = await user_crud.create_coach(db, coach_data)
    
    # Update User record with contact_number
    if contact_number:
        new_coach.user.contact_number = contact_number
        await db.commit()
        await db.refresh(new_coach.user)
    
    # Handle reference files upload
    if reference_files:
        for ref_file in reference_files:
            # Skip if ref_file is None or empty
            if not ref_file or not hasattr(ref_file, 'filename') or not ref_file.filename:
                continue
                
            try:
                file_extension = ref_file.filename.split(".")[-1]
                filename = f"coach_{new_coach.id}_ref_{ref_file.filename}"
                
                if settings.USE_S3:
                    # Save to S3 - store in s3://bucket/key format
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
                from app.crud.coach_crud import create_coach_reference_data
                await create_coach_reference_data(
                    db,
                    coach_id=new_coach.id,
                    file_url=file_url,
                    file_type=file_extension,
                    description=ref_file.filename
                )
            except Exception as e:
                    # Log error but don't fail - coach is already created
                    filename_str = getattr(ref_file, 'filename', 'unknown')
                    logging.warning(f"Failed to upload reference file {filename_str}: {str(e)}")

    # Refresh coach to get the reference_data relationship
    await db.refresh(new_coach, ['reference_data'])
    
    return CoachResponse.from_orm_with_user(new_coach)


# Get coach by ID (admin only)
@router.get("/coaches/{coach_id}", response_model=CoachResponse)
async def get_coach_by_id(
    coach_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get coach details by ID - admin can view any coach"""
    coach = await user_crud.get_coach_by_id(db, coach_id)
    
    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")
    
    return CoachResponse.from_orm_with_user(coach)


# Update coach (admin only)
@router.patch("/coaches/{coach_id}", response_model=CoachResponse)
async def update_coach_profile(
    coach_id: int,
    # Text fields using Form (all optional for PATCH)
    name: str = Form(None),
    email: str = Form(None),
    age: int = Form(None),
    address: str = Form(None),
    contact_number: str = Form(None),  # Contact number now stored in Users table
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
    availability_days: str = Form(None),
    time_slots: str = Form(None),
    specialization: str = Form(None),
    # File uploads
    profile_picture_url: UploadFile = File(None),
    reference_files: List[UploadFile] = File(None),
    # Dependencies
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Update coach profile with optional file uploads"""
    
    coach = await user_crud.get_coach_by_id(db, coach_id)

    if not coach:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coach not found")

    # If updating contact number, check for duplicates in Users table
    if contact_number and contact_number != coach.user.contact_number:
        existing_user = await db.execute(
            select(User).where(User.contact_number == contact_number)
        )
        if existing_user.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already exists with this contact number",
            )

    # Handle profile picture upload
    profile_picture_path = None
    if profile_picture_url:
        if not profile_picture_url.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Profile picture must be an image file",
            )
        
        max_size = 5 * 1024 * 1024  # 5 MB
        content = await profile_picture_url.read()
        if len(content) > max_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds 5 MB limit",
            )
        
        file_extension = profile_picture_url.filename.split(".")[-1]
        filename = f"coach_profile_{coach.id}.{file_extension}"
        
        try:
            if settings.USE_S3:
                # Save to S3 - store in s3://bucket/key format
                from app.utils.s3_utils import S3Manager
                s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
                await profile_picture_url.seek(0)
                file_content = await profile_picture_url.read()
                s3_key = s3_manager.upload_file(
                    file_content,
                    folder="profile_pictures",
                    filename=filename,
                    content_type=profile_picture_url.content_type or "image/jpeg",
                )
                profile_picture_path = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
            else:
                upload_dir = Path("uploads/profile_pictures")
                upload_dir.mkdir(parents=True, exist_ok=True)
                file_path = upload_dir / filename
                with open(file_path, "wb") as f:
                    f.write(content)
                profile_picture_path = f"/uploads/profile_pictures/{filename}"
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload profile picture: {str(e)}",
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

    # Prepare update data - only include profile_picture_url if a new file was uploaded
    update_dict = {}
    if name is not None:
        update_dict["name"] = name
    if email is not None:
        update_dict["email"] = email
    if age is not None:
        update_dict["age"] = age
    if address is not None:
        update_dict["address"] = address
    # Note: contact_number is handled separately below (update User table)
    if qualification is not None:
        update_dict["qualification"] = qualification
    if experience is not None:
        update_dict["experience"] = experience
    if date_of_joining_obj is not None:
        update_dict["date_of_joining"] = date_of_joining_obj
    if experience_with_hurshbin is not None:
        update_dict["experience_with_hurshbin"] = experience_with_hurshbin
    if interest is not None:
        update_dict["interest"] = interest
    if self_description is not None:
        update_dict["self_description"] = self_description
    if future_vision is not None:
        update_dict["future_vision"] = future_vision
    if number_of_sessions_done is not None:
        update_dict["number_of_sessions_done"] = number_of_sessions_done
    if head_description is not None:
        update_dict["head_description"] = head_description
    if learners_guardian_description is not None:
        update_dict["learners_guardian_description"] = learners_guardian_description
    if input_at_hurshbin is not None:
        update_dict["input_at_hurshbin"] = input_at_hurshbin
    if note_box is not None:
        update_dict["note_box"] = note_box
    if message_box is not None:
        update_dict["message_box"] = message_box
    if availability_days is not None:
        update_dict["availability_days"] = availability_days
    if time_slots is not None:
        update_dict["time_slots"] = time_slots
    if specialization is not None:
        update_dict["specialization"] = specialization
    
    # Only include profile_picture_url if a new file was actually uploaded
    if profile_picture_path is not None:
        update_dict["profile_picture_url"] = profile_picture_path
    
    coach_update = CoachUpdate(**update_dict)

    updated_coach = await user_crud.update_coach(db, coach_id, coach_update)
    
    # Update User record with contact_number
    if contact_number is not None:
        updated_coach.user.contact_number = contact_number
        await db.commit()
        await db.refresh(updated_coach.user)
    
    # Handle reference files upload
    if reference_files:
        for ref_file in reference_files:
            # Skip if ref_file is None or empty
            if not ref_file or not hasattr(ref_file, 'filename') or not ref_file.filename:
                continue
                
            try:
                file_extension = ref_file.filename.split(".")[-1]
                filename = f"coach_{coach_id}_ref_{ref_file.filename}"
                
                if settings.USE_S3:
                    # Save to S3 - store in s3://bucket/key format
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
                from app.crud.coach_crud import create_coach_reference_data
                await create_coach_reference_data(
                    db,
                    coach_id=coach_id,
                    file_url=file_url,
                    file_type=file_extension,
                    description=ref_file.filename
                )
            except Exception as e:
                # Log error but don't fail
                filename_str = getattr(ref_file, 'filename', 'unknown')
                logging.warning(f"Failed to upload reference file {filename_str}: {str(e)}")
    
    # Invalidate coach profile caches
    await cache_service.invalidate_coach_profile(coach_id)
    
    return CoachResponse.from_orm_with_user(updated_coach)


# Delete coach reference file
@router.delete("/coaches/{coach_id}/reference/{reference_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_coach_reference_file(
    coach_id: int,
    reference_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Delete a specific reference file for a coach"""
    from app.models.user_model import CoachReferenceData
    import os
    
    # Get the reference data
    result = await db.execute(
        select(CoachReferenceData).where(
            CoachReferenceData.id == reference_id,
            CoachReferenceData.coach_id == coach_id
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
                logger.warning(f"Failed to delete S3 file: {str(e)}")
        elif ref_data.file_path.startswith("/uploads/"):
            # Delete local file
            try:
                file_path = Path(ref_data.file_path.lstrip("/"))
                if file_path.exists():
                    os.remove(file_path)
            except Exception as e:
                logger.warning(f"Failed to delete physical file: {str(e)}")
    
    # Delete from database
    await db.delete(ref_data)
    await db.commit()
    
    return None


# Get all learners (read-only for admin)
@router.get("/learners", response_model=List[LearnerResponse])
async def get_all_learners_list(
    db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)
):
    """Get all learners - admin can view all learners in the system"""
    learners = await user_crud.get_all_learners_system_wide(db)
    return [LearnerResponse.from_orm_with_user(learner) for learner in learners]


# --- Reveal Passcode Endpoint (Admin - Full Access) ---
logger = logging.getLogger(__name__)


@router.get("/users/{user_id}/reveal-passcode", response_model=dict)
async def reveal_user_passcode_admin(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Decrypt and return a user's plaintext passcode for admin viewing.
    
    Security considerations:
    - Only accessible by authenticated admin users
    - Admins have full access to all user passcodes
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
    
    try:
        # Decrypt the passcode
        plaintext_passcode = decrypt_passcode(user.passcode)
        
        # Log successful reveal for audit trail
        logger.info(
            f"Passcode revealed by ADMIN - Admin ID: {current_admin.id}, Admin Name: {current_admin.name}, "
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


# ============= PROGRAM-CONTENT MANAGEMENT =============

@router.post("/learning-goals/{program_id}/contents", status_code=status.HTTP_201_CREATED)
async def add_content_to_program(
    program_id: int,
    content_id: int = Form(...),
    sequence_order: int = Form(None),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Add a learning content to a program with optional sequence order"""
    from app.crud import program_learning_content_crud
    
    # Check if already linked
    already_linked = await program_learning_content_crud.check_content_in_program(
        db, program_id, content_id
    )
    
    if already_linked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Content already linked to this program"
        )
    
    link = await program_learning_content_crud.add_content_to_program(
        db, program_id, content_id, sequence_order
    )
    
    return {
        "id": link.id,
        "program_id": link.program_id,
        "content_id": link.content_id,
        "sequence_order": link.sequence_order
    }


@router.get("/learning-goals/{program_id}/contents")
async def get_program_contents(
    program_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get all learning contents for a program, ordered by sequence"""
    from app.crud import program_learning_content_crud
    
    links = await program_learning_content_crud.get_program_contents(db, program_id)
    
    return [
        {
            "id": link.id,
            "program_id": link.program_id,
            "content_id": link.content_id,
            "content_title": link.content.title,
            "content_type": link.content.content_type.value,
            "file_url": link.content.file_url,
            "thumbnail_url": link.content.thumbnail_url,
            "sequence_order": link.sequence_order
        }
        for link in links
    ]


@router.patch("/learning-goals/{program_id}/contents/reorder")
async def reorder_program_contents(
    program_id: int,
    content_orders: List[dict],
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Update sequence order for multiple contents in a program"""
    from app.crud import program_learning_content_crud
    
    success = await program_learning_content_crud.reorder_program_contents(
        db, program_id, content_orders
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to reorder contents"
        )
    
    return {"message": "Contents reordered successfully"}


@router.delete("/learning-goals/{program_id}/contents/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_content_from_program(
    program_id: int,
    content_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Remove a learning content from a program"""
    from app.crud import program_learning_content_crud
    
    success = await program_learning_content_crud.remove_content_from_program(
        db, program_id, content_id
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found in this program"
        )
    
    return None


# ============ SUBSCRIPTION DISCOUNT CODE MANAGEMENT ============

@router.post("/discount-codes", response_model=SubscriptionDiscountResponse, status_code=status.HTTP_201_CREATED)
async def create_discount_code(
    discount_data: SubscriptionDiscountCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Create a new discount code"""
    # Check if code already exists
    existing = await subscription_crud.get_discount_by_code(db, discount_data.code)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Discount code already exists")
    
    discount = await subscription_crud.create_discount_code(db, discount_data, current_admin.id)
    return discount


@router.post("/discount-codes/bulk", response_model=List[SubscriptionDiscountResponse], status_code=status.HTTP_201_CREATED)
async def bulk_create_discount_codes(
    bulk_data: SubscriptionDiscountBulkCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Bulk create discount codes with prefix pattern"""
    if bulk_data.count > 1000:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Maximum 1000 codes per bulk creation")
    
    codes = await subscription_crud.bulk_create_discount_codes(db, bulk_data, current_admin.id)
    return codes


@router.get("/discount-codes", response_model=List[SubscriptionDiscountResponse])
async def get_all_discount_codes(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get all discount codes"""
    codes = await subscription_crud.get_all_discount_codes(db, active_only)
    return codes


@router.get("/discount-codes/{code}", response_model=SubscriptionDiscountResponse)
async def get_discount_code(
    code: str,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get discount code by code"""
    discount = await subscription_crud.get_discount_by_code(db, code)
    if not discount:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount code not found")
    return discount


@router.patch("/discount-codes/{discount_id}", response_model=SubscriptionDiscountResponse)
async def update_discount_code(
    discount_id: int,
    discount_data: SubscriptionDiscountUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Update a discount code"""
    discount = await subscription_crud.update_discount_code(db, discount_id, discount_data)
    if not discount:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount code not found")
    return discount


@router.delete("/discount-codes/{discount_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_discount_code(
    discount_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Delete a discount code"""
    discount = await subscription_crud.get_discount_by_id(db, discount_id)
    if not discount:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Discount code not found")
    
    await db.delete(discount)
    await db.commit()
    return None


# ============ SUBSCRIPTION RECORDS (READ-ONLY) ============

@router.get("/subscriptions", response_model=List[LearnerSubscriptionResponse])
async def get_all_subscriptions(
    status: Optional[str] = None,
    head_id: Optional[int] = None,
    learner_id: Optional[int] = None,
    limit: Optional[int] = 100,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get all subscriptions with optional filters"""
    from app.models.subscription import SubscriptionStatus, LearnerSubscription
    from sqlalchemy import and_, or_, desc
    from sqlalchemy.orm import joinedload
    
    # Use joinedload for better relationship loading
    query = select(LearnerSubscription).options(
        joinedload(LearnerSubscription.learner),
        joinedload(LearnerSubscription.current_head),
        joinedload(LearnerSubscription.created_by_head)
    )
    
    filters = []
    if status:
        try:
            status_enum = SubscriptionStatus[status.upper()]
            filters.append(LearnerSubscription.status == status_enum)
        except KeyError:
            raise HTTPException(status_code=400, detail="Invalid status")
    
    if head_id:
        # Filter by either created_by_head_id or current_head_id (both store user IDs)
        head_filter = or_(
            LearnerSubscription.created_by_head_id == head_id,
            LearnerSubscription.current_head_id == head_id
        )
        filters.append(head_filter)
    
    if learner_id:
        filters.append(LearnerSubscription.learner_id == learner_id)
    
    if filters:
        query = query.where(and_(*filters))
    
    query = query.order_by(desc(LearnerSubscription.created_at)).limit(limit)
    
    result = await db.execute(query)
    subscriptions = result.unique().scalars().all()
    
    # Enrich with learner_name and head_name
    enriched = []
    for sub in subscriptions:
        # Get learner name - check if learner exists and has a name
        learner_name = None
        if sub.learner and hasattr(sub.learner, 'name'):
            learner_name = sub.learner.name
        
        # Get head name - try current_head first, then fallback to created_by_head
        head_name = None
        if sub.current_head and hasattr(sub.current_head, 'name'):
            head_name = sub.current_head.name
            logger.info(f"Subscription {sub.id}: Found head_name from current_head: {head_name}")
        elif sub.created_by_head and hasattr(sub.created_by_head, 'name'):
            head_name = sub.created_by_head.name
            logger.info(f"Subscription {sub.id}: Found head_name from created_by_head: {head_name}")
        else:
            logger.warning(f"Subscription {sub.id}: No head_name found - current_head_id={sub.current_head_id}, created_by_head_id={sub.created_by_head_id}")
        
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


@router.get("/subscriptions/stats", response_model=SubscriptionStatsResponse)
async def get_subscription_statistics(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get overall subscription statistics"""
    stats = await subscription_crud.get_subscription_stats(db)
    
    # Get expiring counts
    from app.models.subscription import LearnerSubscription, SubscriptionStatus
    from datetime import timedelta
    from sqlalchemy import and_
    
    result_7 = await db.execute(
        select(LearnerSubscription).where(
            and_(
                LearnerSubscription.status == SubscriptionStatus.ACTIVE,
                LearnerSubscription.expiry_date <= date.today() + timedelta(days=7),
                LearnerSubscription.expiry_date >= date.today()
            )
        )
    )
    stats["expiring_in_7_days"] = len(list(result_7.scalars().all()))
    
    result_14 = await db.execute(
        select(LearnerSubscription).where(
            and_(
                LearnerSubscription.status == SubscriptionStatus.ACTIVE,
                LearnerSubscription.expiry_date <= date.today() + timedelta(days=14),
                LearnerSubscription.expiry_date >= date.today()
            )
        )
    )
    stats["expiring_in_14_days"] = len(list(result_14.scalars().all()))
    
    return SubscriptionStatsResponse(**stats)


@router.get("/subscriptions/{subscription_id}", response_model=LearnerSubscriptionResponse)
async def get_subscription_details(
    subscription_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get subscription details"""
    from sqlalchemy.orm import selectinload
    from sqlalchemy import select
    from app.models.subscription import LearnerSubscription
    
    query = select(LearnerSubscription).where(
        LearnerSubscription.id == subscription_id
    ).options(
        selectinload(LearnerSubscription.learner),
        selectinload(LearnerSubscription.current_head),
        selectinload(LearnerSubscription.payment_receipts),
        selectinload(LearnerSubscription.session_adjustments),
        selectinload(LearnerSubscription.event_logs)
    )
    
    result = await db.execute(query)
    subscription = result.scalar_one_or_none()
    
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    
    # Enrich with learner_name and head_name
    sub_dict = {
        "id": subscription.id,
        "learner_id": subscription.learner_id,
        "learner_name": subscription.learner.name if subscription.learner else None,
        "package_id": subscription.package_id,
        "created_by_head_id": subscription.created_by_head_id,
        "current_head_id": subscription.current_head_id,
        "head_name": subscription.current_head.name if subscription.current_head else None,
        "package_name": subscription.package_name,
        "package_sessions": subscription.package_sessions,
        "package_validity_days": subscription.package_validity_days,
        "package_original_price": subscription.package_original_price,
        "start_date": subscription.start_date,
        "expiry_date": subscription.expiry_date,
        "status": subscription.status,
        "sessions_total": subscription.sessions_total,
        "sessions_completed": subscription.sessions_completed,
        "sessions_remaining": subscription.sessions_remaining,
        "discount_applied": subscription.discount_applied,
        "discount_code_id": subscription.discount_code_id,
        "applied_by_head_id": subscription.applied_by_head_id,
        "net_price_paid": subscription.net_price_paid,
        "paused_at": subscription.paused_at,
        "paused_duration_days": subscription.paused_duration_days,
        "frozen_at": subscription.frozen_at,
        "frozen_duration_days": subscription.frozen_duration_days,
        "renewed_from_subscription_id": subscription.renewed_from_subscription_id,
        "renewed_to_subscription_id": subscription.renewed_to_subscription_id,
        "refund_amount": subscription.refund_amount,
        "refund_type": subscription.refund_type,
        "refund_date": subscription.refund_date,
        "refund_reason": subscription.refund_reason,
        "created_at": subscription.created_at,
        "updated_at": subscription.updated_at,
    }
    return LearnerSubscriptionResponse(**sub_dict)

@router.get("/revenue/by-head", response_model=List[RevenueByHeadResponse])
async def get_revenue_by_head(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get revenue statistics by HEAD"""
    # Get all heads
    heads = await user_crud.get_all_heads(db)
    
    result = []
    for head in heads:
        revenue_data = await subscription_crud.get_revenue_by_head(db, head.id, start_date, end_date)
        
        result.append(RevenueByHeadResponse(
            head_id=head.id,
            head_name=head.user.name,
            total_subscriptions=revenue_data["total_subscriptions"],
            total_revenue=revenue_data["total_revenue"],
            total_refunds=revenue_data["total_refunds"],
            net_revenue=revenue_data["net_revenue"],
            active_subscriptions=revenue_data["active_subscriptions"],
            period_start=start_date,
            period_end=end_date
        ))
    
    return result


@router.post("/subscriptions/{subscription_id}/adjust-sessions", response_model=SessionAdjustmentLogResponse)
async def adjust_subscription_sessions_admin(
    subscription_id: int,
    adjustment_data: SessionAdjustmentCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Manually adjust session count (ADMIN has unlimited adjustments)"""
    subscription = await subscription_crud.get_subscription_by_id(db, subscription_id)
    if not subscription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")
    
    # ADMIN has no adjustment limit
    if adjustment_data.adjustment_amount > settings.MAX_SESSION_ADJUSTMENT_AMOUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Adjustment amount cannot exceed {settings.MAX_SESSION_ADJUSTMENT_AMOUNT}"
        )
    
    adjustment_log, error = await subscription_crud.create_session_adjustment(
        db, adjustment_data, current_admin.id, "ADMIN"
    )
    if error:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)
    
    return adjustment_log


@router.get("/subscriptions/diagnosis/problematic-learners")
async def diagnose_problematic_subscriptions(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    DIAGNOSTIC ENDPOINT: Identify subscriptions where learner_id points to non-LEARNER users
    This helps identify data integrity issues where subscriptions may have incorrect learner references
    """
    from app.models.subscription import LearnerSubscription
    from app.models.user_model import UserRole
    from sqlalchemy.orm import joinedload
    
    query = select(LearnerSubscription).options(
        joinedload(LearnerSubscription.learner)
    ).order_by(LearnerSubscription.id)
    
    result = await db.execute(query)
    subscriptions = result.unique().scalars().all()
    
    problematic = []
    for sub in subscriptions:
        if not sub.learner:
            # Learner user doesn't exist
            problematic.append({
                "subscription_id": sub.id,
                "learner_id": sub.learner_id,
                "issue": "Learner user does not exist in database",
                "learner_name": None,
            })
        elif sub.learner.role != UserRole.LEARNER:
            # Learner is not actually a learner role
            problematic.append({
                "subscription_id": sub.id,
                "learner_id": sub.learner_id,
                "issue": f"User is {sub.learner.role.value}, not LEARNER",
                "learner_name": sub.learner.name,
                "user_role": sub.learner.role.value,
            })
    
    return {
        "total_subscriptions": len(subscriptions),
        "problematic_count": len(problematic),
        "problematic_subscriptions": problematic,
        "status": "OK" if len(problematic) == 0 else "ISSUES_FOUND"
    }


# ============ SUBSCRIPTION PACKAGE MANAGEMENT (ADMIN) ============

@router.post("/subscription-packages", response_model=SubscriptionPackageResponse, status_code=status.HTTP_201_CREATED)
async def create_subscription_package(
    package_data: SubscriptionPackageCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Create a new subscription package (Admin)"""
    package = await subscription_crud.create_package(db, package_data, current_admin.id)
    
    # Invalidate subscription package caches
    try:
        await cache_service.delete_pattern("subscription:packages:*")
        logger.info("Invalidated subscription package caches after creation")
    except Exception as e:
        logger.warning(f"Failed to invalidate subscription package cache: {e}")
    
    return package


@router.get("/subscription-packages", response_model=List[SubscriptionPackageResponse])
async def get_all_subscription_packages(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get all subscription packages (Admin)"""
    filters_data = {"active_only": active_only}
    filters_hash = hashlib.md5(json.dumps(filters_data, sort_keys=True).encode()).hexdigest()
    cache_key = f"subscription:packages:{filters_hash}"

    try:
        # Try cache first
        cached_data = await cache_service.get(cache_key)
        if cached_data:
            logger.debug(f"Cache HIT: {cache_key}")
            return [SubscriptionPackageResponse(**item) for item in cached_data]
    except Exception as e:
        logger.warning(f"Cache retrieval failed for subscription packages: {e}")

    logger.debug(f"Cache MISS: {cache_key}")
    packages = await subscription_crud.get_all_packages(db, active_only)

    try:
        # Cache for 1 hour - convert SQLAlchemy models to dicts
        packages_data = [SubscriptionPackageResponse.model_validate(p).model_dump() for p in packages]
        await cache_service.set(cache_key, packages_data, ttl=cache_service.TTL_SUBSCRIPTION_PACKAGES)
    except Exception as e:
        logger.warning(f"Cache storage failed for subscription packages: {e}")

    return packages


@router.get("/subscription-packages/{package_id}", response_model=SubscriptionPackageResponse)
async def get_subscription_package_details(
    package_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get subscription package details (Admin)"""
    package = await subscription_crud.get_package_by_id(db, package_id)
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")
    
    return package


@router.patch("/subscription-packages/{package_id}", response_model=SubscriptionPackageResponse)
async def update_subscription_package(
    package_id: int,
    package_data: SubscriptionPackageUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Update a subscription package (Admin)"""
    package = await subscription_crud.get_package_by_id(db, package_id)
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")
    
    updated_package = await subscription_crud.update_package(db, package_id, package_data)
    
    # Invalidate subscription package caches
    try:
        await cache_service.delete_pattern("subscription:packages:*")
        logger.info("Invalidated subscription package caches after update")
    except Exception as e:
        logger.warning(f"Failed to invalidate subscription package cache: {e}")
    
    return updated_package


@router.delete("/subscription-packages/{package_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subscription_package(
    package_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Delete a subscription package (Admin)"""
    package = await subscription_crud.get_package_by_id(db, package_id)
    if not package:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Package not found")
    
    await subscription_crud.soft_delete_package(db, package_id)
    
    # Invalidate subscription package caches
    try:
        await cache_service.delete_pattern("subscription:packages:*")
        logger.info("Invalidated subscription package caches after deletion")
    except Exception as e:
        logger.warning(f"Failed to invalidate subscription package cache: {e}")
    
    return None

