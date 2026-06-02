"""
Coach Appointment Session CRUD Operations
Handles one-on-one sessions created from appointments
"""

import logging
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.coach_session_model import CoachAppointmentSession
from app.models.user_model import Appointment, CoachProfile, User
from app.schemas.coach_session import CoachSessionCreate

logger = logging.getLogger(__name__)


def _infer_duration_from_session_type(session_type: Optional[str]) -> int:
    """Infer the appointment duration from the stored session type label."""
    if not session_type:
        return 60

    normalized_session_type = session_type.strip().lower()

    if "functional assessment" in normalized_session_type:
        return 90

    if "90" in normalized_session_type:
        return 90

    if "60" in normalized_session_type:
        return 60

    return 60


async def create_session_from_appointment(
    db: AsyncSession, 
    session_data: CoachSessionCreate,
    coach_id: int
) -> CoachAppointmentSession:
    """
    Create a coach session from a confirmed appointment
    
    Args:
        db: Database session
        session_data: Session creation data with appointment_id
        coach_id: ID of the coach creating the session (for validation)
        
    Returns:
        Created CoachAppointmentSession
    """
    # Get appointment details
    appointment_result = await db.execute(
        select(Appointment)
        .options(
            joinedload(Appointment.coach),
            joinedload(Appointment.user)
        )
        .where(Appointment.id == session_data.appointment_id)
    )
    appointment = appointment_result.unique().scalar_one_or_none()
    
    if not appointment:
        raise ValueError(f"Appointment {session_data.appointment_id} not found")
    
    # Verify the coach owns this appointment
    if appointment.coach_id != coach_id:
        raise ValueError(f"Appointment {session_data.appointment_id} does not belong to this coach")
    
    # Check appointment status - must be CONFIRMED
    from app.models.user_model import AppointmentStatus
    if appointment.status != AppointmentStatus.CONFIRMED:
        raise ValueError(f"Appointment must be CONFIRMED to create a session. Current status: {appointment.status.value}")
    
    # Check if session already exists for this appointment
    existing_session = await db.execute(
        select(CoachAppointmentSession)
        .where(CoachAppointmentSession.appointment_id == session_data.appointment_id)
    )
    if existing_session.scalar_one_or_none():
        raise ValueError(f"Session already exists for appointment {session_data.appointment_id}")
    
    # Generate unique session ID
    session_id = f"coach_session_{uuid.uuid4().hex[:12]}"
    
    # Get coach details
    coach_result = await db.execute(
        select(CoachProfile)
        .options(joinedload(CoachProfile.user))
        .where(CoachProfile.id == appointment.coach_id)
    )
    coach = coach_result.unique().scalar_one_or_none()
    
    # Determine client info (registered user or guest)
    if appointment.user_id:
        # Registered user - fetch user data
        user_result = await db.execute(
            select(User).where(User.id == appointment.user_id)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise ValueError(f"User {appointment.user_id} not found")
        
        client_name = user.name
        client_email = user.email
        client_user_id = appointment.user_id
        
        # If email is missing, generate a fallback to prevent session creation failure
        if not client_email:
            # Generate a fallback email using user ID and name
            client_email = f"user_{appointment.user_id}@noemail.local"
            logger.warning(
                f"User '{client_name}' (ID: {appointment.user_id}) does not have an email address. "
                f"Using fallback: {client_email}"
            )
    else:
        # Guest booking
        client_name = appointment.guest_name
        client_email = appointment.guest_email
        client_user_id = None
        
        # For guest, email is required
        if not client_email:
            raise ValueError(
                f"Cannot create session: guest booking does not have an email address. "
                f"Please provide a valid email address for the guest."
            )
    
    # Build scheduled datetime from appointment date and time
    from datetime import time as dt_time
    time_mapping = {
        "10am": dt_time(10, 0),
        "1pm": dt_time(13, 0),
        "3pm": dt_time(15, 0),
        "5pm": dt_time(17, 0),
    }
    scheduled_time = time_mapping.get(appointment.scheduled_time, dt_time(10, 0))
    scheduled_datetime = datetime.combine(appointment.scheduled_date, scheduled_time)
    
    # Generate title if not provided
    title = session_data.title or f"{appointment.session_type or 'Consultation'} - {client_name}"
    
    # Safety check: Ensure client_email is never NULL
    if not client_email:
        logger.error(f"[CRITICAL] client_email is None after all checks. user_id={client_user_id}, guest_email={appointment.guest_email if not client_user_id else 'N/A'} Assigning fallback.")
        client_email = f"noemail_{client_user_id or 'guest'}@noemail.local"
    
    # Create session
    resolved_duration = session_data.duration
    inferred_duration = _infer_duration_from_session_type(appointment.session_type)
    if resolved_duration == 60 and inferred_duration != 60:
        resolved_duration = inferred_duration

    new_session = CoachAppointmentSession(
        session_id=session_id,
        appointment_id=appointment.id,
        coach_id=appointment.coach_id,
        client_user_id=client_user_id,
        client_name=client_name,
        client_email=client_email,
        title=title,
        description=session_data.description or appointment.notes,
        scheduled_date=scheduled_datetime,
        duration=resolved_duration,
        session_type=appointment.session_type,
        status="scheduled",
    )
    
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    
    return new_session


async def get_session_by_id(db: AsyncSession, session_id: str) -> Optional[CoachAppointmentSession]:
    """Get coach session by session_id string"""
    result = await db.execute(
        select(CoachAppointmentSession)
        .options(
            joinedload(CoachAppointmentSession.coach).joinedload(CoachProfile.user),
            joinedload(CoachAppointmentSession.client_user),
            joinedload(CoachAppointmentSession.appointment)
        )
        .where(CoachAppointmentSession.session_id == session_id)
    )
    return result.unique().scalar_one_or_none()


async def get_session_by_pk(db: AsyncSession, pk: int) -> Optional[CoachAppointmentSession]:
    """Get coach session by primary key ID"""
    result = await db.execute(
        select(CoachAppointmentSession)
        .options(
            joinedload(CoachAppointmentSession.coach).joinedload(CoachProfile.user),
            joinedload(CoachAppointmentSession.client_user),
            joinedload(CoachAppointmentSession.appointment)
        )
        .where(CoachAppointmentSession.id == pk)
    )
    return result.unique().scalar_one_or_none()


async def get_coach_sessions(db: AsyncSession, coach_id: int) -> List[CoachAppointmentSession]:
    """Get all sessions for a specific coach"""
    result = await db.execute(
        select(CoachAppointmentSession)
        .options(
            joinedload(CoachAppointmentSession.coach).joinedload(CoachProfile.user),
            joinedload(CoachAppointmentSession.client_user),
            joinedload(CoachAppointmentSession.appointment)
        )
        .where(CoachAppointmentSession.coach_id == coach_id)
        .order_by(CoachAppointmentSession.scheduled_date.desc())
    )
    return result.unique().scalars().all()


async def get_client_sessions(db: AsyncSession, user_id: int) -> List[CoachAppointmentSession]:
    """Get all sessions for a specific client (registered user)"""
    result = await db.execute(
        select(CoachAppointmentSession)
        .options(
            joinedload(CoachAppointmentSession.coach).joinedload(CoachProfile.user),
            joinedload(CoachAppointmentSession.client_user),
            joinedload(CoachAppointmentSession.appointment)
        )
        .where(CoachAppointmentSession.client_user_id == user_id)
        .order_by(CoachAppointmentSession.scheduled_date.desc())
    )
    return result.unique().scalars().all()


async def start_session(db: AsyncSession, session_id: str) -> CoachAppointmentSession:
    """Start a scheduled coach session or resume an active one"""
    session = await get_session_by_id(db, session_id)
    
    if not session:
        raise ValueError(f"Session {session_id} not found")
    
    # Allow resuming active sessions (coach rejoining)
    if session.status == "active":
        # Session is already active, just return it (resume)
        return session
    
    # Start scheduled sessions immediately — removed hard 2-hour start-window restriction
    if session.status == "scheduled":
        session.status = "active"
        if not session.started_at:
            session.started_at = datetime.utcnow()

        await db.commit()
        await db.refresh(session)

        return session
    
    # If status is ended or any other status, don't allow restart
    raise ValueError(f"Cannot start session in {session.status} state")


async def end_session(db: AsyncSession, session_id: str, notes: Optional[str] = None) -> CoachAppointmentSession:
    """End an active coach session and mark appointment as COMPLETED"""
    session = await get_session_by_id(db, session_id)
    
    if not session:
        raise ValueError(f"Session {session_id} not found")
    
    if session.status != "active":
        raise ValueError(f"Cannot end session in {session.status} state")
    
    session.status = "ended"
    session.ended_at = datetime.now()
    
    if notes:
        session.notes = notes
    
    # Update the associated appointment status to COMPLETED
    if session.appointment_id:
        from app.models.user_model import AppointmentStatus
        appointment_result = await db.execute(
            select(Appointment).where(Appointment.id == session.appointment_id)
        )
        appointment = appointment_result.scalar_one_or_none()
        if appointment:
            appointment.status = AppointmentStatus.COMPLETED
    
    await db.commit()
    await db.refresh(session)
    
    return session


async def cancel_session(db: AsyncSession, session_id: str) -> CoachAppointmentSession:
    """Cancel a scheduled coach session"""
    session = await get_session_by_id(db, session_id)
    
    if not session:
        raise ValueError(f"Session {session_id} not found")
    
    if session.status not in ["scheduled"]:
        raise ValueError(f"Cannot cancel session in {session.status} state")
    
    session.status = "cancelled"
    
    await db.commit()
    await db.refresh(session)
    
    return session


async def update_session(
    db: AsyncSession,
    session_id: str,
    update_data: dict
) -> CoachAppointmentSession:
    """Update coach session details"""
    session = await get_session_by_id(db, session_id)
    
    if not session:
        raise ValueError(f"Session {session_id} not found")
    
    # Only allow updates to scheduled sessions
    if session.status != "scheduled":
        raise ValueError(f"Cannot update session in {session.status} state")
    
    for key, value in update_data.items():
        if hasattr(session, key) and value is not None:
            setattr(session, key, value)
    
    await db.commit()
    await db.refresh(session)
    
    return session
