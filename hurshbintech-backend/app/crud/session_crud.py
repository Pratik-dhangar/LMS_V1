"""
Training Session CRUD Operations
"""

import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.learning_content_model import LearningContent
from app.models.learning_goals_model import LearningGoals
from app.models.session_model import TrainingSession
from app.schemas.session import SessionCreate


async def get_all_sessions_by_head(db: AsyncSession, head_user_id: int) -> List[TrainingSession]:
    """Get all sessions created by a specific Head"""
    result = await db.execute(
        select(TrainingSession)
        .options(
            joinedload(TrainingSession.trainer),
            joinedload(TrainingSession.learner),
            joinedload(TrainingSession.created_by),
            joinedload(TrainingSession.learning_contents),
            joinedload(TrainingSession.learning_goals),
        )
        .where(TrainingSession.created_by_id == head_user_id)
        .order_by(TrainingSession.scheduled_date.desc())
    )
    return result.unique().scalars().all()


async def get_by_id(db: AsyncSession, session_pk: int) -> Optional[TrainingSession]:
    """Get session by integer primary key (id) with relationships."""
    result = await db.execute(
        select(TrainingSession)
        .options(
            joinedload(TrainingSession.trainer),
            joinedload(TrainingSession.learner),
            joinedload(TrainingSession.created_by),
            joinedload(TrainingSession.learning_contents),
            joinedload(TrainingSession.learning_goals),
        )
        .where(TrainingSession.id == session_pk)
    )
    return result.unique().scalar_one_or_none()


async def create_session(
    db: AsyncSession, session_data: SessionCreate, created_by_id: int
) -> TrainingSession:
    """Create new training session"""
    session_id = f"session_{uuid.uuid4().hex[:12]}"

    # Convert scheduled_date to naive datetime (remove timezone info) for PostgreSQL TIMESTAMP
    scheduled_date = session_data.scheduled_date
    if scheduled_date.tzinfo is not None:
        # Convert to UTC and remove timezone info
        scheduled_date = scheduled_date.replace(tzinfo=None)

    new_session = TrainingSession(
        session_id=session_id,
        title=session_data.title,
        description=session_data.description,
        trainer_id=session_data.trainer_id,
        learner_id=session_data.learner_id,
        created_by_id=created_by_id,
        scheduled_date=scheduled_date,
        duration=session_data.duration,
        status="scheduled",
    )

    db.add(new_session)
    
    # Fetch learner to populate learner_name
    from app.models.user_model import User
    learner_result = await db.execute(
        select(User).where(User.id == session_data.learner_id)
    )
    learner = learner_result.scalar_one_or_none()
    if learner:
        new_session.learner_name = learner.name

    # Add learning content associations if provided (BEFORE commit)
    if session_data.content_ids:
        content_result = await db.execute(
            select(LearningContent).where(LearningContent.id.in_(session_data.content_ids))
        )
        contents = content_result.scalars().all()
        new_session.learning_contents.extend(contents)

    # Add learning goal associations if provided (BEFORE commit)
    if session_data.goal_ids:
        goal_result = await db.execute(
            select(LearningGoals).where(LearningGoals.id.in_(session_data.goal_ids))
        )
        goals = goal_result.scalars().all()
        new_session.learning_goals.extend(goals)

    # Commit everything in one transaction
    await db.commit()
    await db.refresh(new_session)

    # Load all relationships
    result = await db.execute(
        select(TrainingSession)
        .options(
            joinedload(TrainingSession.trainer),
            joinedload(TrainingSession.learner),
            joinedload(TrainingSession.created_by),
            joinedload(TrainingSession.learning_contents),
            joinedload(TrainingSession.learning_goals),
        )
        .where(TrainingSession.id == new_session.id)
    )
    return result.unique().scalar_one()


async def get_trainer_sessions(db: AsyncSession, trainer_id: int) -> List[TrainingSession]:
    """Get all sessions for a trainer"""
    result = await db.execute(
        select(TrainingSession)
        .options(
            joinedload(TrainingSession.trainer),
            joinedload(TrainingSession.learner),
            joinedload(TrainingSession.created_by),
            joinedload(TrainingSession.learning_contents),
            joinedload(TrainingSession.learning_goals),
        )
        .where(TrainingSession.trainer_id == trainer_id)
        .order_by(TrainingSession.scheduled_date.desc())
    )
    return result.unique().scalars().all()


async def get_learner_sessions(
    db: AsyncSession, learner_id: int, status: str = None
) -> List[TrainingSession]:
    """Get sessions for a learner by status"""
    query = select(TrainingSession).options(
        joinedload(TrainingSession.trainer),
        joinedload(TrainingSession.learner),
        joinedload(TrainingSession.created_by),
        joinedload(TrainingSession.learning_contents),
        joinedload(TrainingSession.learning_goals),
    )

    if status:
        query = query.where(
            TrainingSession.learner_id == learner_id, TrainingSession.status == status
        )
    else:
        # Get scheduled and active sessions
        query = query.where(
            TrainingSession.learner_id == learner_id,
            TrainingSession.status.in_(["scheduled", "active"]),
        )

    query = query.order_by(TrainingSession.scheduled_date.desc())
    result = await db.execute(query)
    return result.unique().scalars().all()


