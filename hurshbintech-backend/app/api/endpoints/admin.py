"""
Admin CRUD endpoints - Manage Heads and Coaches
"""

from typing import List
from pathlib import Path
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, status, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
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
    head_data: HeadCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):

    # Check if contact number already exists
    existing_head = await user_crud.get_head_by_contact(db, head_data.contact_no)
    if existing_head:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists with this contact number",
        )

    # Create head
    new_head = await user_crud.create_head(db, head_data, current_admin.id)
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
    head_update: HeadUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):

    head = await user_crud.get_head_by_id(db, head_id)

    if not head:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Head not found")

    # If updating contact number, check for duplicates
    if head_update.contact_no and head_update.contact_no != head.contact_no:
        existing = await user_crud.get_head_by_contact(db, head_update.contact_no)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User already exists with this contact number",
            )

    updated_head = await user_crud.update_head(db, head_id, head_update)
    return HeadResponse.from_orm_with_user(updated_head)


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
    reference_files: list = File(None),
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
                # Save to S3
                from app.utils.s3_utils import upload_to_s3
                s3_path = f"profile_pictures/{filename}"
                await profile_picture_url.seek(0)
                profile_picture_path = await upload_to_s3(profile_picture_url, s3_path)
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
        for ref_file in reference_files if isinstance(reference_files, list) else [reference_files]:
            if ref_file:
                try:
                    file_extension = ref_file.filename.split(".")[-1]
                    filename = f"coach_{new_coach.id}_ref_{ref_file.filename}"
                    
                    if settings.USE_S3:
                        from app.utils.s3_utils import upload_to_s3
                        s3_path = f"coach_references/{filename}"
                        await ref_file.seek(0)
                        file_url = await upload_to_s3(ref_file, s3_path)
                    else:
                        upload_dir = Path("uploads/coach_references")
                        upload_dir.mkdir(parents=True, exist_ok=True)
                        file_path = upload_dir / filename
                        content = await ref_file.read()
                        with open(file_path, "wb") as f:
                            f.write(content)
                        file_url = f"/uploads/coach_references/{filename}"
                    
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
                    logging.warning(f"Failed to upload reference file {ref_file.filename}: {str(e)}")

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
    reference_files: list = File(None),
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
                from app.utils.s3_utils import upload_to_s3
                s3_path = f"profile_pictures/{filename}"
                await profile_picture_url.seek(0)
                profile_picture_path = await upload_to_s3(profile_picture_url, s3_path)
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
        for ref_file in reference_files if isinstance(reference_files, list) else [reference_files]:
            if ref_file:
                try:
                    file_extension = ref_file.filename.split(".")[-1]
                    filename = f"coach_{coach_id}_ref_{ref_file.filename}"
                    
                    if settings.USE_S3:
                        from app.utils.s3_utils import upload_to_s3
                        s3_path = f"coach_references/{filename}"
                        await ref_file.seek(0)
                        file_url = await upload_to_s3(ref_file, s3_path)
                    else:
                        upload_dir = Path("uploads/coach_references")
                        upload_dir.mkdir(parents=True, exist_ok=True)
                        file_path = upload_dir / filename
                        content = await ref_file.read()
                        with open(file_path, "wb") as f:
                            f.write(content)
                        file_url = f"/uploads/coach_references/{filename}"
                    
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
                    logging.warning(f"Failed to upload reference file {ref_file.filename}: {str(e)}")
    
    return CoachResponse.from_orm_with_user(updated_coach)


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
