"""
CRUD operations for Coach-related models: Appointments and CoachSessions
"""

import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.user_model import (
    Appointment,
    AppointmentStatus,
    CoachProfile,
    CoachSession,
    CoachSessionParticipant,
    CoachReferenceData,
)
from app.schemas.user import (
    AppointmentCreate,
    AppointmentUpdate,
    CoachSessionCreate,
    CoachSessionUpdate,
    CoachSessionParticipantCreate,
)

# Get logger for this module
logger = logging.getLogger(__name__)


# ============ APPOINTMENT CRUD ============


async def create_appointment(
    db: AsyncSession,
    appointment_data: AppointmentCreate,
    user_id: int,
    user_role: str,
) -> Appointment:
    """Create a new appointment with a coach"""
    new_appointment = Appointment(
        coach_id=appointment_data.coach_id,
        user_id=user_id,
        user_role=user_role,
        scheduled_date=appointment_data.scheduled_date,
        scheduled_time=appointment_data.scheduled_time,
        notes=appointment_data.notes,
        session_type=appointment_data.session_type,
        payment_receipt_url=appointment_data.payment_receipt_url,
        status=AppointmentStatus.PENDING,
    )
    db.add(new_appointment)
    await db.commit()
    await db.refresh(new_appointment)
    return new_appointment


async def get_appointment_by_id(db: AsyncSession, appointment_id: int) -> Appointment | None:
    """Get appointment by ID"""
    result = await db.execute(
        select(Appointment)
        .options(
            joinedload(Appointment.coach).joinedload(CoachProfile.user),
            joinedload(Appointment.user),
        )
        .where(Appointment.id == appointment_id)
    )
    return result.unique().scalar_one_or_none()


async def get_appointments_by_coach(db: AsyncSession, coach_id: int) -> list[Appointment]:
    """Get all appointments for a specific coach"""
    result = await db.execute(
        select(Appointment)
        .options(joinedload(Appointment.coach), joinedload(Appointment.user))
        .where(Appointment.coach_id == coach_id)
        .order_by(Appointment.scheduled_date, Appointment.scheduled_time)
    )
    return list(result.scalars().all())


async def get_appointments_by_user(db: AsyncSession, user_id: int) -> list[Appointment]:
    """Get all appointments scheduled by a specific user"""
    result = await db.execute(
        select(Appointment)
        .options(joinedload(Appointment.coach), joinedload(Appointment.user))
        .where(Appointment.user_id == user_id)
        .order_by(Appointment.scheduled_date, Appointment.scheduled_time)
    )
    return list(result.scalars().all())


async def update_appointment(
    db: AsyncSession,
    appointment_id: int,
    appointment_update: AppointmentUpdate,
) -> Appointment | None:
    """Update appointment details"""
    appointment = await get_appointment_by_id(db, appointment_id)
    if not appointment:
        return None

    update_data = appointment_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        # Convert status to enum if it's a string (using same pattern as UserRole)
        if field == 'status' and isinstance(value, str):
            try:
                value = AppointmentStatus[value.upper()]  # Try as enum NAME (uppercase)
            except (KeyError, ValueError):
                # If invalid, try as enum VALUE
                try:
                    value = AppointmentStatus(value)
                except (KeyError, ValueError):
                    pass  # Keep original value if conversion fails
        setattr(appointment, field, value)

    await db.commit()
    await db.refresh(appointment)
    return appointment


async def delete_appointment(db: AsyncSession, appointment_id: int) -> bool:
    """Delete an appointment"""
    appointment = await get_appointment_by_id(db, appointment_id)
    if not appointment:
        return False

    await db.delete(appointment)
    await db.commit()
    return True


# ============ AVAILABILITY CHECKING FUNCTIONS ============