async def get_session_by_id(db: AsyncSession, session_id: str) -> Optional[TrainingSession]:
    """Get session by session_id and check for expiration"""
    result = await db.execute(
        select(TrainingSession)
        .options(
            joinedload(TrainingSession.trainer),
            joinedload(TrainingSession.learner),
            joinedload(TrainingSession.created_by),
            joinedload(TrainingSession.learning_contents),
            joinedload(TrainingSession.learning_goals),
        )
        .where(TrainingSession.session_id == session_id)
    )
    session = result.unique().scalar_one_or_none()

    if session and session.status == "active" and session.started_at:
        if session.started_at + timedelta(minutes=session.duration) < datetime.utcnow():
            session.status = "ended"
            session.ended_at = datetime.utcnow()
            await db.commit()
            await db.refresh(session)

    return session


async def start_session(db: AsyncSession, session_id: str) -> Optional[TrainingSession]:
    """Start a scheduled session"""
    session = await get_session_by_id(db, session_id)

    if not session:
        return None

    session.status = "active"
    session.started_at = datetime.utcnow()
    session.session_start_time = datetime.utcnow()  # Track when trainer actually started
    
    # Populate learner_name if not already set
    if not session.learner_name and session.learner:
        session.learner_name = session.learner.name

    await db.commit()
    await db.refresh(session)

    # Reload relationships
    result = await db.execute(
        select(TrainingSession)
        .options(
            joinedload(TrainingSession.trainer),
            joinedload(TrainingSession.learner),
            joinedload(TrainingSession.created_by),
            joinedload(TrainingSession.learning_contents),
            joinedload(TrainingSession.learning_goals),
        )
        .where(TrainingSession.session_id == session_id)
    )
    return result.unique().scalar_one()


async def end_session(
    db: AsyncSession, session_id: str, notes: Optional[str] = None
) -> Optional[TrainingSession]:
    """End an active session and finalize session notes"""
    session = await get_session_by_id(db, session_id)

    if not session:
        return None

    session.status = "ended"
    session.ended_at = datetime.utcnow()
    if notes:
        session.notes = notes
    
    # Calculate total duration if session was started
    if session.session_start_time and session.ended_at:
        duration_delta = session.ended_at - session.session_start_time
        session.total_duration = int(duration_delta.total_seconds() / 60)  # Convert to minutes

    await db.commit()
    
    # Finalize session notes if they exist
    from app.crud import session_notes_crud
    await session_notes_crud.finalize_session_notes(
        db=db,
        session_id=session.id,
        trainer_id=session.trainer_id,
        notes=notes
    )
    
    await db.refresh(session)

    # Reload relationships
    result = await db.execute(
        select(TrainingSession)
        .options(
            joinedload(TrainingSession.trainer),
            joinedload(TrainingSession.learner),
            joinedload(TrainingSession.created_by),
            joinedload(TrainingSession.learning_contents),
            joinedload(TrainingSession.learning_goals),
        )
        .where(TrainingSession.session_id == session_id)
    )
    return result.unique().scalar_one()


async def update_session(
    db: AsyncSession,
    session_id: str,
    update_data: dict,
    content_ids: Optional[List[int]] = None,
    goal_ids: Optional[List[int]] = None,
) -> Optional[TrainingSession]:
    """Update a scheduled session (only if not started yet)"""
    session = await get_session_by_id(db, session_id)

    if not session:
        return None

    # Only allow updates to scheduled sessions
    if session.status != "scheduled":
        return None

    # Update basic fields
    for key, value in update_data.items():
        if value is not None and hasattr(session, key):
            # Handle scheduled_date timezone conversion
            if key == "scheduled_date" and value.tzinfo is not None:
                value = value.replace(tzinfo=None)
            setattr(session, key, value)

    # Update learning content associations if provided
    if content_ids is not None:
        # Clear existing associations
        session.learning_contents.clear()
        if content_ids:
            content_result = await db.execute(
                select(LearningContent).where(LearningContent.id.in_(content_ids))
            )
            contents = content_result.scalars().all()
            session.learning_contents.extend(contents)

    # Update learning goal associations if provided
    if goal_ids is not None:
        # Clear existing associations
        session.learning_goals.clear()
        if goal_ids:
            goal_result = await db.execute(
                select(LearningGoals).where(LearningGoals.id.in_(goal_ids))
            )
            goals = goal_result.scalars().all()
            session.learning_goals.extend(goals)

    session.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(session)

    # Reload relationships
    result = await db.execute(
        select(TrainingSession)
        .options(
            joinedload(TrainingSession.trainer),
            joinedload(TrainingSession.learner),
            joinedload(TrainingSession.created_by),
            joinedload(TrainingSession.learning_contents),
            joinedload(TrainingSession.learning_goals),
        )
        .where(TrainingSession.session_id == session_id)
    )
    return result.unique().scalar_one()


async def delete_session(db: AsyncSession, session_id: str) -> bool:
    """Delete a scheduled session (only if scheduled, not started/ended)"""
    session = await get_session_by_id(db, session_id)

    if not session:
        return False

    # Only allow deletion of scheduled sessions
    if session.status != "scheduled":
        return False

    await db.delete(session)
    await db.commit()
    return True
