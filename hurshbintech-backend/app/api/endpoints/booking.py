"""
Booking endpoints for appointment scheduling with coaches.
Accessible by all authenticated users (head, trainer, learner).
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date

from app.core.deps import get_db, get_current_user
from app.models.user_model import User
from app.schemas.user import CoachResponse, AppointmentCreate, AppointmentResponse
from app.crud import user_crud, coach_crud

router = APIRouter()


@router.get("/available-coaches", response_model=List[CoachResponse])
async def get_available_coaches(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all available coaches for appointment booking.
    Accessible by any authenticated user (head, trainer, learner).
    """
    coaches = await user_crud.get_all_coaches_system_wide(db)
    return [CoachResponse.from_orm_with_user(coach) for coach in coaches]


@router.post("/book-appointment", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def book_appointment_with_coach(
    coach_id: int = Form(...),
    scheduled_date: date = Form(...),
    scheduled_time: str = Form(...),
    session_type: str = Form(...),
    notes: str = Form(None),
    payment_screenshot: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Book an appointment with a coach.
    Accessible by any authenticated user (head, trainer, learner).
    
    Args:
        coach_id: ID of the coach to book with
        scheduled_date: Date of the appointment (YYYY-MM-DD)
        scheduled_time: Time of the appointment (e.g., "10:00 AM")
        session_type: Type of session (initial, followup, extended)
        notes: Optional notes for the appointment
        payment_screenshot: Optional payment proof image
    
    Returns:
        AppointmentResponse: Created appointment details
    """
    # Verify coach exists and get their profile
    coach = await user_crud.get_coach_by_id(db, coach_id)
    if not coach:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coach not found",
        )
    
    # Check if coach is available for new appointments
    from datetime import datetime
    if not coach.is_available:
        reason = coach.unavailable_reason or "Coach is currently unavailable"
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Cannot schedule with this coach: {reason}",
        )
    
    # Check if unavailable_until has passed (auto-reset if needed)
    if coach.unavailable_until and datetime.utcnow() >= coach.unavailable_until:
        coach.is_available = True
        coach.unavailable_until = None
        coach.unavailable_reason = None
        await db.commit()
    
    # Handle payment screenshot upload if provided
    payment_screenshot_path = None
    if payment_screenshot and payment_screenshot.filename:
        import os
        from pathlib import Path
        
        # Validate file type
        allowed_extensions = {".jpg", ".jpeg", ".png", ".gif"}
        file_ext = os.path.splitext(payment_screenshot.filename)[1].lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}",
            )
        
        # Validate file size (max 5MB)
        content = await payment_screenshot.read()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size must be less than 5MB",
            )
        
        # Create uploads directory if it doesn't exist
        upload_dir = Path("uploads/payment_screenshots")
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        import uuid
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = upload_dir / unique_filename
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(content)
        
        payment_screenshot_path = str(file_path)
    
    # Create appointment data
    appointment_data = AppointmentCreate(
        coach_id=coach_id,
        scheduled_date=scheduled_date,
        scheduled_time=scheduled_time,
        notes=f"Session Type: {session_type}\n{notes if notes else ''}",
    )
    
    # Get current user's role
    user_role = current_user.role.value
    
    # Create the appointment
    appointment = await coach_crud.create_appointment(
        db, appointment_data, current_user.id, user_role
    )
    
    # If payment screenshot was uploaded, update appointment with payment info
    if payment_screenshot_path:
        # Note: You may want to add a payment_screenshot field to the Appointment model
        # For now, we can append it to notes
        appointment.notes = f"{appointment.notes}\nPayment Screenshot: {payment_screenshot_path}"
        await db.commit()
        await db.refresh(appointment)
    
    return AppointmentResponse.from_orm(appointment)


@router.get("/my-appointments", response_model=List[AppointmentResponse])
async def get_my_appointments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all appointments booked by the current user.
    """
    appointments = await coach_crud.get_appointments_by_user(db, current_user.id)
    return [AppointmentResponse.from_orm(apt) for apt in appointments]
