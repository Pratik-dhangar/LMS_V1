"""
Admin CRUD endpoints - Manage Heads and Coaches
"""

from typing import List
from pathlib import Path
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.core.deps import get_current_admin
from app.core.config import settings
from app.core.security import decrypt_passcode
from app.crud import user_crud
from app.db.session import get_db
from app.models.user_model import User
from app.schemas.user import HeadCreate, HeadResponse, HeadUpdate, LearnerResponse, TrainerResponse, CoachResponse, CoachCreate, CoachUpdate

router = APIRouter(prefix="/admin", tags=["Admin Operations"])


# dashboard stats
@router.get("/dashboard/stats")
async def get_admin_dashboard_stats(
    db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)
):
    stats = await user_crud.get_admin_dashboard_stats(db)
    return stats


# head management


@router.post("/heads", response_model=HeadResponse, status_code=status.HTTP_201_CREATED)
async def create_new_head(
    # Text fields using Form
    name: str = Form(...),
    email: str = Form(None),
    age: int = Form(None),
    address: str = Form(None),
    contact_no: str = Form(...),
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

    # Check if contact number already exists
    existing_head = await user_crud.get_head_by_contact(db, contact_no)
    if existing_head:
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

    # Create head
    new_head = await user_crud.create_head(db, head_data, current_admin.id)
    
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
    current_admin: User = Depends(get_current_admin),
):
    """Update head profile with optional reference data file uploads"""

    head = await user_crud.get_head_by_id(db, head_id)

    if not head:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Head not found")

    # If updating contact number, check for duplicates
    if contact_no and contact_no != head.contact_no:
        existing = await user_crud.get_head_by_contact(db, contact_no)
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
    if contact_no is not None:
        update_dict['contact_no'] = contact_no
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
    contact_no: str = Form(None),
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
    
    # Check if contact number already exists
    existing_coach = await user_crud.get_coach_by_contact(db, contact_no)
    if existing_coach:
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
        filename = f"coach_profile_{contact_no}.{file_extension}"
        
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
        contact_no=contact_no,
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

    # If updating contact number, check for duplicates
    if contact_no and contact_no != coach.contact_no:
        existing = await user_crud.get_coach_by_contact(db, contact_no)
        if existing:
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

    # Prepare update data
    coach_update = CoachUpdate(
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
        availability_days=availability_days,
        time_slots=time_slots,
        specialization=specialization,
        profile_picture_url=profile_picture_path,
    )

    updated_coach = await user_crud.update_coach(db, coach_id, coach_update)
    
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
