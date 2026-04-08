"""
Training Session CRUD Operations
"""

import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import and_, or_, select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.learning_content_model import LearningContent
from app.models.learning_goals_model import LearningGoals
from app.models.program_model import Program
from app.models.session_model import TrainingSession
from app.schemas.session import SessionCreate


async def get_all_sessions_by_head(
    db: AsyncSession, head_user_id: int, skip: int = 0, limit: int = 10
) -> (List[TrainingSession], int):
    """Get all sessions created by a specific Head with pagination"""
    from sqlalchemy import func

    # Get total count
    count_query = select(func.count()).select_from(TrainingSession).where(
        TrainingSession.created_by_id == head_user_id
    )
    total_count_result = await db.execute(count_query)
    total_count = total_count_result.scalar_one()

    # Get paginated results
    result = await db.execute(
        select(TrainingSession)
        .options(
            selectinload(TrainingSession.trainer),
            selectinload(TrainingSession.learner),
            selectinload(TrainingSession.created_by),
            selectinload(TrainingSession.learning_contents),
            selectinload(TrainingSession.learning_goals),
        )
        .where(TrainingSession.created_by_id == head_user_id)
        .order_by(TrainingSession.scheduled_date.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all(), total_count


async def get_by_id(db: AsyncSession, session_pk: int) -> Optional[TrainingSession]:
    """Get session by integer primary key (id) with relationships."""
    result = await db.execute(
        select(TrainingSession)
        .options(
            selectinload(TrainingSession.trainer),
            selectinload(TrainingSession.learner),
            selectinload(TrainingSession.created_by),
            selectinload(TrainingSession.learning_contents),
            selectinload(TrainingSession.learning_goals),
        )
        .where(TrainingSession.id == session_pk)
    )
    return result.scalar_one_or_none()


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
    from app.models.subscription import LearnerSubscription, SubscriptionStatus
    
    learner_result = await db.execute(
        select(User).where(User.id == session_data.learner_id)
    )
    learner = learner_result.scalar_one_or_none()
    if learner:
        new_session.learner_name = learner.name
    
    # Automatically link learner's active subscription to track session usage
    subscription_result = await db.execute(
        select(LearnerSubscription)
        .where(
            and_(
                LearnerSubscription.learner_id == session_data.learner_id,
                LearnerSubscription.status.in_([
                    SubscriptionStatus.ACTIVE,
                    SubscriptionStatus.PAUSED,
                    SubscriptionStatus.FROZEN
                ]),
                LearnerSubscription.sessions_remaining > 0
            )
        )
        .order_by(desc(LearnerSubscription.created_at))
        .limit(1)
    )
    active_subscription = subscription_result.scalars().first()
    
    if active_subscription:
        new_session.subscription_id = active_subscription.id

    # ── Program link ──────────────────────────────────────────────────────────
    # If a program_id is supplied the program pre-loads goals and content.
    # Both goals and content_ids may be overridden by the caller; when they differ
    # the program is patched so the next session can auto-populate the updated list.
    if session_data.program_id:
        program_result = await db.execute(
            select(Program).where(Program.id == session_data.program_id)
        )
        program = program_result.scalar_one_or_none()
        if program:
            new_session.program_id = program.id
            # Goals are pre-loaded from the program but can be edited by caller
            incoming_goals = session_data.goal_ids
            if incoming_goals is None or len(incoming_goals) == 0:
                # No goals passed — use program's stored goals
                session_data = session_data.model_copy(
                    update={"goal_ids": program.goal_ids or []}
                )
            # Sync content back to the program if the caller provided a different list
            incoming_content = session_data.content_ids
            if incoming_content is not None and list(incoming_content) != list(program.content_ids or []):
                from datetime import timezone as _tz
                program.content_ids = list(incoming_content)
                program.updated_at = datetime.now(_tz.utc).replace(tzinfo=None)
            elif incoming_content is None or len(incoming_content) == 0:
                # No content passed — use program's stored content
                session_data = session_data.model_copy(
                    update={"content_ids": program.content_ids or []}
                )
    # ─────────────────────────────────────────────────────────────────────────

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
    """Get sessions for a learner by status
    
    Returns:
    - Scheduled and active sessions
    - Ended sessions from the past 30 days (session history)
    - Cancelled sessions from the past 30 days
    """
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
        # Get scheduled and active sessions, plus ended/cancelled sessions from the past 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        query = query.where(
            TrainingSession.learner_id == learner_id,
            or_(
                # Scheduled and active sessions
                TrainingSession.status.in_(["scheduled", "active"]),
                # Ended sessions from the past 30 days
                and_(
                    TrainingSession.status == "ended",
                    TrainingSession.scheduled_date >= thirty_days_ago,
                ),
                # Cancelled sessions from the past 30 days
                and_(
                    TrainingSession.status == "cancelled",
                    TrainingSession.scheduled_date >= thirty_days_ago,
                ),
            ),
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

    # ── Program link (edit path) ───────────────────────────────────────────────
    program_id = update_data.pop("program_id", None)
    if program_id is None and content_ids is None and goal_ids is None:
        # No program-related update; fall through to normal M:M update below
        pass
    if program_id is not None:
        program_result = await db.execute(
            select(Program).where(Program.id == program_id)
        )
        program = program_result.scalar_one_or_none()
        if program:
            session.program_id = program.id
            # Goals are pre-loaded from the program but can be edited
            if goal_ids is None or len(goal_ids) == 0:
                goal_ids = program.goal_ids or []
            # Sync content back to the program if caller provided a different list
            if content_ids is not None and list(content_ids) != list(program.content_ids or []):
                from datetime import timezone as _tz
                program.content_ids = list(content_ids)
                program.updated_at = datetime.utcnow()
            elif content_ids is None or len(content_ids) == 0:
                content_ids = program.content_ids or []
    # ─────────────────────────────────────────────────────────────────────────

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


async def cancel_session(db: AsyncSession, session_id: str) -> Optional[TrainingSession]:
    """Cancel a session by changing its status to 'cancelled'
    
    Can cancel scheduled sessions (not yet started)
    """
    session = await get_session_by_id(db, session_id)

    if not session:
        return None

    # Only allow cancellation of scheduled sessions (not started/active/ended)
    if session.status != "scheduled":
        return None

    session.status = "cancelled"
    session.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(session)

    # Reload with relationships
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
    return result.unique().scalar_one_or_none()


async def auto_end_expired_sessions(db: AsyncSession) -> int:
    """
    Automatically end sessions that have exceeded their duration.
    This is a safety mechanism to ensure sessions are ended even if frontend doesn't do it.
    
    - Finds all active sessions where current_time > started_at + duration
    - Ends those sessions by setting status='ended' and ended_at=now
    
    Returns:
        Number of sessions that were auto-ended
    """
    import logging
    from datetime import timezone
    
    logger = logging.getLogger(__name__)
    logger.info("🔄 Starting auto-end expired sessions...")
    
    try:
        # Find all active sessions that have exceeded their duration
        now = datetime.now(timezone.utc)
        
        result = await db.execute(
            select(TrainingSession).where(
                and_(
                    TrainingSession.status == "active",
                    TrainingSession.started_at.isnot(None),
                    TrainingSession.duration.isnot(None)
                )
            )
        )
        active_sessions = result.scalars().all()
        
        sessions_ended = 0
        for session in active_sessions:
            # Calculate when session should end
            session_duration_ms = session.duration * 60 * 1000  # Convert minutes to milliseconds
            session_end_time = session.started_at.timestamp() * 1000 + session_duration_ms
            current_time_ms = now.timestamp() * 1000
            
            # If current time is past session end time, end the session
            if current_time_ms >= session_end_time:
                logger.info(f"⏱️  Auto-ending expired session: {session.session_id} (duration: {session.duration}m, started: {session.started_at})")
                
                session.status = "ended"
                session.ended_at = now
                
                # Calculate actual duration
                duration_delta = session.ended_at - session.started_at
                session.total_duration = int(duration_delta.total_seconds() / 60)
                
                sessions_ended += 1
        
        if sessions_ended > 0:
            await db.commit()
            logger.info(f"✅ Auto-ended {sessions_ended} expired sessions")
        else:
            logger.info("ℹ️  No expired sessions to auto-end")
        
        return sessions_ended
        
    except Exception as e:
        logger.error(f"❌ Error in auto-end expired sessions: {str(e)}", exc_info=True)
        return 0