async def get_available_slots(
    db: AsyncSession,
    coach_id: int,
    target_date: date,
) -> list[str]:
    """
    Calculate available time slots for a coach on a specific date.
    
    Args:
        db: Database session
        coach_id: ID of the coach
        target_date: Date to check availability for
    
    Returns:
        List of available time slot strings (e.g., ["10am", "3pm"])
    """
    from sqlalchemy import and_
    from app.models.user_model import AppointmentStatus
    
    # Get coach profile with time slots
    result = await db.execute(
        select(CoachProfile).where(CoachProfile.id == coach_id)
    )
    coach = result.scalar_one_or_none()
    
    if not coach:
        return []
    
    # Parse coach's available time slots
    all_slots = []
    if coach.time_slots:
        all_slots = [slot.strip() for slot in coach.time_slots.split(',')]
    
    # Get existing appointments for this coach on the target date
    existing_appointments = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.coach_id == coach_id,
                Appointment.scheduled_date == target_date,
                Appointment.status.in_([
                    AppointmentStatus.PENDING,
                    AppointmentStatus.CONFIRMED,
                    # Guest booking statuses that should also block time slots
                    AppointmentStatus.GUEST_INTENT,
                    AppointmentStatus.PAYMENT_PENDING,
                    AppointmentStatus.VERIFICATION_PENDING,
                ])  # Only consider active or pending appointments
            )
        )
    )
    booked_slots = [apt.scheduled_time for apt in existing_appointments.scalars().all()]
    
    # Filter out booked slots
    available_slots = [slot for slot in all_slots if slot not in booked_slots]
    
    return available_slots


async def check_slot_availability(
    db: AsyncSession,
    coach_id: int,
    scheduled_date: date,
    scheduled_time: str,
) -> tuple:
    """
    Check if a specific time slot is available for booking.
    Validates:
    1. Coach's availability_days (e.g., only books Monday, Wednesday)
    2. Coach's time_slots (e.g., only 10am, 1pm, 3pm, 5pm)
    3. No existing appointments at that time (with pessimistic locking to prevent race condition)
    
    Uses SELECT FOR UPDATE to lock the row during the check, preventing concurrent
    bookings of the same time slot (race condition prevention).
    
    Args:
        db: Database session
        coach_id: ID of the coach
        scheduled_date: Date of the appointment
        scheduled_time: Time slot (e.g., "10am")
    
    Returns:
        Tuple of (is_available: bool, reason: str)
    """
    from sqlalchemy import and_
    from app.models.user_model import AppointmentStatus, CoachProfile
    
    # Get coach profile to check availability_days and time_slots
    coach_result = await db.execute(
        select(CoachProfile).where(CoachProfile.id == coach_id)
    )
    coach = coach_result.scalar_one_or_none()
    
    if not coach:
        return False, "Coach not found"
    
    # Check if the day of the week is in coach's availability_days
    if coach.availability_days:
        day_name = scheduled_date.strftime('%A')  # Get day name (Monday, Tuesday, etc.)
        available_days = [day.strip() for day in coach.availability_days.split(',')]
        
        if day_name not in available_days:
            return False, f"Coach is not available on {day_name}s. Available days: {coach.availability_days}"
    
    # Check if time slot is in coach's time_slots
    if coach.time_slots:
        available_slots = [slot.strip() for slot in coach.time_slots.split(',')]
        if scheduled_time not in available_slots:
            return False, f"Time slot {scheduled_time} is not available. Available slots: {coach.time_slots}"
    
    # ✅ PESSIMISTIC LOCKING: Use SELECT FOR UPDATE to lock the row
    # This prevents race conditions when multiple users try to book the same slot concurrently
    result = await db.execute(
        select(Appointment)
        .with_for_update(skip_locked=False)  # Lock and wait for other transactions to finish
        .where(
            and_(
                Appointment.coach_id == coach_id,
                Appointment.scheduled_date == scheduled_date,
                Appointment.scheduled_time == scheduled_time,
                Appointment.status.in_([
                    AppointmentStatus.PENDING,
                    AppointmentStatus.CONFIRMED,
                    # Guest booking statuses that should also block time slots
                    AppointmentStatus.GUEST_INTENT,
                    AppointmentStatus.PAYMENT_PENDING,
                    AppointmentStatus.VERIFICATION_PENDING,
                ])
            )
        )
    )
    existing_appointment = result.scalar_one_or_none()
    
    if existing_appointment:
        return False, f"Time slot {scheduled_time} on {scheduled_date} is already booked"
    
    return True, "Slot is available"


