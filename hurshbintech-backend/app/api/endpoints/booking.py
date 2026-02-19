"""
Booking endpoints for appointment scheduling with coaches.
Accessible by all authenticated users (head, trainer, learner).
"""

import hashlib
import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from datetime import date, datetime
from datetime import timedelta
import logging
import uuid
import os
from pathlib import Path

from app.core.deps import get_db, get_current_user
from app.core.config import settings
from app.models.user_model import User, Appointment, AppointmentStatus, CoachProfile
from app.schemas.user import CoachResponse, AppointmentCreate, AppointmentResponse, AvailableSlotsResponse
from app.schemas.guest_booking import GuestIntentResponse, GuestPaymentUploadResponse
from app.crud import user_crud, coach_crud
from app.services.cache_service import cache_service
from app.services.email_service import EmailService
from app.utils.s3_utils import convert_s3_url_to_accessible

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/available-coaches", response_model=List[CoachResponse])
async def get_available_coaches(
    db: AsyncSession = Depends(get_db),
):
    """
    Get all available coaches for appointment booking.
    Public endpoint - accessible by authenticated users and guests.
    Cached for 30 minutes with pre-signed S3 URLs.
    """
    cache_key = cache_service.key_available_coaches()
    
    # Try cache first
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        logger.debug(f"Cache HIT: {cache_key}")
        return [CoachResponse(**item) for item in cached_data]
    
    logger.debug(f"Cache MISS: {cache_key}")
    coaches = await user_crud.get_all_coaches_system_wide(db)
    
    # Convert responses first
    responses = [CoachResponse.from_orm_with_user(coach) for coach in coaches]
    
    # Convert S3 profile pictures to signed URLs BEFORE caching
    # This way cached data already has signed URLs (valid for cache TTL)
    if settings.USE_S3:
        for coach_response in responses:
            if coach_response.profile_picture_url and coach_response.profile_picture_url.startswith('s3://'):
                coach_response.profile_picture_url = convert_s3_url_to_accessible(coach_response.profile_picture_url)
    
    # Cache responses with signed URLs for 30 minutes
    # Note: S3 signed URLs are valid for 1 hour by default, so 30min cache is safe
    await cache_service.set(cache_key, [r.model_dump() for r in responses], ttl=cache_service.TTL_COACH_PROFILES)
    
    return responses


