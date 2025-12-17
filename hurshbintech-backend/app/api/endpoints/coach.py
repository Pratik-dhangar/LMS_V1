"""
Coach endpoints - Profile picture upload, appointments, and sessions
Accessible by coaches and their heads
"""

import os
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_coach
from app.core.config import settings
from app.crud import coach_crud
from app.crud import user_crud
from app.db.session import get_db
from app.models.learning_content_model import LearningContent
from app.models.user_model import CoachProfile, User, UserRole
from app.schemas.user import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentUpdate,
    CoachSessionCreate,
    CoachSessionResponse,
    CoachSessionUpdate,
    CoachSessionParticipantCreate,
    CoachSessionParticipantResponse,
)

router = APIRouter(prefix="/coaches", tags=["Coach Operations"])


# ============ PROFILE PICTURE UPLOAD ============


@router.post("/profile-picture/upload")
async def upload_profile_picture(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """
    Upload profile picture for coach
    Saves to uploads/profile_pictures for development
    Saves to S3 for production
    """
    # Validate file
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image",
        )

    max_size = 5 * 1024 * 1024  # 5 MB
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 5 MB limit",
        )

    # Generate filename
    file_extension = file.filename.split(".")[-1]
    filename = f"coach_{current_coach.id}_{current_coach.user_id}.{file_extension}"

    try:
        if settings.ENVIRONMENT == "production":
            # Save to S3
            from app.utils.s3_utils import upload_to_s3

            s3_path = f"profile_pictures/{filename}"
            await file.seek(0)  # Reset file pointer
            file_url = await upload_to_s3(file, s3_path)
            
            # Update coach profile with S3 URL
            current_coach.profile_picture_url = file_url
        else:
            # Save to local uploads folder
            upload_dir = Path("uploads/profile_pictures")
            upload_dir.mkdir(parents=True, exist_ok=True)

            file_path = upload_dir / filename
            with open(file_path, "wb") as f:
                f.write(content)

            # Update coach profile with local path
            current_coach.profile_picture_url = f"/uploads/profile_pictures/{filename}"

        await db.commit()
        await db.refresh(current_coach)

        return {
            "message": "Profile picture uploaded successfully",
            "profile_picture_url": current_coach.profile_picture_url,
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload profile picture: {str(e)}",
        )


# ============ COACH AVAILABILITY STATUS ============


@router.patch("/availability")
async def update_coach_availability(
    is_available: bool,
    unavailable_until: Optional[str] = None,  # ISO format datetime string
    unavailable_reason: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """
    Update coach availability status
    
    When is_available=False, users cannot schedule appointments with this coach.
    Optionally set unavailable_until (ISO datetime) and unavailable_reason.
    """
    from datetime import datetime
    
    try:
        # Update availability status
        current_coach.is_available = is_available
        current_coach.unavailable_reason = unavailable_reason
        
        # Parse unavailable_until if provided
        if unavailable_until and not is_available:
            try:
                current_coach.unavailable_until = datetime.fromisoformat(unavailable_until)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid datetime format. Use ISO format (e.g., 2025-12-25T18:00:00)",
                )
        elif is_available:
            # Clear unavailable fields when marking as available
            current_coach.unavailable_until = None
            current_coach.unavailable_reason = None
        
        await db.commit()
        await db.refresh(current_coach)
        
        return {
            "message": f"Availability updated to {'available' if is_available else 'unavailable'}",
            "is_available": current_coach.is_available,
            "unavailable_until": current_coach.unavailable_until,
            "unavailable_reason": current_coach.unavailable_reason,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update availability: {str(e)}",
        )


