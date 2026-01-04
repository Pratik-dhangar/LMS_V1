"""
Coach Appointment Session CRUD Operations
Handles one-on-one sessions created from appointments
"""

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.coach_session_model import CoachAppointmentSession
from app.models.user_model import Appointment, CoachProfile, User
from app.schemas.coach_session import CoachSessionCreate


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
        # Registered user
        client_name = appointment.user.name
        client_email = appointment.user.email
        client_user_id = appointment.user_id
    else:
        # Guest booking
        client_name = appointment.guest_name
        client_email = appointment.guest_email
        client_user_id = None
    
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
    
    # Create session
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
        duration=session_data.duration,
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
    """Start a scheduled coach session"""
    session = await get_session_by_id(db, session_id)
    
    if not session:
        raise ValueError(f"Session {session_id} not found")
    
    if session.status != "scheduled":
        raise ValueError(f"Cannot start session in {session.status} state")
    
    session.status = "active"
    session.started_at = datetime.now()
    
    await db.commit()
    await db.refresh(session)
    
    return session


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