@router.get("/slots/{coach_id}", response_model=AvailableSlotsResponse)
async def get_available_slots_for_coach(
    coach_id: int,
    date: date = Query(..., description="Date to check availability (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get available time slots for a specific coach on a given date.
    Returns only slots that are not already booked.
    Public endpoint - accessible by authenticated users and guests.
    
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
    
    # ✅ CHECK SLOT AVAILABILITY - Validate day, time, and prevent double-booking
    is_slot_available, availability_reason = await coach_crud.check_slot_availability(
        db, coach_id, scheduled_date, scheduled_time
    )
    
    if not is_slot_available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT if "already booked" in availability_reason else status.HTTP_400_BAD_REQUEST,
            detail=availability_reason,
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
    
    # Create appointment data with new columns
    appointment_data = AppointmentCreate(
        coach_id=coach_id,
        scheduled_date=scheduled_date,
        scheduled_time=scheduled_time,
        notes=notes if notes else None,
        session_type=session_type,
        payment_receipt_url=payment_screenshot_path,
    )
    
    # Get current user's role
    user_role = current_user.role.value
    
    # Create the appointment
    appointment = await coach_crud.create_appointment(
        db, appointment_data, current_user.id, user_role
    )
    
    # Send email notification to coach about new appointment request
    try:
        # Refresh coach object to ensure we have latest data with user relationship
        await db.refresh(coach)
        if coach and coach.user and coach.user.email:
            await EmailService.send_appointment_requested(
                recipient_email=coach.user.email,
                recipient_name=coach.user.name,
                client_name=current_user.name,
                scheduled_date=appointment.scheduled_date.strftime('%B %d, %Y') if isinstance(appointment.scheduled_date, date) else str(appointment.scheduled_date),
                scheduled_time=appointment.scheduled_time,
                session_type=appointment.session_type,
                appointment_id=appointment.id,
            )
    except Exception as email_error:
        # Log error but don't fail appointment creation
        import logging
        logging.error(f"Failed to send email notification: {str(email_error)}")
        print(f"Failed to send email notification: {str(email_error)}")
    
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
        user_name=appointment.user.name if appointment.user else None,
        session_type=appointment.session_type,
        payment_screenshot_url=appointment.payment_receipt_url,  # Return payment_receipt_url as payment_screenshot_url
        payment_receipt_url=appointment.payment_receipt_url,
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

    responses = []
    for apt in appointments:
        response = AppointmentResponse(
            id=apt.id,
            coach_id=apt.coach_id,
            user_id=apt.user_id,
            user_role=apt.user_role,
            scheduled_date=apt.scheduled_date.isoformat() if isinstance(apt.scheduled_date, date) else str(apt.scheduled_date),
            scheduled_time=apt.scheduled_time,
            status=apt.status,
            notes=apt.notes,
            user_name=apt.user.name if apt.user else None,
            session_type=apt.session_type,
            payment_screenshot_url=apt.payment_receipt_url,  # Return payment_receipt_url as payment_screenshot_url
            payment_receipt_url=apt.payment_receipt_url,
            rejection_reason=apt.rejection_reason,  # Reason for rejection
            refund_receipt_url=apt.refund_receipt_url,  # Refund receipt URL
            created_at=apt.created_at.isoformat() if hasattr(apt.created_at, 'isoformat') else str(apt.created_at),
            updated_at=apt.updated_at.isoformat() if hasattr(apt.updated_at, 'isoformat') else str(apt.updated_at),
        )

        # Convert S3 URLs to signed URLs if using S3
        if settings.USE_S3:
            if response.payment_screenshot_url and response.payment_screenshot_url.startswith('s3://'):
                response.payment_screenshot_url = convert_s3_url_to_accessible(response.payment_screenshot_url)
            if response.payment_receipt_url and response.payment_receipt_url.startswith('s3://'):
                response.payment_receipt_url = convert_s3_url_to_accessible(response.payment_receipt_url)
            if response.refund_receipt_url and response.refund_receipt_url.startswith('s3://'):
                response.refund_receipt_url = convert_s3_url_to_accessible(response.refund_receipt_url)

        responses.append(response)

    return responses


# ===== GUEST BOOKING ENDPOINTS (Public) =====

from app.services.otp_service import GuestOTPService
from app.schemas.guest_booking import (
    GuestOTPRequest, GuestOTPVerify, GuestIntentCreate, 
    GuestIntentResponse, GuestPaymentUploadResponse, CoachGuestApprovalResponse
)
from app.models.user_model import Appointment, AppointmentStatus
from app.models.guest_otp_model import GuestOTP
from sqlalchemy import select
from datetime import datetime, timedelta
import uuid


@router.post("/guest/send-otp")
async def send_guest_otp(
    request: Request,
    payload: GuestOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Send OTP to guest email for verification.
    No authentication required - public endpoint.
    
    Rate limiting: 3 OTPs per day per IP address.
    """
    email = payload.email.lower().strip()
    
    # Extract client IP address for rate limiting
    client_ip = request.client.host if request.client else None
    # Handle proxied requests (check X-Forwarded-For header)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    
    try:
        # Generate OTP (6-digit code, 10-minute expiry) with rate limiting
        otp_code = await GuestOTPService.generate_otp(email, db, ip_address=client_ip)
        
        # Send via email service
        await EmailService.send_guest_otp_email(email, otp_code)
        
        return {"message": f"OTP sent to {email}. Valid for 10 minutes."}
    
    except HTTPException as http_err:
        # Re-raise HTTP exceptions (e.g., rate limit exceeded)
        raise http_err
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Failed to send OTP: {str(err)}")


@router.post("/guest/verify-otp")
async def verify_guest_otp(
    email: str = Form(...),
    otp: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Verify OTP is valid (without marking as used).
    Used in Step 1 to confirm OTP before proceeding to booking details.
    No authentication required - public endpoint.
    """
    email = email.lower().strip()
    otp = otp.strip()
    
    # Debug logging
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Verifying OTP for email: {email}, otp: {otp}")
    
    # Check if OTP is valid (doesn't mark as used)
    from sqlalchemy import and_
    stmt = select(GuestOTP).where(
        and_(
            GuestOTP.email == email,
            GuestOTP.otp_code == otp,
            GuestOTP.expires_at > datetime.utcnow(),
            GuestOTP.is_used == False
        )
    )
    result = await db.execute(stmt)
    otp_record = result.scalar_one_or_none()
    
    if not otp_record:
        # Additional debug: find any OTP for this email
        debug_stmt = select(GuestOTP).where(GuestOTP.email == email).order_by(GuestOTP.created_at.desc())
        debug_result = await db.execute(debug_stmt)
        debug_record = debug_result.scalar_one_or_none()
        if debug_record:
            logger.warning(f"OTP mismatch - DB has: code={debug_record.otp_code}, expires_at={debug_record.expires_at}, is_used={debug_record.is_used}, now={datetime.utcnow()}")
        else:
            logger.warning(f"No OTP record found for email: {email}")
        raise HTTPException(status_code=400, detail="Wrong OTP. Please check and try again.")
    
    return {"message": "OTP verified successfully"}


@router.post("/guest/verify-otp-and-create-intent", response_model=GuestIntentResponse)
async def verify_otp_and_create_guest_intent(
    email: str = Form(...),
    otp: str = Form(...),
    guest_name: str = Form(...),
    guest_phone: str = Form(...),
    coach_id: int = Form(...),
    scheduled_date: date = Form(...),
    scheduled_time: str = Form(...),
    session_type: str = Form(...),
    notes: str = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Create GUEST_INTENT appointment.
    OTP should already be verified in Step 1.
    Guest will appear on coach dashboard for review/approval.
    No authentication required - uses OTP token instead.
    
    Flow:
    1. Mark OTP as used
    2. Check coach exists
    3. Verify slot availability
    4. Create appointment with GUEST_INTENT status
    5. Email coach with request details
    """
    email = email.lower().strip()
    
    # Step 1: Mark OTP as used (it was already verified in Step 1)
    try:
        from sqlalchemy import and_
        stmt = select(GuestOTP).where(
            and_(
                GuestOTP.email == email,
                GuestOTP.otp_code == otp,
                GuestOTP.is_used == False
            )
        )
        result = await db.execute(stmt)
        otp_record = result.scalar_one_or_none()
        
        if otp_record:
            otp_record.is_used = True
            await db.commit()
    except Exception:
        pass  # OTP already used or doesn't exist, continue anyway
    
    # Step 2: Verify coach exists
    coach = await user_crud.get_coach_by_id(db, coach_id)
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")
    
    # Step 3: Check slot availability
    is_available, reason = await coach_crud.check_slot_availability(
        db, coach_id, scheduled_date, scheduled_time
    )
    if not is_available:
        raise HTTPException(status_code=409, detail=reason)
    
    # Step 4: Create GUEST_INTENT appointment (user_id=None)
    appointment = Appointment(
        coach_id=coach_id,
        user_id=None,  # No authenticated user for guest
        user_role=None,
        guest_name=guest_name,
        guest_email=email,
        guest_phone=guest_phone,
        scheduled_date=scheduled_date,
        scheduled_time=scheduled_time,
        session_type=session_type,
        notes=notes,
        status=AppointmentStatus.GUEST_INTENT  # Awaiting coach review
    )
    db.add(appointment)
    await db.commit()
    await db.refresh(appointment)
    
    # Step 5: Email coach about guest request
    try:
        coach_user = coach.user
        await EmailService.send_guest_intent_notification_to_coach(
            coach_email=coach_user.email,
            coach_name=coach_user.name,
            guest_name=guest_name,
            guest_email=email,
            appointment_id=appointment.id,
            scheduled_date=scheduled_date,
            scheduled_time=scheduled_time
        )
    except Exception as err:
        # Log error but don't fail if email fails
        logger.error(f"Failed to send guest intent notification email: {str(err)}", exc_info=True)
    
    return GuestIntentResponse.from_orm(appointment)


@router.get("/guest/validate-token/{upload_token}", response_model=AppointmentResponse)
async def validate_payment_token(
    upload_token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Validate payment upload token and return appointment details.
    No authentication required - token-based access.
    
    Used by frontend to:
    1. Validate token on payment upload page load
    2. Show appointment details to guest
    3. Check token expiry time
    """
    
    # Find appointment by upload_token and check if it's valid
    stmt = select(Appointment).where(
        Appointment.upload_token == upload_token,
        Appointment.status == AppointmentStatus.VERIFICATION_PENDING,  # Token valid for VERIFICATION_PENDING status
        Appointment.upload_token_expires_at > datetime.utcnow()
    )
    result = await db.execute(stmt)
    appointment = result.scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(status_code=401, detail="Invalid or expired payment link")
    
    return AppointmentResponse(
        id=appointment.id,
        coach_id=appointment.coach_id,
        user_id=appointment.user_id,
        user_role=appointment.user_role,
        scheduled_date=appointment.scheduled_date.isoformat() if isinstance(appointment.scheduled_date, date) else str(appointment.scheduled_date),
        scheduled_time=appointment.scheduled_time,
        status=appointment.status.value,
        notes=appointment.notes,
        user_name=appointment.guest_name if appointment.guest_name else (appointment.user.name if appointment.user else None),
        session_type=appointment.session_type,
        payment_screenshot_url=appointment.payment_receipt_url,
        payment_receipt_url=appointment.payment_receipt_url,
        rejection_reason=appointment.rejection_reason,
        refund_receipt_url=appointment.refund_receipt_url,
        created_at=appointment.created_at.isoformat() if hasattr(appointment.created_at, 'isoformat') else str(appointment.created_at),
        updated_at=appointment.updated_at.isoformat() if hasattr(appointment.updated_at, 'isoformat') else str(appointment.updated_at),
        guest_name=appointment.guest_name,
        guest_email=appointment.guest_email,
        guest_phone=appointment.guest_phone,
        upload_token_expires_at=(appointment.upload_token_expires_at.isoformat().replace('+00:00', 'Z')) if hasattr(appointment.upload_token_expires_at, 'isoformat') else str(appointment.upload_token_expires_at),
    )


@router.post("/guest/upload-payment/{upload_token}", response_model=GuestPaymentUploadResponse)
async def guest_upload_payment(
    upload_token: str,
    payment_screenshot: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Guest uploads payment screenshot using secure token.
    No authentication required - token-based access.
    
    Security:
    - Token is UUID, unique, and time-limited (24 hours)
    - Token is invalidated after first use
    - Appointment status validated
    
    Flow:
    1. Find appointment by upload_token
    2. Verify token is valid and not expired
    3. Upload file to S3 or local storage
    4. Update appointment status to VERIFICATION_PENDING
    5. Invalidate token
    6. Email coach to review payment
    """
    
    # Step 1-2: Find and validate token (eagerly load coach and user)
    stmt = select(Appointment).options(
        joinedload(Appointment.coach).joinedload(CoachProfile.user)
    ).where(
        Appointment.upload_token == upload_token,
        Appointment.status == AppointmentStatus.VERIFICATION_PENDING,
        Appointment.upload_token_expires_at > datetime.utcnow()
    )
    result = await db.execute(stmt)
    appointment = result.unique().scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(status_code=401, detail="Invalid or expired upload token")
    
    # Step 3: Upload payment screenshot
    try:
        # Read file content
        content = await payment_screenshot.read()
        
        # Validate file type
        allowed_types = {'image/jpeg', 'image/png', 'application/pdf'}
        if payment_screenshot.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File type not allowed. Only JPG, PNG, and PDF are supported.",
            )
        
        # Validate file size (max 5MB)
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size must be less than 5MB",
            )
        
        # Get file extension
        ext = Path(payment_screenshot.filename).suffix if payment_screenshot.filename else '.pdf'
        unique_filename = f"payment_{appointment.id}_{uuid.uuid4().hex}{ext}"
        
        if settings.USE_S3:
            # Upload to S3
            from app.utils.s3_utils import S3Manager
            s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
            s3_key = s3_manager.upload_file(
                content,
                folder="payment_receipts/guest",
                filename=unique_filename,
                content_type=payment_screenshot.content_type or "application/octet-stream",
            )
            file_url = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
        else:
            # Save to local uploads folder (fallback for development)
            upload_dir = Path("uploads/payment_receipts")
            upload_dir.mkdir(parents=True, exist_ok=True)
            file_path = upload_dir / unique_filename
            
            with open(file_path, "wb") as f:
                f.write(content)
            
            file_url = f"/uploads/payment_receipts/{unique_filename}"
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"File upload error: {str(err)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(err)}")
    
    # Step 4: Update appointment
    appointment.payment_receipt_url = file_url
    appointment.status = AppointmentStatus.VERIFICATION_PENDING  # Coach reviews
    appointment.upload_token = None  # Invalidate token
    appointment.upload_token_expires_at = None
    
    await db.commit()
    
    # Step 5: Email coach
    try:
        coach_user = appointment.coach.user
        await EmailService.send_guest_payment_uploaded_notification_to_coach(
            coach_email=coach_user.email,
            coach_name=coach_user.name,
            guest_name=appointment.guest_name,
            appointment_id=appointment.id
        )
        logger.info(f"Payment upload notification sent to coach for appointment {appointment.id}")
    except Exception as err:
        logger.error(f"Failed to send payment notification email: {str(err)}", exc_info=True)
    
    return GuestPaymentUploadResponse(
        message="Payment uploaded successfully. Coach will review shortly.",
        appointment_id=appointment.id
    )