@router.get("/availability")
async def get_coach_availability(
    coach_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get coach availability status (public endpoint)
    
    Returns whether a coach is currently available to accept appointments.
    """
    coach = await user_crud.get_coach_by_id(db, coach_id)
    if not coach:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coach not found",
        )
    
    from datetime import datetime
    
    # Check if unavailable_until has passed
    is_currently_available = coach.is_available
    if coach.unavailable_until and datetime.utcnow() >= coach.unavailable_until:
        # Auto-reset availability
        coach.is_available = True
        coach.unavailable_until = None
        coach.unavailable_reason = None
        await db.commit()
        is_currently_available = True
    
    return {
        "coach_id": coach.id,
        "coach_name": coach.user.name,
        "is_available": is_currently_available,
        "unavailable_until": coach.unavailable_until,
        "unavailable_reason": coach.unavailable_reason,
        "availability_days": coach.availability_days,
        "time_slots": coach.time_slots,
    }


# ============ APPOINTMENTS ============


@router.post("/appointments", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    appointment_data: AppointmentCreate,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Create a new appointment with the coach"""
    # Verify the appointment is for the current coach
    if appointment_data.coach_id != current_coach.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create appointment with another coach",
        )

    # Check if coach is available for new appointments
    from datetime import datetime
    if not current_coach.is_available:
        reason = current_coach.unavailable_reason or "Coach is currently unavailable"
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Cannot schedule with this coach: {reason}",
        )
    
    # Check if unavailable_until has passed (auto-reset if needed)
    if current_coach.unavailable_until and datetime.utcnow() >= current_coach.unavailable_until:
        current_coach.is_available = True
        current_coach.unavailable_until = None
        current_coach.unavailable_reason = None
        await db.commit()

    # Get current user to determine their role
    current_user = current_coach.user
    user_role = current_user.role.value

    appointment = await coach_crud.create_appointment(
        db, appointment_data, current_user.id, user_role
    )
    return AppointmentResponse.from_orm(appointment)


@router.get("/appointments", response_model=list[AppointmentResponse])
async def get_coach_appointments(
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Get all appointments for the current coach"""
    appointments = await coach_crud.get_appointments_by_coach(db, current_coach.id)
    return [AppointmentResponse.from_orm(apt) for apt in appointments]


@router.get("/appointments/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment_details(
    appointment_id: int,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Get appointment details"""
    appointment = await coach_crud.get_appointment_by_id(db, appointment_id)

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )

    if appointment.coach_id != current_coach.id and appointment.user_id != current_coach.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this appointment",
        )

    return AppointmentResponse.from_orm(appointment)


@router.patch("/appointments/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: int,
    appointment_update: AppointmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Update appointment details"""
    appointment = await coach_crud.get_appointment_by_id(db, appointment_id)

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )

    if appointment.coach_id != current_coach.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this appointment",
        )

    updated = await coach_crud.update_appointment(db, appointment_id, appointment_update)
    return AppointmentResponse.from_orm(updated)


@router.delete("/appointments/{appointment_id}")
async def delete_appointment(
    appointment_id: int,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Delete an appointment"""
    appointment = await coach_crud.get_appointment_by_id(db, appointment_id)

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )

    if appointment.coach_id != current_coach.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this appointment",
        )

    success = await coach_crud.delete_appointment(db, appointment_id)
    if success:
        return {"message": "Appointment deleted successfully"}
    return {"message": "Failed to delete appointment"}


# ============ COACH SESSIONS ============


