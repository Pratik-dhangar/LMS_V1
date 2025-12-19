"""
CRUD operations for Coach Sessions
"""

import logging
from typing import List, Optional
from datetime import date

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.user_model import CoachSession, CoachSessionParticipant, User, UserRole, CoachProfile
from app.schemas.user import CoachSessionCreate, CoachSessionUpdate

logger = logging.getLogger(__name__)


# ============ COACH SESSION CRUD ============

async def create_coach_session(
    db: AsyncSession,
    coach_id: int,
    session_data: CoachSessionCreate
) -> CoachSession:
    """Create a new coach session with participants"""
    logger.info(f"Creating coach session for coach_id: {coach_id}")
    
    # Create session
    new_session = CoachSession(
        coach_id=coach_id,
        session_date=session_data.session_date,
        session_time=session_data.session_time,
        session_title=session_data.session_title,
        learning_content_id=session_data.learning_content_id,
        description=session_data.description,
        notes=session_data.notes,
        status="scheduled"
    )
    
    db.add(new_session)
    await db.flush()
    
    # Add participants
    participants = []
    
    # Add learners
    for learner_id in (session_data.learner_ids or []):
        participant = CoachSessionParticipant(
            session_id=new_session.id,
            user_id=learner_id,
            participant_role="learner",
            status="invited"
        )
        participants.append(participant)
        db.add(participant)
    
    # Add trainers
    for trainer_id in (session_data.trainer_ids or []):
        participant = CoachSessionParticipant(
            session_id=new_session.id,
            user_id=trainer_id,
            participant_role="trainer",
            status="invited"
        )
        participants.append(participant)
        db.add(participant)
    
    # Add heads
    for head_id in (session_data.head_ids or []):
        participant = CoachSessionParticipant(
            session_id=new_session.id,
            user_id=head_id,
            participant_role="head",
            status="invited"
        )
        participants.append(participant)
        db.add(participant)
    
    await db.commit()
    await db.refresh(new_session)
    
    # Load participants with user info
    result = await db.execute(
        select(CoachSession)
        .where(CoachSession.id == new_session.id)
        .options(joinedload(CoachSession.participants))
    )
    session_with_participants = result.scalar_one()
    
    logger.info(f"Created coach session with {len(participants)} participants")
    return session_with_participants


async def get_coach_sessions(
    db: AsyncSession,
    coach_id: int,
    skip: int = 0,
    limit: int = 100
) -> List[CoachSession]:
    """Get all sessions for a coach"""
    logger.info(f"Fetching sessions for coach_id: {coach_id}")
    
    result = await db.execute(
        select(CoachSession)
        .where(CoachSession.coach_id == coach_id)
        .options(joinedload(CoachSession.participants))
        .order_by(CoachSession.session_date.desc())
        .offset(skip)
        .limit(limit)
    )
    sessions = result.scalars().unique().all()
    logger.info(f"Found {len(sessions)} sessions")
    return sessions


async def get_coach_session_by_id(
    db: AsyncSession,
    session_id: int
) -> Optional[CoachSession]:
    """Get a specific coach session by ID"""
    logger.info(f"Fetching coach session id: {session_id}")
    
    result = await db.execute(
        select(CoachSession)
        .where(CoachSession.id == session_id)
        .options(joinedload(CoachSession.participants))
    )
    session = result.scalar_one_or_none()
    
    if session:
        logger.info(f"Found coach session: {session.id}")
    else:
        logger.warning(f"Coach session not found: {session_id}")
    
    return session


async def update_coach_session(
    db: AsyncSession,
    session_id: int,
    session_update: CoachSessionUpdate
) -> Optional[CoachSession]:
    """Update a coach session"""
    logger.info(f"Updating coach session id: {session_id}")
    
    result = await db.execute(
        select(CoachSession).where(CoachSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    
    if not session:
        logger.warning(f"Coach session not found: {session_id}")
        return None
    
    # Update fields
    update_data = session_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(session, field, value)
    
    await db.commit()
    await db.refresh(session)
    
    # Load with participants
    result = await db.execute(
        select(CoachSession)
        .where(CoachSession.id == session_id)
        .options(joinedload(CoachSession.participants))
    )
    updated_session = result.scalar_one()
    
    logger.info(f"Updated coach session: {session_id}")
    return updated_session


async def delete_coach_session(
    db: AsyncSession,
    session_id: int
) -> bool:
    """Delete a coach session"""
    logger.info(f"Deleting coach session id: {session_id}")
    
    result = await db.execute(
        select(CoachSession).where(CoachSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    
    if not session:
        logger.warning(f"Coach session not found: {session_id}")
        return False
    
    await db.delete(session)
    await db.commit()
    
    logger.info(f"Deleted coach session: {session_id}")
    return True


# ============ HELPER FUNCTIONS ============

async def get_available_users_for_session(
    db: AsyncSession,
    role: str
) -> List[dict]:
    """Get all users of a specific role (excluding admin) for session participants"""
    logger.info(f"Fetching available {role}s for session")
    
    role_map = {
        "learner": UserRole.LEARNER,
        "trainer": UserRole.TRAINER,
        "head": UserRole.HEAD
    }
    
    if role not in role_map:
        return []
    
    result = await db.execute(
        select(User)
        .where(User.role == role_map[role])
        .where(User.is_active == True)
        .order_by(User.name)
    )
    users = result.scalars().all()
    
    # Format response
    user_list = [
        {
            "id": user.id,
            "name": user.name,
            "role": user.role.value
        }
        for user in users
    ]
    
    logger.info(f"Found {len(user_list)} {role}s")
    return user_list
