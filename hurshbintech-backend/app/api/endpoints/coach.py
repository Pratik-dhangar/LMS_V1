"""
Coach endpoints - Profile picture upload, appointments, and sessions
Accessible by coaches and their heads
"""

import logging
import os
import uuid
from datetime import date, datetime, timedelta
from typing import Optional
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_coach
from app.core.config import settings
from app.crud import coach_crud
from app.crud import user_crud
from app.db.session import get_db
from app.models.learning_content_model import LearningContent
from app.models.user_model import CoachProfile, User, UserRole, Appointment, AppointmentStatus
from app.services.email_service import EmailService
from app.utils.s3_utils import convert_s3_url_to_signed
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
logger = logging.getLogger(__name__)


# ============ PROFILE PICTURE UPLOAD ============


@router.post("/profile-picture/upload")
async def upload_profile_picture(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """
    Upload profile picture for coach
    Saves to S3 if USE_S3=true, otherwise saves locally
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
        if settings.USE_S3:
            # Save to S3 - store in s3://bucket/key format
            from app.utils.s3_utils import S3Manager

            s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
            await file.seek(0)  # Reset file pointer
            file_content = await file.read()
            s3_key = s3_manager.upload_file(
                file_content,
                folder="profile_pictures",
                filename=filename,
                content_type=file.content_type or "image/jpeg",
            )
            file_url = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
            
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
    unavailable_from: Optional[str] = None,  # ISO format date string
    unavailable_until: Optional[str] = None,  # ISO format date string
    unavailable_reason: Optional[str] = None,
    availability_days: Optional[str] = None,  # "Monday, Wednesday, Friday"
    time_slots: Optional[str] = None,  # "10am, 1pm, 3pm"
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """
    Update coach availability status and schedule
    
    When is_available=False, users cannot schedule appointments with this coach.
    Optionally set unavailable_from/until (ISO date format), reason, working days, and time slots.
    """
    from datetime import datetime
    
    try:
        # Update availability status
        current_coach.is_available = is_available
        current_coach.unavailable_reason = unavailable_reason
        
        # Parse unavailable_from if provided
        if unavailable_from and not is_available:
            try:
                # Handle both date and datetime formats
                if 'T' in unavailable_from:
                    current_coach.unavailable_from = datetime.fromisoformat(unavailable_from)
                else:
                    current_coach.unavailable_from = datetime.fromisoformat(unavailable_from + "T00:00:00")
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid datetime format for unavailable_from. Use ISO format (e.g., 2025-12-25 or 2025-12-25T18:00:00)",
                )
        elif is_available:
            current_coach.unavailable_from = None
        
        # Parse unavailable_until if provided
        if unavailable_until and not is_available:
            try:
                # Handle both date and datetime formats
                if 'T' in unavailable_until:
                    current_coach.unavailable_until = datetime.fromisoformat(unavailable_until)
                else:
                    current_coach.unavailable_until = datetime.fromisoformat(unavailable_until + "T23:59:59")
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid datetime format for unavailable_until. Use ISO format (e.g., 2025-12-25 or 2025-12-25T18:00:00)",
                )
        elif is_available:
            # Clear unavailable fields when marking as available
            current_coach.unavailable_until = None
            current_coach.unavailable_reason = None
        
        # Update availability days
        if availability_days:
            # Normalize the comma-separated days
            current_coach.availability_days = ', '.join([day.strip() for day in availability_days.split(',')])
        
        # Update time slots
        if time_slots:
            # Normalize the comma-separated times
            current_coach.time_slots = ', '.join([slot.strip() for slot in time_slots.split(',')])
        
        await db.commit()
        await db.refresh(current_coach)
        
        return {
            "message": f"Availability updated to {'available' if is_available else 'unavailable'}",
            "is_available": current_coach.is_available,
            "unavailable_from": current_coach.unavailable_from,
            "unavailable_until": current_coach.unavailable_until,
            "unavailable_reason": current_coach.unavailable_reason,
            "availability_days": current_coach.availability_days,
            "time_slots": current_coach.time_slots,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update availability: {str(e)}",
        )


@router.get("/availability")
async def get_current_coach_availability(
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """
    Get current coach's availability settings (authenticated endpoint)
    
    Returns the logged-in coach's availability status and schedule.
    """
    from datetime import datetime
    
    # Check if unavailable_until has passed
    is_currently_available = current_coach.is_available
    if current_coach.unavailable_until and datetime.utcnow() >= current_coach.unavailable_until:
        # Auto-reset availability
        current_coach.is_available = True
        current_coach.unavailable_until = None
        current_coach.unavailable_reason = None
        await db.commit()
        is_currently_available = True
    
    return {
        "coach_id": current_coach.id,
        "coach_name": current_coach.user.name,
        "is_available": is_currently_available,
        "unavailable_from": current_coach.unavailable_from,
        "unavailable_until": current_coach.unavailable_until,
        "unavailable_reason": current_coach.unavailable_reason,
        "availability_days": current_coach.availability_days,
        "time_slots": current_coach.time_slots,
    }


@router.get("/availability/public/{coach_id}")
async def get_coach_availability_public(
    coach_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get coach availability status by ID (public endpoint)
    
    Returns whether a coach is currently available to accept appointments.
    Used by appointment booking system and coach profile pages.
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
        "unavailable_from": coach.unavailable_from,
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


@router.get("/appointments", response_model=list[AppointmentResponse])
async def get_coach_appointments(
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Get all appointments for the current coach with user details"""
    appointments = await coach_crud.get_appointments_by_coach(db, current_coach.id)
    
    # Add user name and new column data to each appointment
    result = []
    for apt in appointments:
        apt_dict = {
            "id": apt.id,
            "coach_id": apt.coach_id,
            "user_id": apt.user_id,
            "user_role": apt.user_role,
            "scheduled_date": apt.scheduled_date.isoformat() if apt.scheduled_date else None,
            "scheduled_time": apt.scheduled_time,
            "status": apt.status.value,  # Extract UPPERCASE value from enum
            "notes": apt.notes,
            # For guest appointments: use guest_name; for authenticated: use user.name
            "user_name": apt.guest_name if apt.guest_name else (apt.user.name if apt.user else None),
            "session_type": apt.session_type,  # Read directly from column
            "payment_screenshot_url": apt.payment_receipt_url,  # Return payment_receipt_url as payment_screenshot_url for frontend
            "payment_receipt_url": apt.payment_receipt_url,  # Also include in response
            "rejection_reason": apt.rejection_reason,  # Reason for appointment rejection
            "refund_receipt_url": apt.refund_receipt_url,  # URL to refund receipt
            "created_at": apt.created_at.isoformat() if apt.created_at else None,
            "updated_at": apt.updated_at.isoformat() if apt.updated_at else None,
        }
        
        response = AppointmentResponse(**apt_dict)
        
        # Convert S3 URLs to signed URLs if using S3
        if settings.USE_S3:
            if response.payment_screenshot_url and response.payment_screenshot_url.startswith('s3://'):
                response.payment_screenshot_url = convert_s3_url_to_signed(response.payment_screenshot_url)
            if response.payment_receipt_url and response.payment_receipt_url.startswith('s3://'):
                response.payment_receipt_url = convert_s3_url_to_signed(response.payment_receipt_url)
            if response.refund_receipt_url and response.refund_receipt_url.startswith('s3://'):
                response.refund_receipt_url = convert_s3_url_to_signed(response.refund_receipt_url)
        
        result.append(response)
    
    return result


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

    response = AppointmentResponse(
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
        payment_screenshot_url=appointment.payment_receipt_url,
        payment_receipt_url=appointment.payment_receipt_url,
        created_at=appointment.created_at.isoformat() if hasattr(appointment.created_at, 'isoformat') else str(appointment.created_at),
        updated_at=appointment.updated_at.isoformat() if hasattr(appointment.updated_at, 'isoformat') else str(appointment.updated_at),
    )
    
    # Convert S3 URLs to signed URLs if using S3
    if settings.USE_S3:
        if response.payment_screenshot_url and response.payment_screenshot_url.startswith('s3://'):
            response.payment_screenshot_url = convert_s3_url_to_signed(response.payment_screenshot_url)
        if response.payment_receipt_url and response.payment_receipt_url.startswith('s3://'):
            response.payment_receipt_url = convert_s3_url_to_signed(response.payment_receipt_url)
    
    return response


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

    # Store previous status for email logic
    previous_status = appointment.status.value  # Already UPPERCASE
    
    # Special handling for guest booking approval (GUEST_INTENT)
    # Coach tries to change to CONFIRMED, but we intercept and change to VERIFICATION_PENDING
    if appointment.guest_name and previous_status == "GUEST_INTENT" and appointment_update.status and appointment_update.status.upper() == "CONFIRMED":
        logger.info(f"Coach approving guest booking {appointment_id} for {appointment.guest_name}")
        
        # Change status to VERIFICATION_PENDING (waiting for guest to upload payment)
        from app.models.user_model import AppointmentStatus
        appointment.status = AppointmentStatus.VERIFICATION_PENDING
        
        # Generate token and send email
        upload_token = str(uuid.uuid4())
        upload_token_expires_at = datetime.utcnow() + timedelta(hours=24)
        
        # Update appointment with token
        appointment.upload_token = upload_token
        appointment.upload_token_expires_at = upload_token_expires_at
        await db.commit()
        await db.refresh(appointment)
        
        # Construct payment upload URL
        upload_url = f"{settings.FRONTEND_URL}/guest-payment/{upload_token}"
        
        # Send email to guest with payment upload link
        try:
            await EmailService.send_payment_upload_link_to_guest(
                guest_email=appointment.guest_email,
                guest_name=appointment.guest_name,
                upload_url=upload_url,
                token_expires_in_hours=24,
                coach_name=current_coach.user.name if current_coach.user else "Coach"
            )
            logger.info(f"Payment upload link sent to guest {appointment.guest_email}")
        except Exception as e:
            logger.error(f"Failed to send payment upload link: {str(e)}", exc_info=True)
        
        # Return response with VERIFICATION_PENDING status (payment link sent, waiting for upload)
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
            upload_token_expires_at=appointment.upload_token_expires_at.isoformat() if hasattr(appointment.upload_token_expires_at, 'isoformat') else str(appointment.upload_token_expires_at),
        )
    
    # Normal status update for non-guest appointments or other status changes
    updated = await coach_crud.update_appointment(db, appointment_id, appointment_update)
    
    # Capture new status safely
    new_status = updated.status.value  # Already UPPERCASE

    # Debug log to help verify what's happening
    logger.info(f"Appointment {appointment_id} update: '{previous_status}' -> '{new_status}'")
    
    # Handle guest payment confirmation (VERIFICATION_PENDING → CONFIRMED)
    if updated.guest_name and previous_status == "VERIFICATION_PENDING" and new_status == "CONFIRMED":
        logger.info(f"Confirming payment for guest booking {appointment_id}")
        
        # Generate guest session token (valid for 7 days or until session ends)
        guest_session_token = str(uuid.uuid4())
        updated.guest_session_token = guest_session_token
        updated.guest_session_token_expires_at = datetime.utcnow() + timedelta(days=7)
        await db.commit()
        await db.refresh(updated)
        
        # Build guest session link
        guest_session_link = f"{settings.FRONTEND_URL}/guest-session/{guest_session_token}"
        
        # Send confirmation email to guest WITH session link
        try:
            await EmailService.send_guest_appointment_confirmed_with_session_link(
                recipient_email=updated.guest_email,
                recipient_name=updated.guest_name,
                coach_name=current_coach.user.name if current_coach.user else "Coach",
                scheduled_date=updated.scheduled_date.isoformat() if isinstance(updated.scheduled_date, date) else str(updated.scheduled_date),
                scheduled_time=updated.scheduled_time,
                session_type=updated.session_type,
                appointment_id=updated.id,
                session_link=guest_session_link,
            )
            logger.info(f"Confirmation email with session link sent to guest {updated.guest_email}")
        except Exception as e:
            logger.error(f"Failed to send confirmation email to guest: {str(e)}", exc_info=True)
    
    # Handle authenticated user confirmation (PENDING → CONFIRMED)
    elif updated.user and previous_status not in ["CONFIRMED", "ACCEPTED"] and new_status in ["CONFIRMED", "ACCEPTED"]:
        user_email = updated.user.email if updated.user else None
        user_name = updated.user.name if updated.user else "User"
        
        if not user_email:
            logger.warning(f"Cannot send confirmation email - User {user_name} (ID: {updated.user_id}) has no email address")
        else:
            logger.info(f"Sending confirmation email to: {user_email} (User: {user_name}) for appointment {updated.id}")
            email_sent = await EmailService.send_appointment_confirmed(
                recipient_email=user_email,
                recipient_name=user_name,
                coach_name=current_coach.user.name if current_coach.user else "Coach",
                scheduled_date=updated.scheduled_date.isoformat() if isinstance(updated.scheduled_date, date) else str(updated.scheduled_date),
                scheduled_time=updated.scheduled_time,
                session_type=updated.session_type,
                appointment_id=updated.id,
            )
            if email_sent:
                logger.info(f"Confirmation email sent successfully to {user_email}")
            else:
                logger.warning(f"Failed to send confirmation email to {user_email}")
    
    return AppointmentResponse(
        id=updated.id,
        coach_id=updated.coach_id,
        user_id=updated.user_id,
        user_role=updated.user_role,
        scheduled_date=updated.scheduled_date.isoformat() if isinstance(updated.scheduled_date, date) else str(updated.scheduled_date),
        scheduled_time=updated.scheduled_time,
        status=updated.status.value,  # Use .value to get UPPERCASE string
        notes=updated.notes,
        # For guest appointments: use guest_name; for authenticated: use user.name
        user_name=updated.guest_name if updated.guest_name else (updated.user.name if updated.user else None),
        session_type=updated.session_type,
        payment_screenshot_url=updated.payment_receipt_url,  # Return payment_receipt_url as payment_screenshot_url
        payment_receipt_url=updated.payment_receipt_url,
        rejection_reason=updated.rejection_reason,
        refund_receipt_url=updated.refund_receipt_url,
        created_at=updated.created_at.isoformat() if hasattr(updated.created_at, 'isoformat') else str(updated.created_at),
        updated_at=updated.updated_at.isoformat() if hasattr(updated.updated_at, 'isoformat') else str(updated.updated_at),
    )


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


