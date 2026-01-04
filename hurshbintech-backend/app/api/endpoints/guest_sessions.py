"""
Guest Session API Endpoints - Public endpoints for guest users to join sessions
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from datetime import datetime, timedelta
import logging
import uuid

from app.db.session import get_db
from app.models.user_model import Appointment, AppointmentStatus
from app.models.coach_session_model import CoachAppointmentSession
from app.schemas.guest_session import (
    GuestSessionAuthRequest,
    GuestSessionDetails
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/guest-sessions", tags=["guest-sessions"])


@router.post("/auth", response_model=GuestSessionDetails)
async def authenticate_guest_session(
    request: GuestSessionAuthRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate guest user with session token and return session details.
    This is a PUBLIC endpoint - no authentication required.
    
    Security:
    - Validates token exists and hasn't expired
    - Validates appointment is confirmed
    - Validates session exists and is active
    """
    # Find appointment by guest_session_token
    stmt = (
        select(Appointment)
        .options(
            joinedload(Appointment.coach).joinedload("user"),
            joinedload(Appointment.appointment_session)
        )
        .where(Appointment.guest_session_token == request.token)
    )
    
    result = await db.execute(stmt)
    appointment = result.unique().scalar_one_or_none()
    
    if not appointment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid session link. Please check your email for the correct link."
        )
    
    # Verify token hasn't expired
    if appointment.guest_session_token_expires_at:
        if datetime.utcnow() > appointment.guest_session_token_expires_at:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This session link has expired. Please contact your coach."
            )
    
    # Verify this is a guest appointment
    if not appointment.guest_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This link is only for guest users."
        )
    
    # Verify appointment is confirmed
    if appointment.status != AppointmentStatus.CONFIRMED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Appointment is not confirmed yet. Current status: {appointment.status.value}"
        )
    
    # Get the associated session
    session = appointment.appointment_session
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session has not been created yet. Please wait for your coach to start the session."
        )
    
    # Verify session is active or scheduled (not ended or cancelled)
    if session.status not in ["scheduled", "active"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Session is {session.status}. You can only join active sessions."
        )
    
    # Build response with session details
    coach_name = "Coach"
    if appointment.coach and appointment.coach.user:
        coach_name = appointment.coach.user.name
    
    return GuestSessionDetails(
        session_id=session.session_id,
        coach_name=coach_name,
        client_name=appointment.guest_name,
        scheduled_date=appointment.scheduled_date.isoformat(),
        scheduled_time=appointment.scheduled_time,
        duration=session.duration,
        status=session.status,
        appointment_id=appointment.id,
        guest_email=appointment.guest_email,
        guest_name=appointment.guest_name
    )


@router.get("/validate/{token}")
async def validate_guest_token(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Quick validation endpoint to check if a guest session token is valid.
    Returns basic info without full session details.
    """
    stmt = select(Appointment).where(Appointment.guest_session_token == token)
    result = await db.execute(stmt)
    appointment = result.scalar_one_or_none()
    
    if not appointment:
        return {"valid": False, "message": "Invalid token"}
    
    if appointment.guest_session_token_expires_at:
        if datetime.utcnow() > appointment.guest_session_token_expires_at:
            return {"valid": False, "message": "Token expired"}
    
    if appointment.status != AppointmentStatus.CONFIRMED:
        return {"valid": False, "message": "Appointment not confirmed"}
    
    return {
        "valid": True,
        "guest_name": appointment.guest_name,
        "scheduled_date": appointment.scheduled_date.isoformat(),
        "scheduled_time": appointment.scheduled_time
    }