# ============ COACH SESSION CRUD ============


async def create_coach_session(
    db: AsyncSession,
    session_data: CoachSessionCreate,
    coach_id: int,
) -> CoachSession:
    """Create a new coach session with participants"""
    new_session = CoachSession(
        coach_id=coach_id,
        session_date=session_data.session_date,
        session_time=session_data.session_time,
        session_title=session_data.session_title,
        learning_content_id=session_data.learning_content_id,
        description=session_data.description,
        notes=session_data.notes,
        status="scheduled",
    )
    db.add(new_session)
    await db.flush()
    
    # Add participants
    # Add learners
    for learner_id in (session_data.learner_ids or []):
        participant = CoachSessionParticipant(
            session_id=new_session.id,
            user_id=learner_id,
            participant_role="learner",
            status="invited"
        )
        db.add(participant)
    
    # Add trainers
    for trainer_id in (session_data.trainer_ids or []):
        participant = CoachSessionParticipant(
            session_id=new_session.id,
            user_id=trainer_id,
            participant_role="trainer",
            status="invited"
        )
        db.add(participant)
    
    # Add heads
    for head_id in (session_data.head_ids or []):
        participant = CoachSessionParticipant(
            session_id=new_session.id,
            user_id=head_id,
            participant_role="head",
            status="invited"
        )
        db.add(participant)
    
    await db.commit()
    await db.refresh(new_session)
    
    # Load session with participants
    result = await db.execute(
        select(CoachSession)
        .options(
            joinedload(CoachSession.coach),
            joinedload(CoachSession.participants).joinedload(CoachSessionParticipant.user),
        )
        .where(CoachSession.id == new_session.id)
    )
    return result.unique().scalar_one()


async def get_coach_session_by_id(db: AsyncSession, session_id: int) -> CoachSession | None:
    """Get coach session by ID"""
    result = await db.execute(
        select(CoachSession)
        .options(
            joinedload(CoachSession.coach),
            joinedload(CoachSession.participants).joinedload(CoachSessionParticipant.user),
        )
        .where(CoachSession.id == session_id)
    )
    return result.unique().scalar_one_or_none()


async def get_coach_sessions(db: AsyncSession, coach_id: int) -> list[CoachSession]:
    """Get all sessions for a specific coach"""
    result = await db.execute(
        select(CoachSession)
        .options(
            joinedload(CoachSession.coach),
            joinedload(CoachSession.participants).joinedload(CoachSessionParticipant.user),
        )
        .where(CoachSession.coach_id == coach_id)
        .order_by(CoachSession.session_date, CoachSession.session_time)
    )
    return list(result.scalars().unique().all())


async def get_user_coach_sessions(db: AsyncSession, user_id: int) -> list[CoachSession]:
    """Get all sessions a user is participating in"""
    result = await db.execute(
        select(CoachSession)
        .options(
            joinedload(CoachSession.coach),
            joinedload(CoachSession.participants).joinedload(CoachSessionParticipant.user),
        )
        .join(CoachSessionParticipant)
        .where(CoachSessionParticipant.user_id == user_id)
        .order_by(CoachSession.session_date, CoachSession.session_time)
    )
    return list(result.scalars().unique().all())