@router.post("/appointments/{appointment_id}/reject", response_model=AppointmentResponse)
async def reject_appointment(
    appointment_id: int,
    rejection_reason: str = Form(None),
    refund_receipt: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """
    Reject an appointment with a reason and optional refund receipt
    """
    appointment = await coach_crud.get_appointment_by_id(db, appointment_id)

    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )

    if appointment.coach_id != current_coach.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to reject this appointment",
        )

    # Handle refund receipt upload if provided
    refund_receipt_path = None
    if refund_receipt and refund_receipt.filename:
        import uuid

        # Validate file type
        allowed_extensions = {".jpg", ".jpeg", ".png", ".gif"}
        file_ext = os.path.splitext(refund_receipt.filename)[1].lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}",
            )

        # Validate file size (max 5MB)
        content = await refund_receipt.read()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size must be less than 5MB",
            )

        # Generate unique filename
        unique_filename = f"{uuid.uuid4()}{file_ext}"

        if settings.USE_S3:
            # Upload to S3
            from app.utils.s3_utils import S3Manager

            s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
            s3_key = s3_manager.upload_file(
                content,
                folder="refund_receipts",
                filename=unique_filename,
                content_type=refund_receipt.content_type or "image/jpeg",
            )
            refund_receipt_path = f"s3://{settings.S3_BUCKET_NAME}/{s3_key}"
        else:
            # Save to local uploads folder
            upload_dir = Path("uploads/refund_receipts")
            upload_dir.mkdir(parents=True, exist_ok=True)
            file_path = upload_dir / unique_filename

            with open(file_path, "wb") as f:
                f.write(content)

            refund_receipt_path = f"/uploads/refund_receipts/{unique_filename}"

    # Update appointment with rejection info
    appointment_update = AppointmentUpdate(
        status="REJECTED",
        rejection_reason=rejection_reason,
        refund_receipt_url=refund_receipt_path,
    )
    updated = await coach_crud.update_appointment(db, appointment_id, appointment_update)

    # Send rejection email - use rejection_reason from DB if available, otherwise use provided reason
    final_rejection_reason = updated.rejection_reason or rejection_reason
    
    # Handle guest rejection
    if updated.guest_name and updated.guest_email:
        logger.info(f"Sending rejection email to guest: {updated.guest_email} for appointment {updated.id}")
        try:
            await EmailService.send_appointment_rejected(
                recipient_email=updated.guest_email,
                recipient_name=updated.guest_name,
                coach_name=current_coach.user.name if current_coach.user else "Coach",
                rejection_reason=final_rejection_reason,
                scheduled_date=updated.scheduled_date.isoformat() if isinstance(updated.scheduled_date, date) else str(updated.scheduled_date),
                scheduled_time=updated.scheduled_time,
                appointment_id=updated.id,
            )
            logger.info(f"Rejection email sent successfully to guest {updated.guest_email}")
        except Exception as e:
            logger.error(f"Failed to send rejection email to guest: {str(e)}", exc_info=True)
    # Handle authenticated user rejection
    else:
        user_email = updated.user.email if updated.user else None
        user_name = updated.user.name if updated.user else "User"
        
        if not user_email:
            logger.warning(f"Cannot send rejection email - User {user_name} (ID: {updated.user_id}) has no email address")
        else:
            logger.info(f"Sending rejection email to: {user_email} (User: {user_name}) for appointment {updated.id}")
            email_sent = await EmailService.send_appointment_rejected(
                recipient_email=user_email,
                recipient_name=user_name,
                coach_name=current_coach.user.name if current_coach.user else "Coach",
                rejection_reason=final_rejection_reason,
                scheduled_date=updated.scheduled_date.isoformat() if isinstance(updated.scheduled_date, date) else str(updated.scheduled_date),
                scheduled_time=updated.scheduled_time,
                appointment_id=updated.id,
            )
            if email_sent:
                logger.info(f"Rejection email sent successfully to {user_email}")
            else:
                logger.warning(f"Failed to send rejection email to {user_email}")

    return AppointmentResponse(
        id=updated.id,
        coach_id=updated.coach_id,
        user_id=updated.user_id,
        user_role=updated.user_role,
        scheduled_date=updated.scheduled_date.isoformat() if isinstance(updated.scheduled_date, date) else str(updated.scheduled_date),
        scheduled_time=updated.scheduled_time,
        status=updated.status.value,  # Use .value to get UPPERCASE string
        notes=updated.notes,
        # For guest appointments: use guest_name; for authenticated: use user.name
        user_name=updated.guest_name if updated.guest_name else (updated.user.name if updated.user else None),
        session_type=updated.session_type,
        payment_screenshot_url=updated.payment_receipt_url,
        payment_receipt_url=updated.payment_receipt_url,
        rejection_reason=updated.rejection_reason,
        refund_receipt_url=updated.refund_receipt_url,
        created_at=updated.created_at.isoformat() if hasattr(updated.created_at, 'isoformat') else str(updated.created_at),
        updated_at=updated.updated_at.isoformat() if hasattr(updated.updated_at, 'isoformat') else str(updated.updated_at),
    )


