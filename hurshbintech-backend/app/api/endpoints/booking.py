"""
Booking endpoints for appointment scheduling with coaches.
Accessible by all authenticated users (head, trainer, learner).
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date

from app.core.deps import get_db, get_current_user
from app.models.user_model import User
from app.schemas.user import CoachResponse, AppointmentCreate, AppointmentResponse, AvailableSlotsResponse
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


@router.get("/slots/{coach_id}", response_model=AvailableSlotsResponse)
async def get_available_slots_for_coach(
    coach_id: int,
    date: date = Query(..., description="Date to check availability (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get available time slots for a specific coach on a given date.
    Returns only slots that are not already booked.
    
    Args:
        coach_id: ID of the coach
        date: Date to check (YYYY-MM-DD format)
    
    Returns:
        AvailableSlotsResponse with available, all, and booked slots
    """
    # Verify coach exists
    coach = await user_crud.get_coach_by_id(db, coach_id)
    if not coach:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Coach not found",
        )
    
    # Get available slots
    available_slots = await coach_crud.get_available_slots(db, coach_id, date)
    
    # Get all configured slots
    all_slots = []
    if coach.time_slots:
        all_slots = [slot.strip() for slot in coach.time_slots.split(',')]
    
    # Calculate booked slots
    booked_slots = [slot for slot in all_slots if slot not in available_slots]
    
    return AvailableSlotsResponse(
        coach_id=coach_id,
        date=date,
        available_slots=available_slots,
        all_slots=all_slots,
        booked_slots=booked_slots,
    )


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
    
    # ✅ CHECK SLOT AVAILABILITY - Prevent double-booking
    is_slot_available = await coach_crud.check_slot_availability(
        db, coach_id, scheduled_date, scheduled_time
    )
    
    if not is_slot_available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Time slot {scheduled_time} on {scheduled_date} is already booked. Please choose another slot.",
        )
    
    # Verify the slot is in coach's available time slots
    coach_slots = []
    if coach.time_slots:
        coach_slots = [slot.strip() for slot in coach.time_slots.split(',')]
    
    if scheduled_time not in coach_slots:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid time slot. Coach only offers: {', '.join(coach_slots)}",
        )
    
    # Handle payment screenshot upload if provided
    payment_screenshot_path = None
    if payment_screenshot and payment_screenshot.filename:
        import os
        import uuid
        from pathlib import Path
        from app.core.config import settings
        
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
        
        # Generate unique filename
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        
        if settings.USE_S3:
            # Upload to S3 - store in s3://bucket/key format
            from app.utils.s3_utils import S3Manager
            s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
            s3_key = s3_manager.upload_file(
                content,
                folder="payment_screenshots",
                filename=unique_filename,
                content_type=payment_screenshot.content_type or "image/jpeg",
            )
            payment_screenshot_path = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
        else:
            # Save to local uploads folder (fallback for development)
            upload_dir = Path("uploads/payment_screenshots")
            upload_dir.mkdir(parents=True, exist_ok=True)
            file_path = upload_dir / unique_filename
            
            with open(file_path, "wb") as f:
                f.write(content)
            
            payment_screenshot_path = f"/uploads/payment_screenshots/{unique_filename}"
    
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
    
    # Manually serialize date fields for Pydantic v2 compatibility
    return AppointmentResponse(
        id=appointment.id,
        coach_id=appointment.coach_id,
        user_id=appointment.user_id,
        user_role=appointment.user_role,
        scheduled_date=appointment.scheduled_date.isoformat() if isinstance(appointment.scheduled_date, date) else str(appointment.scheduled_date),
        scheduled_time=appointment.scheduled_time,
        status=appointment.status,
        notes=appointment.notes,
        user_name=appointment.user_name,
        session_type=appointment.session_type,
        payment_screenshot_url=appointment.payment_screenshot_url,
        created_at=appointment.created_at.isoformat() if hasattr(appointment.created_at, 'isoformat') else str(appointment.created_at),
        updated_at=appointment.updated_at.isoformat() if hasattr(appointment.updated_at, 'isoformat') else str(appointment.updated_at),
    )


@router.get("/my-appointments", response_model=List[AppointmentResponse])
async def get_my_appointments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all appointments booked by the current user.
    """
    appointments = await coach_crud.get_appointments_by_user(db, current_user.id)
    return [
        AppointmentResponse(
            id=apt.id,
            coach_id=apt.coach_id,
            user_id=apt.user_id,
            user_role=apt.user_role,
            scheduled_date=apt.scheduled_date.isoformat() if isinstance(apt.scheduled_date, date) else str(apt.scheduled_date),
            scheduled_time=apt.scheduled_time,
            status=apt.status,
            notes=apt.notes,
            user_name=apt.user_name,
            session_type=apt.session_type,
            payment_screenshot_url=apt.payment_screenshot_url,
            created_at=apt.created_at.isoformat() if hasattr(apt.created_at, 'isoformat') else str(apt.created_at),
            updated_at=apt.updated_at.isoformat() if hasattr(apt.updated_at, 'isoformat') else str(apt.updated_at),
        )
        for apt in appointments
    ]