async def update_coach_session(
    db: AsyncSession,
    session_id: int,
    session_update: CoachSessionUpdate,
) -> CoachSession | None:
    """Update coach session details"""
    session = await get_coach_session_by_id(db, session_id)
    if not session:
        return None

    update_data = session_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(session, field, value)

    await db.commit()
    await db.refresh(session)
    return session


async def delete_coach_session(db: AsyncSession, session_id: int) -> bool:
    """Delete a coach session"""
    session = await get_coach_session_by_id(db, session_id)
    if not session:
        return False

    await db.delete(session)
    await db.commit()
    return True


# ============ COACH SESSION PARTICIPANT CRUD ============


async def add_session_participant(
    db: AsyncSession,
    session_id: int,
    participant_data: CoachSessionParticipantCreate,
) -> CoachSessionParticipant:
    """Add a participant to a coach session"""
    new_participant = CoachSessionParticipant(
        session_id=session_id,
        user_id=participant_data.user_id,
        participant_role=participant_data.participant_role,
        status="invited",
    )
    db.add(new_participant)
    await db.commit()
    await db.refresh(new_participant)
    return new_participant


async def get_session_participant(
    db: AsyncSession,
    session_id: int,
    user_id: int,
) -> CoachSessionParticipant | None:
    """Get a specific participant in a session"""
    result = await db.execute(
        select(CoachSessionParticipant).where(
            (CoachSessionParticipant.session_id == session_id)
            & (CoachSessionParticipant.user_id == user_id)
        )
    )
    return result.scalar_one_or_none()


async def update_participant_status(
    db: AsyncSession,
    session_id: int,
    user_id: int,
    status: str,
) -> CoachSessionParticipant | None:
    """Update participant status in a session"""
    participant = await get_session_participant(db, session_id, user_id)
    if not participant:
        return None

    participant.status = status
    await db.commit()
    await db.refresh(participant)
    return participant


async def remove_session_participant(
    db: AsyncSession,
    session_id: int,
    user_id: int,
) -> bool:
    """Remove a participant from a session"""
    participant = await get_session_participant(db, session_id, user_id)
    if not participant:
        return False

    await db.delete(participant)
    await db.commit()
    return True


# ============ COACH REFERENCE DATA CRUD ============


async def create_coach_reference_data(
    db: AsyncSession,
    coach_id: int,
    file_url: str,
    file_type: str,
    description: str = None,
) -> CoachReferenceData:
    """Create a new reference data entry for a coach"""
    from app.models.user_model import ReferenceDataType
    
    # Map file extensions to ReferenceDataType enum
    type_mapping = {
        'pdf': 'PDF',
        'doc': 'DOCX',
        'docx': 'DOCX',
        'jpg': 'IMAGE',
        'jpeg': 'IMAGE',
        'png': 'IMAGE',
        'gif': 'IMAGE',
        'mp4': 'VIDEO',
        'avi': 'VIDEO',
        'mov': 'VIDEO',
    }
    
    # Get enum value, default to the file type string
    enum_value = type_mapping.get(file_type.lower(), 'LINK')
    
    new_reference = CoachReferenceData(
        coach_id=coach_id,
        data_type=enum_value,
        file_path=file_url,
        file_name=description,
        description=description,
    )
    db.add(new_reference)
    await db.commit()
    await db.refresh(new_reference)
    return new_reference


async def get_coach_reference_data(
    db: AsyncSession,
    coach_id: int,
) -> list[CoachReferenceData]:
    """Get all reference data for a coach"""
    result = await db.execute(
        select(CoachReferenceData).where(CoachReferenceData.coach_id == coach_id)
    )
    return list(result.scalars().all())


async def delete_reference_data(
    db: AsyncSession,
    reference_id: int,
) -> bool:
    """Delete a reference data entry"""
    result = await db.execute(
        select(CoachReferenceData).where(CoachReferenceData.id == reference_id)
    )
    reference = result.scalar_one_or_none()
    
    if not reference:
        return False
    
    await db.delete(reference)
    await db.commit()
    return True