# ============ GUEST BOOKING APPROVAL ============


@router.post("/appointments/{appointment_id}/approve-guest-intent", response_model=dict)
async def coach_approve_guest_intent(
    appointment_id: int,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """
    Coach approves guest booking intent.
    
    Generates a 24-hour upload token and emails guest the payment upload link.
    Status: GUEST_INTENT (unchanged - guest must upload payment first)
    
    Security:
    - Verifies current user is the coach assigned to appointment
    - Verifies appointment is in GUEST_INTENT status
    - Generates UUID token (cryptographically secure)
    - Token expires in 24 hours
    """
    from app.models.user_model import Appointment, AppointmentStatus
    from datetime import datetime, timedelta
    import uuid
    
    # Find appointment
    appointment = await coach_crud.get_appointment_by_id(db, appointment_id)
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )
    
    if appointment.status != AppointmentStatus.GUEST_INTENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Can only approve guest intents. Current status: {appointment.status}",
        )
    
    if appointment.coach_id != current_coach.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to approve this appointment",
        )
    
    # Generate secure upload token (UUID)
    upload_token = str(uuid.uuid4())
    appointment.upload_token = upload_token
    appointment.upload_token_expires_at = datetime.utcnow() + timedelta(hours=24)
    # Keep status as GUEST_INTENT - don't change it
    
    await db.commit()
    
    # Email guest with payment upload link
    try:
        upload_url = f"{settings.FRONTEND_URL}/guest-payment/{upload_token}"
        await EmailService.send_payment_upload_link_to_guest(
            guest_email=appointment.guest_email,
            guest_name=appointment.guest_name,
            upload_url=upload_url,
            token_expires_in_hours=24,
            coach_name=current_coach.user.name if current_coach.user else "Coach"
        )
    except Exception as err:
        logger.warning(f"Failed to send upload link email: {str(err)}")
    
    return {
        "message": "Guest intent approved. Payment upload link sent to guest.",
        "appointment_id": appointment.id,
        "upload_url": f"{settings.FRONTEND_URL}/guest-payment/{upload_token}",
        "token_expires_in_hours": 24
    }


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
            "file_url": content.file_url,
            "content_type": content.content_type.value if hasattr(content.content_type, 'value') else content.content_type,
            "created_at": content.created_at
        }
        for content in contents
    ]