@router.post("/sessions", response_model=CoachSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_data: CoachSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Create a new coach session"""
    session = await coach_crud.create_coach_session(db, session_data, current_coach.id)
    return CoachSessionResponse.from_orm(session)


@router.get("/sessions", response_model=list[CoachSessionResponse])
async def get_coach_sessions(
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Get all sessions for the current coach"""
    sessions = await coach_crud.get_coach_sessions(db, current_coach.id)
    return [CoachSessionResponse.from_orm(session) for session in sessions]


@router.get("/sessions/{session_id}", response_model=CoachSessionResponse)
async def get_session_details(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Get session details"""
    session = await coach_crud.get_coach_session_by_id(db, session_id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    if session.coach_id != current_coach.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this session",
        )

    return CoachSessionResponse.from_orm(session)


@router.patch("/sessions/{session_id}", response_model=CoachSessionResponse)
async def update_session(
    session_id: int,
    session_update: CoachSessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Update session details"""
    session = await coach_crud.get_coach_session_by_id(db, session_id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    if session.coach_id != current_coach.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this session",
        )

    updated = await coach_crud.update_coach_session(db, session_id, session_update)
    return CoachSessionResponse.from_orm(updated)


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Delete a session"""
    session = await coach_crud.get_coach_session_by_id(db, session_id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    if session.coach_id != current_coach.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this session",
        )

    success = await coach_crud.delete_coach_session(db, session_id)
    if success:
        return {"message": "Session deleted successfully"}
    return {"message": "Failed to delete session"}


# ============ COACH SESSION PARTICIPANTS ============


@router.post("/sessions/{session_id}/participants", response_model=CoachSessionParticipantResponse)
async def add_participant(
    session_id: int,
    participant_data: CoachSessionParticipantCreate,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Add a participant to a session"""
    session = await coach_crud.get_coach_session_by_id(db, session_id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    if session.coach_id != current_coach.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to add participants to this session",
        )

    participant = await coach_crud.add_session_participant(db, session_id, participant_data)
    return CoachSessionParticipantResponse.from_orm(participant)


@router.patch("/sessions/{session_id}/participants/{user_id}")
async def update_participant_status(
    session_id: int,
    user_id: int,
    status: str,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Update participant status in a session"""
    session = await coach_crud.get_coach_session_by_id(db, session_id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    if session.coach_id != current_coach.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update participants in this session",
        )

    participant = await coach_crud.update_participant_status(db, session_id, user_id, status)
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Participant not found",
        )

    return {"message": f"Participant status updated to {status}"}


@router.delete("/sessions/{session_id}/participants/{user_id}")
async def remove_participant(
    session_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Remove a participant from a session"""
    session = await coach_crud.get_coach_session_by_id(db, session_id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    if session.coach_id != current_coach.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to remove participants from this session",
        )

    success = await coach_crud.remove_session_participant(db, session_id, user_id)
    if success:
        return {"message": "Participant removed successfully"}
    return {"message": "Failed to remove participant"}


# ============ HELPER ENDPOINTS FOR SESSION CREATION ============


@router.get("/available-users/learners")
async def get_available_learners(
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Get all available learners for adding to sessions"""
    result = await db.execute(
        select(User)
        .where(User.role == UserRole.LEARNER)
        .where(User.is_active == True)
        .order_by(User.name)
    )
    users = result.scalars().all()
    
    return [
        {
            "id": user.id,
            "name": user.name,
            "role": user.role.value
        }
        for user in users
    ]


@router.get("/available-users/trainers")
async def get_available_trainers(
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Get all available trainers for adding to sessions"""
    result = await db.execute(
        select(User)
        .where(User.role == UserRole.TRAINER)
        .where(User.is_active == True)
        .order_by(User.name)
    )
    users = result.scalars().all()
    
    return [
        {
            "id": user.id,
            "name": user.name,
            "role": user.role.value
        }
        for user in users
    ]


@router.get("/available-users/heads")
async def get_available_heads(
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Get all available heads for adding to sessions"""
    result = await db.execute(
        select(User)
        .where(User.role == UserRole.HEAD)
        .where(User.is_active == True)
        .order_by(User.name)
    )
    users = result.scalars().all()
    
    return [
        {
            "id": user.id,
            "name": user.name,
            "role": user.role.value
        }
        for user in users
    ]


@router.get("/learning-contents")
async def get_learning_contents(
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Get all learning contents uploaded by admin"""
    result = await db.execute(
        select(LearningContent)
        .order_by(LearningContent.title)
    )
    contents = result.scalars().all()
    
    return [
        {
            "id": content.id,
            "title": content.title,
            "description": content.description,
            "file_path": content.file_path,
            "file_type": content.file_type,
            "created_at": content.created_at
        }
        for content in contents
    ]
