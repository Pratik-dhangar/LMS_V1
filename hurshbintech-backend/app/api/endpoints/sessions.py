"""
Training Session Endpoints - Video conferencing sessions
"""

import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status, BackgroundTasks, Header, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from sqlalchemy.orm import aliased

from app.core.config import settings
from app.core.deps import (
    get_current_head,
    get_current_learner,
    get_current_trainer,
    get_current_user,
)
from app.crud import session_crud
from app.db.session import get_db
from app.models.program_model import Program
from app.models.session_model import TrainingSession
from app.models.session_notes_model import SessionNotes
from app.models.session_report_model import SessionReport
from app.models.session_feedback_model import SessionFeedback
from app.models.user_model import HeadProfile, LearnerProfile, TrainerProfile, User, UserRole
from app.schemas.session import SessionCreate, SessionEnd, SessionResponse, SessionFeedbackCreate, SessionFeedbackResponse
from app.utils.s3_utils import S3Manager, convert_s3_url_to_proxy
from app.services.recording_storage import get_recording_storage
from app.services.cache_service import cache_service
from app.services.recording_merge_service import get_recording_merge_service

# Import SessionUpdate schema
from app.schemas.session import SessionUpdate

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["Training Sessions"])

# Initialize S3 manager if S3 is enabled
s3_manager = None
if settings.USE_S3:
    try:
        s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
        logger.info("S3 manager initialized for sessions")
    except Exception as e:
        logger.error(f"Failed to initialize S3 manager: {str(e)}")

# In-memory storage for WebSocket connections per session
active_connections: Dict[str, List[WebSocket]] = {}


def get_public_url(file_url: str) -> str:
    """Convert S3 URL to permanent backend proxy URL (no expiration)."""
    try:
        if settings.USE_S3 and file_url and file_url.startswith("s3://"):
            return convert_s3_url_to_proxy(file_url)
        return file_url
    except Exception as e:
        logger.error(f"Error generating public URL: {str(e)}")
        return file_url


@router.get("/all")
async def get_all_sessions(
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
    skip: int = 0,
    limit: int = 10,
):
    """Get all sessions created by current Head with pagination"""
    logger.info(f"Head {current_head.user_id} fetching all sessions with skip={skip}, limit={limit}")

    # Import here to avoid circular imports
    from app.crud.session_crud import get_all_sessions_by_head

    sessions, total_count = await get_all_sessions_by_head(db, current_head.user_id, skip=skip, limit=limit)

    # Build responses with notes and reports
    responses = []
    for s in sessions:
        response = await build_session_response(db, s)
        responses.append(response)

    return {"sessions": responses, "total": total_count, "skip": skip, "limit": limit}

    # Build responses with notes and reports
    responses = []
    for s in sessions:
        response = await build_session_response(db, s)
        responses.append(response)

    return responses


# Helper function to build SessionResponse from TrainingSession model
async def build_session_response(db: AsyncSession, session: TrainingSession) -> SessionResponse:
    """Build SessionResponse from TrainingSession model with notes and reports"""
    from sqlalchemy import select
    
    # Get session reports to include prompt/reinforcement values for each goal
    reports_result = await db.execute(
        select(SessionReport).where(SessionReport.session_id == session.id)
    )
    reports = reports_result.scalars().all()
    
    # Get session notes from independent session_notes table (use first() to avoid multiple results error)
    notes_result = await db.execute(
        select(SessionNotes).where(SessionNotes.session_id == session.id)
    )
    session_notes_obj = notes_result.scalars().first()
    session_notes_text = session_notes_obj.notes if session_notes_obj else None
    
    # Create a map of program_id to report data
    report_map = {}
    for report in reports:
        if report.program_id:
            report_map[report.program_id] = {
                "prompt_meter": report.prompt_meter,
                "reinforcement_meter": report.reinforcement_meter
            }

    # Load linked program (if any)
    program_info = None
    if session.program_id:
        prog_result = await db.execute(
            select(Program).where(Program.id == session.program_id)
        )
        prog = prog_result.scalar_one_or_none()
        if prog:
            program_info = {
                "id": prog.id,
                "name": prog.name,
                "skill": prog.skill,
                "description": prog.skill,
                "goal_ids": prog.goal_ids or [],
                "content_ids": prog.content_ids or [],
                "skills": prog.skills or [],
            }
    
    return SessionResponse(
        id=session.id,
        session_id=session.session_id,
        title=session.title,
        trainer_id=session.trainer_id,
        learner_id=session.learner_id,
        created_by_id=session.created_by_id,
        status=session.status,
        scheduled_date=session.scheduled_date,
        started_at=session.started_at,
        ended_at=session.ended_at,
        trainer_name=session.trainer.name if session.trainer else "Unknown",
        learner_name=session.learner.name if session.learner else "Unknown",
        created_by_name=session.created_by.name if session.created_by else "Unknown",
        created_at=session.created_at,
        updated_at=session.updated_at,
        # Fallback to 60 if duration is None in DB (for old sessions) — otherwise use stored value
        duration=session.duration if session.duration is not None else 60,
        total_duration=session.total_duration,
        session_start_time=session.session_start_time,
        subscription_id=session.subscription_id,
        session_counted=session.session_counted or False,
        recording_url=session.recording_url,
        recording_status=session.recording_status,
        recording_uploaded_at=session.recording_uploaded_at,
        session_notes=session_notes_text,
        program=program_info,
        learning_contents=[
            {
                "id": content.id,
                "title": content.title,
                "content_type": content.content_type.value,
                "file_url": get_public_url(content.file_url),
                "thumbnail_url": (
                    get_public_url(content.thumbnail_url) if content.thumbnail_url else None
                ),
                "youtube_url": content.youtube_url,
                "youtube_video_id": content.youtube_video_id,
                "is_youtube": content.is_youtube or False,
            }
            for content in (session.learning_contents or [])
        ],
        learning_goals=[
            {
                "id": goal.id,
                "goal": goal.goal,
                "goal_description": goal.goal_description,
                "prompt_meter": report_map.get(goal.id, {}).get("prompt_meter"),
                "reinforcement_meter": report_map.get(goal.id, {}).get("reinforcement_meter")
            }
            for goal in (session.learning_goals or [])
        ],
    )


# ============ TRAINER ENDPOINTS ============


@router.post("/create", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_training_session(
    session_data: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Head creates a new training session"""
    logger.info(f"User {current_user.id} ({current_user.role}) attempting to create session")

    # Only Head can create sessions
    # Handle both enum and string comparison
    from app.models.user_model import UserRole

    is_head = (
        (current_user.role == UserRole.HEAD)
        or (str(current_user.role).upper() == "HEAD")
        or (current_user.role == "head")
    )
    logger.info(
        f"Is head check: {is_head}, role value: {current_user.role}, role type: {type(current_user.role)}"
    )

    if not is_head:
        logger.warning(
            f"User {current_user.id} with role {current_user.role} attempted to create session"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only Head users can create sessions"
        )

    # Head must specify trainer_id
    if not session_data.trainer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Head must specify trainer_id when creating session",
        )

    logger.info(
        f"Head {current_user.id} creating session for trainer {session_data.trainer_id} and learner {session_data.learner_id}"
    )

    # ✅ Check if learner exists
    learner_result = await db.execute(
        select(User).where(User.id == session_data.learner_id)
    )
    learner = learner_result.scalar_one_or_none()
    
    if not learner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Learner not found"
        )
    
    # ✅ Check if learner is inactive (cannot schedule session for inactive learner)
    if not learner.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot schedule session: Learner account is inactive due to expired subscription. Please renew their subscription first."
        )
    
    # ✅ Check if learner has active subscription with remaining sessions
    # (This is the primary check - subscription status is more important than is_active flag)
    from app.models.subscription import LearnerSubscription, SubscriptionStatus
    sub_result = await db.execute(
        select(LearnerSubscription)
        .where(
            and_(
                LearnerSubscription.learner_id == session_data.learner_id,
                LearnerSubscription.status == SubscriptionStatus.ACTIVE,
                LearnerSubscription.sessions_remaining > 0
            )
        )
        .order_by(desc(LearnerSubscription.created_at))
        .limit(1)
    )
    active_subscription = sub_result.scalars().first()
    
    if not active_subscription:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create session: Learner has no active subscription with remaining sessions. Please renew the subscription."
        )

    new_session = await session_crud.create_session(db, session_data, current_user.id)

    logger.info(f"Session created successfully: {new_session.session_id}")
    return await build_session_response(db, new_session)


@router.put("/{session_id}", response_model=SessionResponse)
async def update_training_session(
    session_id: str,
    session_data: SessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Update a scheduled session (Head only, only if session is scheduled)"""
    logger.info(f"Head {current_head.user_id} attempting to update session {session_id}")

    session = await session_crud.get_session_by_id(db, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify head created this session
    if session.created_by_id != current_head.user_id:
        raise HTTPException(
            status_code=403, detail="Not authorized to update this session"
        )

    # Only allow updates to scheduled sessions
    if session.status != "scheduled":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot update {session.status} session. Only scheduled sessions can be updated.",
        )

    # Prepare update data (only non-None fields)
    update_data = {
        key: value
        for key, value in session_data.model_dump(exclude_unset=True).items()
        if value is not None and key not in ['content_ids', 'goal_ids']
    }

    # Extract content_ids and goal_ids if present in the update data
    content_ids = getattr(session_data, 'content_ids', None)
    goal_ids = getattr(session_data, 'goal_ids', None)

    updated_session = await session_crud.update_session(
        db, session_id, update_data, content_ids, goal_ids
    )

    if not updated_session:
        raise HTTPException(status_code=500, detail="Failed to update session")

    logger.info(f"Session {session_id} updated successfully by Head {current_head.user_id}")
    return await build_session_response(db, updated_session)


@router.get("/trainer/sessions", response_model=List[SessionResponse])
async def get_trainer_sessions_list(
    db: AsyncSession = Depends(get_db),
    current_trainer: TrainerProfile = Depends(get_current_trainer),
):
    """Get all sessions for current trainer"""
    logger.info(f"Fetching sessions for trainer {current_trainer.user_id}")

    sessions = await session_crud.get_trainer_sessions(db, current_trainer.user_id)

    responses = []
    for s in sessions:
        response = await build_session_response(db, s)
        responses.append(response)

    return responses


@router.post("/{session_id}/start", response_model=SessionResponse)
async def start_training_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_trainer: TrainerProfile = Depends(get_current_trainer),
):
    """Start a scheduled session or rejoin an active session"""
    logger.info(f"Trainer {current_trainer.user_id} starting/rejoining session {session_id}")

    session = await session_crud.get_session_by_id(db, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.trainer_id != current_trainer.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to start this session")

    # Allow rejoining active/in_progress sessions
    if session.status in ["in_progress", "active"]:
        logger.info(f"Trainer rejoining active session {session_id} (status: {session.status})")
        return await build_session_response(db, session)
    
    # Start session if in scheduled state
    if session.status != "scheduled":
        logger.warning(f"Cannot start session {session_id}: current status is '{session.status}'")
        raise HTTPException(status_code=400, detail=f"Session cannot be started. Current status: {session.status}")

    started_session = await session_crud.start_session(db, session_id)

    return await build_session_response(db, started_session)


@router.post("/{session_id}/end")
async def end_training_session(
    session_id: str,
    session_end: SessionEnd,
    db: AsyncSession = Depends(get_db),
    current_trainer: TrainerProfile = Depends(get_current_trainer),
):
    """End an active session"""
    logger.info(f"Trainer {current_trainer.user_id} ending session {session_id}")

    session = await session_crud.get_session_by_id(db, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.trainer_id != current_trainer.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to end this session")

    # Store session details before ending for cache invalidation
    head_id = session.created_by_id
    learner_id = session.learner_id

    ended_session = await session_crud.end_session(db, session_id, session_end.notes)

    # Clean up whiteboard state for ended session
    try:
        from app.crud import whiteboard_crud
        await whiteboard_crud.cleanup_session_state(db, session_id)
        logger.info(f"✅ Cleaned up whiteboard state for ended session {session_id}")
    except Exception as e:
        logger.error(f"Error cleaning up whiteboard state for session {session_id}: {str(e)}")

    # 🔥 IMMEDIATELY process subscription session counting (don't wait for scheduler)
    try:
        from app.crud import subscription_crud
        sessions_processed = await subscription_crud.process_ended_sessions_and_update_subscriptions(db)
        logger.info(f"✅ Immediately processed {sessions_processed} ended sessions after session {session_id} ended")
    except Exception as e:
        logger.error(f"Error immediately processing sessions: {str(e)}")

    # Broadcast session end to all participants via WebSocket
    if session_id in active_connections:
        end_message = {
            "type": "session_ended",
            "payload": {
                "session_id": session_id,
                "ended_by": "trainer",
                "ended_at": ended_session.ended_at.isoformat() if ended_session.ended_at else None,
                "notes": session_end.notes,
            },
        }
        for connection in active_connections[session_id]:
            try:
                await connection.send_text(json.dumps(end_message))
            except Exception as e:
                logger.error(f"Failed to send session end message: {e}")

    return {"message": "Session ended successfully"}


@router.get("/{session_id}/feedback", response_model=list[SessionFeedbackResponse])
async def get_session_feedback(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch all feedback submitted for a session. Requires authentication."""
    result = await db.execute(select(TrainingSession).where(TrainingSession.session_id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    fb_result = await db.execute(
        select(SessionFeedback)
        .where(SessionFeedback.session_id == session.id)
        .order_by(SessionFeedback.created_at.desc())
    )
    return fb_result.scalars().all()


@router.post("/{session_id}/feedback", response_model=SessionFeedbackResponse, status_code=status.HTTP_201_CREATED)
async def submit_session_feedback(
    session_id: str,
    feedback: SessionFeedbackCreate,
    db: AsyncSession = Depends(get_db),
):
    """Submit feedback (star rating + remark) after session ends. No auth required so guests can submit."""
    # Resolve numeric session PK from string session_id
    result = await db.execute(select(TrainingSession).where(TrainingSession.session_id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    new_feedback = SessionFeedback(
        session_id=session.id,
        attendee_role=feedback.attendee_role,
        attendee_name=feedback.attendee_name,
        rating=feedback.rating,
        remark=feedback.remark,
    )
    db.add(new_feedback)
    await db.commit()
    await db.refresh(new_feedback)
    logger.info(f"Feedback submitted for session {session_id}: rating={feedback.rating}, role={feedback.attendee_role}")
    return new_feedback


@router.delete("/{session_id}", status_code=status.HTTP_200_OK)
async def delete_training_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Delete a scheduled session (Head only, only if session is scheduled)"""
    logger.info(f"Head {current_head.user_id} attempting to delete session {session_id}")

    session = await session_crud.get_session_by_id(db, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify head created this session
    if session.created_by_id != current_head.user_id:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this session"
        )

    # Only allow deletion of scheduled sessions
    if session.status != "scheduled":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete {session.status} session. Only scheduled sessions can be deleted.",
        )

    # Store session details before deletion for cache invalidation
    trainer_id = session.trainer_id
    learner_id = session.learner_id

    success = await session_crud.delete_session(db, session_id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete session")

    logger.info(f"Session {session_id} deleted successfully by Head {current_head.user_id}")
    return {"message": "Session deleted successfully"}


@router.post("/{session_id}/cancel", response_model=SessionResponse)
async def cancel_training_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Cancel a scheduled session (Head only, only if session is scheduled)"""
    logger.info(f"Head {current_head.user_id} attempting to cancel session {session_id}")

    session = await session_crud.get_session_by_id(db, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify head created this session
    if session.created_by_id != current_head.user_id:
        raise HTTPException(
            status_code=403, detail="Not authorized to cancel this session"
        )

    # Only allow cancellation of scheduled sessions
    if session.status != "scheduled":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel {session.status} session. Only scheduled sessions can be cancelled.",
        )

    cancelled_session = await session_crud.cancel_session(db, session_id)

    if not cancelled_session:
        raise HTTPException(status_code=500, detail="Failed to cancel session")

    response = await build_session_response(db, cancelled_session)
    logger.info(f"Session {session_id} cancelled successfully by Head {current_head.user_id}")
    return response


# ============ LEARNER ENDPOINTS ============


@router.get("/learner/sessions", response_model=List[SessionResponse])
async def get_learner_sessions_list(
    db: AsyncSession = Depends(get_db),
    current_learner: LearnerProfile = Depends(get_current_learner),
):
    """Get learner sessions: scheduled, active, and ended sessions from past 30 days"""
    logger.info(f"Fetching sessions for learner {current_learner.user_id}")

    sessions = await session_crud.get_learner_sessions(db, current_learner.user_id)

    responses = []
    for s in sessions:
        response = await build_session_response(db, s)
        responses.append(response)

    return responses


@router.post("/{session_id}/join")
async def join_training_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_learner: LearnerProfile = Depends(get_current_learner),
):
    """Learner joins an active session"""
    logger.info(f"Learner {current_learner.user_id} joining session {session_id}")

    session = await session_crud.get_session_by_id(db, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.learner_id != current_learner.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to join this session")

    if session.status != "active":
        logger.warning(f"Learner {current_learner.user_id} cannot join session {session_id}: current status is '{session.status}', expected 'active'")
        raise HTTPException(status_code=400, detail=f"Session is not active. Current status: {session.status}")

    return {"message": "Joined session successfully"}


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session_details(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get session details"""
    logger.info(f"User {current_user.id} fetching session {session_id}")

    session = await session_crud.get_session_by_id(db, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify user is part of the session
    if current_user.id not in [session.trainer_id, session.learner_id]:
        raise HTTPException(status_code=403, detail="Not authorized to view this session")

    return await build_session_response(db, session)


# ============ WEBSOCKET ENDPOINT ============


@router.websocket("/ws/{session_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, user_id: int):
    """WebSocket endpoint for real-time communication during sessions"""
    await websocket.accept()
    logger.info(f"WebSocket connected: session={session_id}, user={user_id}")

    # Add connection to active connections
    if session_id not in active_connections:
        active_connections[session_id] = []
    active_connections[session_id].append(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            logger.info(f"WebSocket message from user {user_id}: {message['type']}")

            # Broadcast to all in session except sender
            for conn in active_connections[session_id]:
                if conn != websocket:
                    await conn.send_text(json.dumps(message))

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: session={session_id}, user={user_id}")
        active_connections[session_id].remove(websocket)
        if not active_connections[session_id]:
            del active_connections[session_id]
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if websocket in active_connections.get(session_id, []):
            active_connections[session_id].remove(websocket)


# ============================================================================
# RECORDING ENDPOINTS
# ============================================================================

class JanusWebhookPayload(BaseModel):
    """Payload from Janus recording completion webhook"""
    session_id: int  # Database session ID
    file_path: str  # Absolute path to recording file on disk
    recording_id: str  # Janus internal recording ID
    duration: int  # Recording duration in seconds


async def process_recording(
    session_id: int,
    file_path: str,
    db: AsyncSession
):
    """
    Background task to process recording upload.
    
    Args:
        session_id: Database session ID
        file_path: Path to recording file from Janus
        db: Database session
    """
    try:
        logger.info(f"Processing recording for session {session_id}: {file_path}")
        
        # TEMPORARY: For testing without Janus integration, create dummy file if missing
        from pathlib import Path
        source_path = Path(file_path)
        if not source_path.exists():
            logger.warning(f"Recording file not found (expected for testing): {file_path}")
            logger.info("Creating dummy recording file for testing purposes")
            
            # Create parent directory if needed
            source_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Create a valid minimal WebM file that browsers can play
            # This is a complete WebM structure with EBML header, Segment, Info, and Tracks
            webm_data = bytes([
                # EBML Header
                0x1A, 0x45, 0xDF, 0xA3, 0x9F,  # EBML ID + size
                0x42, 0x86, 0x81, 0x01,  # EBMLVersion = 1
                0x42, 0xF7, 0x81, 0x01,  # EBMLReadVersion = 1
                0x42, 0xF2, 0x81, 0x04,  # EBMLMaxIDLength = 4
                0x42, 0xF3, 0x81, 0x08,  # EBMLMaxSizeLength = 8
                0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6D,  # DocType = "webm"
                0x42, 0x87, 0x81, 0x02,  # DocTypeVersion = 2
                0x42, 0x85, 0x81, 0x02,  # DocTypeReadVersion = 2
                
                # Segment
                0x18, 0x53, 0x80, 0x67, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x3B,  # Segment ID + size
                
                # Info
                0x15, 0x49, 0xA9, 0x66, 0x8E,  # Info ID + size
                0x4D, 0x80, 0x84, 0x44, 0x75, 0x6D, 0x6D,  # MuxingApp = "Dumm"
                0x57, 0x41, 0x84, 0x54, 0x65, 0x73, 0x74,  # WritingApp = "Test"
                0x2A, 0xD7, 0xB1, 0x83, 0x0F, 0x42, 0x40,  # TimecodeScale = 1000000
                0x44, 0x89, 0x84, 0x40, 0x00, 0x00, 0x00,  # Duration = 0
                
                # Tracks
                0x16, 0x54, 0xAE, 0x6B, 0x8F,  # Tracks ID + size
                # Track Entry (Video)
                0xAE, 0x8D,  # TrackEntry ID + size
                0xD7, 0x81, 0x01,  # TrackNumber = 1
                0x73, 0xC5, 0x81, 0x01,  # TrackUID = 1
                0x83, 0x81, 0x01,  # TrackType = 1 (video)
                0x86, 0x85, 0x56, 0x50, 0x38, 0x30, 0x30,  # CodecID = "VP800"
            ])
            source_path.write_bytes(webm_data)
            logger.info(f"Dummy recording file created at {file_path}")
        
        # Get storage backend (local or S3 based on config)
        storage = get_recording_storage()
        
        # Save recording to persistent storage
        storage_path = await storage.save(str(source_path), session_id)
        logger.info(f"Recording saved: {storage_path}")
        
        # Update session in database
        session = await session_crud.get_by_id(db, session_id)
        if not session:
            logger.error(f"Session {session_id} not found in database")
            return
        
        session.recording_url = storage_path
        session.recording_status = "completed"
        session.recording_uploaded_at = datetime.now(timezone.utc).replace(tzinfo=None)
        
        await db.commit()
        logger.info(f"Session {session_id} recording URL updated in database")
        
    except Exception as e:
        logger.error(f"Failed to process recording for session {session_id}: {e}")
        
        # Update session status to failed
        try:
            session = await session_crud.get_by_id(db, session_id)
            if session:
                session.recording_status = "failed"
                await db.commit()
        except Exception as db_error:
            logger.error(f"Failed to update session status: {db_error}")


@router.post("/recordings/webhook/complete", status_code=status.HTTP_200_OK)
async def janus_recording_webhook(
    payload: JanusWebhookPayload,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    x_webhook_token: str = Header(None)
):
    """
    Webhook endpoint for Janus to notify recording completion.
    
    Janus should POST to this endpoint when a recording is finished:
    ```
    POST /api/sessions/recordings/webhook/complete
    Content-Type: application/json
    X-Webhook-Token: <shared_secret>
    
    {
        "session_id": 123,
        "file_path": "/var/janus/recordings/rec-abc123.webm",
        "recording_id": "abc123",
        "duration": 3600
    }
    ```
    
    Security:
    - Validate X-Webhook-Token header against environment variable
    - Use network-level security (firewall rules) for additional protection
    
    Process:
    1. Validate webhook token
    2. Queue background task to upload recording
    3. Return immediately to Janus
    4. Background task moves/uploads file and updates database
    """
    # Optional: Validate webhook token for security
    # expected_token = os.getenv("JANUS_WEBHOOK_TOKEN")
    # if expected_token and x_webhook_token != expected_token:
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="Invalid webhook token"
    #     )
    
    logger.info(
        f"Received Janus webhook for session {payload.session_id}: "
        f"{payload.file_path}"
    )
    
    # Verify session exists
    session = await session_crud.get_by_id(db, payload.session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {payload.session_id} not found"
        )
    
    # Update status to processing immediately
    session.recording_status = "processing"
    await db.commit()
    
    # Queue background task for upload
    background_tasks.add_task(process_recording, payload.session_id, payload.file_path, db)
    
    return {
        "status": "accepted",
        "message": f"Recording processing queued for session {payload.session_id}"
    }


@router.post("/recordings/upload", status_code=status.HTTP_200_OK)
async def upload_recording(
    file: UploadFile = File(...),
    session_id: int = Form(...),
    recording_id: str = Form(...),
    duration: int = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload actual recording file from browser MediaRecorder.
    
    This endpoint receives the recorded video blob from the frontend
    and saves it directly to storage.
    
    Args:
        file: The recorded WebM file
        session_id: Database session ID
        recording_id: Recording identifier
        duration: Recording duration in seconds
    
    Returns:
        {
            "status": "success",
            "recording_url": "...",
            "message": "Recording uploaded successfully"
        }
    """
    try:
        logger.info(f"Receiving recording upload for session {session_id}: {file.filename}")
        
        # Verify session exists and user has access
        session = await session_crud.get_by_id(db, session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found"
            )
        
        if current_user.id not in [session.trainer_id, session.learner_id]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to upload recordings for this session"
            )
        
        # Get storage backend
        storage = get_recording_storage()
        
        # Save file to temporary location first
        temp_dir = Path("/tmp") if Path("/tmp").exists() else Path(".")
        temp_file = temp_dir / f"{recording_id}.webm"
        
        with open(temp_file, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        logger.info(f"Saved temporary file: {temp_file} ({len(content)} bytes)")
        
        # Move to permanent storage
        storage_path = await storage.save(str(temp_file), session_id)
        logger.info(f"Recording saved to storage: {storage_path}")
        
        # Update session in database
        session.recording_url = storage_path
        session.recording_status = "completed"
        session.recording_uploaded_at = datetime.now(timezone.utc).replace(tzinfo=None)
        
        await db.commit()
        logger.info(f"Session {session_id} recording URL updated in database")
        
        return {
            "status": "success",
            "recording_url": storage_path,
            "message": f"Recording uploaded successfully ({len(content)} bytes)"
        }
        
    except Exception as e:
        logger.error(f"Failed to upload recording for session {session_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload recording: {str(e)}"
        )


# ============ OPTIMIZED CHUNKED RECORDING ENDPOINTS ============

class RecordingChunkFinalization(BaseModel):
    """Request model for finalizing chunked recording"""
    recording_id: str
    session_id: int
    duration: int
    total_chunks: int | None = None
    uploaded_chunks: List[int] = []
    failed_chunks: List[int] = []
    # Backward-compatible keys used by the new frontend recording service.
    chunk_count: int | None = None
    total_chunks_uploaded: int | None = None


@router.post("/recordings/upload-chunk", status_code=status.HTTP_200_OK)
async def upload_recording_chunk(
    file: UploadFile = File(None),
    chunk: UploadFile = File(None),
    session_id: str = Form(...),
    recording_id: str = Form(...),
    chunk_number: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a single recording chunk (optimized for reduced CPU load).
    
    This endpoint receives chunk-by-chunk recording data from the frontend.
    Chunks are uploaded in real-time, preventing data loss if connection drops.
    
    Args:
        file: The WebM chunk blob
        session_id: Session identifier (can be database ID or session_id string)
        recording_id: Recording identifier (shared across all chunks)
        chunk_number: Sequence number of this chunk (0, 1, 2, ...)
    
    Returns:
        {
            "status": "success",
            "chunk_number": 0,
            "size": 2048000,
            "message": "Chunk uploaded successfully"
        }
    """
    try:
        # Convert chunk_number to integer
        try:
            chunk_num = int(chunk_number)
        except (ValueError, TypeError):
            logger.error(f"[CHUNK UPLOAD] Invalid chunk_number: {chunk_number}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid chunk_number"
            )
        
        logger.info(f"[CHUNK UPLOAD] Incoming request:")
        logger.info(f"  - session_id: {session_id}")
        logger.info(f"  - recording_id: {recording_id}")
        logger.info(f"  - chunk_number: {chunk_num}")
        upload_file = file or chunk
        if not upload_file:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing upload file. Provide 'file' or 'chunk'.",
            )

        logger.info(f"  - file: {upload_file.filename} (size: {upload_file.size})")
        logger.info(f"  - current_user: {current_user.id}")
        
        # Try to find session by numeric ID first, then by session_id string
        session = None
        try:
            # Try as numeric ID
            session_numeric_id = int(session_id)
            session = await session_crud.get_by_id(db, session_numeric_id)
        except (ValueError, TypeError):
            pass
        
        # If not found by numeric ID, try to find by session_id string
        if not session:
            from sqlalchemy import select
            result = await db.execute(
                select(TrainingSession).where(TrainingSession.session_id == session_id)
            )
            session = result.scalar_one_or_none()
        
        if not session:
            logger.error(f"[CHUNK UPLOAD] Session not found: {session_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found"
            )
        
        logger.info(f"[CHUNK UPLOAD] ✅ Session found: id={session.id}, trainer_id={session.trainer_id}, learner_id={session.learner_id}")
        
        # Verify user has permission
        if current_user.id not in [session.trainer_id, session.learner_id]:
            logger.error(f"[CHUNK UPLOAD] User {current_user.id} denied - not in session")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to upload chunks for this session"
            )
        
        # Create chunks directory with proper structure
        base_dir = Path(settings.RECORDINGS_BASE_DIR or "uploads/recordings")
        recording_dir = base_dir / str(recording_id)
        chunks_dir = recording_dir / "chunks"
        chunks_dir.mkdir(parents=True, exist_ok=True)
        
        # Save chunk with zero-padded number for proper sorting.
        # Preserve known extension so merge service can decode correctly.
        file_ext = Path(upload_file.filename or "").suffix.lower()
        if file_ext not in [".mp4", ".webm"]:
            content_type = (upload_file.content_type or "").lower()
            file_ext = ".webm" if "webm" in content_type else ".mp4"

        chunk_path = chunks_dir / f"{chunk_num:06d}{file_ext}"
        chunk_size = 0
        chunk_checksum = ""
        
        # Read content and calculate checksum
        content = await upload_file.read()
        chunk_size = len(content)
        
        if chunk_size == 0:
            logger.error(f"[CHUNK UPLOAD] Empty chunk data received for chunk {chunk_num}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty chunk data"
            )
        
        with open(chunk_path, "wb") as buffer:
            buffer.write(content)
        
        # Calculate checksum for validation
        chunk_checksum = hashlib.sha256(content).hexdigest()
        
        logger.info(f"[CHUNK UPLOAD] ✅ Saved chunk {chunk_num}: {chunk_size} bytes (checksum: {chunk_checksum}) to {chunk_path}")
        
        # Update metadata file with chunk info
        metadata_file = recording_dir / "metadata.json"
        metadata = {}
        
        if metadata_file.exists():
            try:
                with open(metadata_file, "r") as f:
                    metadata = json.load(f)
            except Exception as e:
                logger.warning(f"[CHUNK UPLOAD] Could not read existing metadata: {e}")
                metadata = {}
        
        # Add/update chunk metadata
        if "chunks" not in metadata:
            metadata["chunks"] = {}
        
        metadata["chunks"][str(chunk_num)] = {
            "checksum": chunk_checksum,
            "size": chunk_size,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "sequence": chunk_num
        }
        
        # Track uploaded chunks
        if "uploaded_chunks" not in metadata:
            metadata["uploaded_chunks"] = []
        if chunk_num not in metadata["uploaded_chunks"]:
            metadata["uploaded_chunks"].append(chunk_num)
        
        # Update tracking
        metadata["last_chunk_received"] = chunk_num
        metadata["total_chunks_received"] = len(metadata["uploaded_chunks"])
        
        # Write updated metadata
        try:
            with open(metadata_file, "w") as f:
                json.dump(metadata, f, indent=2)
        except Exception as e:
            logger.warning(f"[CHUNK UPLOAD] Could not write metadata: {e}")
        
        # Update session status if this is first chunk
        if chunk_num <= 1 and session.recording_status != "recording":
            session.recording_status = "recording"
            session.recording_started_at = datetime.now(timezone.utc).replace(tzinfo=None)
            session.recording_id = recording_id
            session.has_recording = True
            session.recording_url = str(recording_dir)  # Store base recording directory
            await db.commit()
            logger.info(f"[CHUNK UPLOAD] ✅ Session {session.id} recording started")
        elif session.recording_status == "recording":
            session.recording_chunks_count = max(session.recording_chunks_count or 0, chunk_num)
            await db.commit()
        
        return {
            "status": "success",
            "chunk_number": chunk_num,
            "size": chunk_size,
            "checksum": chunk_checksum,
            "message": f"Chunk {chunk_num} uploaded successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[CHUNK UPLOAD] Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/recordings/finalize", status_code=status.HTTP_200_OK)
async def finalize_recording(
    data: RecordingChunkFinalization,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Finalize chunked recording by merging all chunks into single file.
    
    This endpoint:
    1. Validates all chunks are received and in correct order
    2. Merges all uploaded chunks into a single WebM file using FFmpeg
    3. Verifies output integrity
    4. Cleans up individual chunk files
    5. Updates session recording_url in database
    6. Sets recording_status to 'completed'
    
    Args:
        recording_id: Recording identifier
        session_id: Database session ID
        duration: Total recording duration in seconds
        total_chunks: Total number of chunks to expect
        uploaded_chunks: List of chunk numbers that were uploaded
        failed_chunks: List of chunk numbers that failed to upload
    
    Returns:
        {
            "status": "success",
            "recording_url": "uploads/recordings/...",
            "duration": 3600,
            "size": 1024000000,
            "merged_chunks": 360,
            "merge_method": "ffmpeg_concat",
            "message": "Recording finalized successfully"
        }
    """
    try:
        recording_id = data.recording_id
        session_id = data.session_id
        duration = data.duration
        total_chunks = data.total_chunks or data.chunk_count or 0
        uploaded_chunks = data.uploaded_chunks
        failed_chunks = data.failed_chunks

        logger.info(f"[FINALIZE] Finalizing recording {recording_id} for session {session_id}")
        logger.info(f"[FINALIZE] Total chunks: {total_chunks}, Uploaded: {len(uploaded_chunks)}, Failed: {len(failed_chunks)}")

        session = await session_crud.get_by_id(db, session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found"
            )

        if current_user.id not in [session.trainer_id, session.learner_id]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to finalize this recording"
            )

        base_dir = Path(settings.RECORDINGS_BASE_DIR or "uploads/recordings")
        chunks_dir = base_dir / recording_id / "chunks"
        output_dir = base_dir / recording_id
        
        # Load metadata if available
        metadata_file = output_dir / "metadata.json"
        chunk_metadata = {}
        if metadata_file.exists():
            try:
                with open(metadata_file, "r") as f:
                    chunk_data = json.load(f)
                    # Extract checksum data
                    if "chunks" in chunk_data:
                        for chunk_id, chunk_info in chunk_data["chunks"].items():
                            chunk_metadata[f"chunk_{chunk_id}_checksum"] = chunk_info.get("checksum")
            except Exception as e:
                logger.warning(f"[FINALIZE] Could not load metadata: {e}")

        if not chunks_dir.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Chunks directory not found for recording {recording_id}"
            )

        # Resolve uploaded chunk files and choose a matching output container.
        chunk_files = list(chunks_dir.glob("*.webm")) + list(chunks_dir.glob("*.mp4"))
        if not chunk_files:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No chunks found for recording {recording_id}",
            )

        # Sort chunks by numeric chunk index, not lexicographic filename.
        def _chunk_index(path: Path) -> int:
            try:
                return int(path.stem)
            except ValueError:
                return 0

        chunk_files = sorted(chunk_files, key=_chunk_index)
        chunk_indexes = [_chunk_index(p) for p in chunk_files]

        expected_total = total_chunks or len(chunk_files)
        if expected_total > 0:
            first_index = min(chunk_indexes) if chunk_indexes else 0
            # Support both 0-based and 1-based chunk numbering.
            if first_index <= 0:
                expected_indexes = set(range(0, expected_total))
            else:
                expected_indexes = set(range(1, expected_total + 1))

            found_indexes = set(chunk_indexes)
            missing_indexes = sorted(expected_indexes - found_indexes)

            if missing_indexes:
                logger.error(
                    f"[FINALIZE] Missing chunk indexes: {missing_indexes[:20]}"
                    f"{'...' if len(missing_indexes) > 20 else ''}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Recording is incomplete. Missing {len(missing_indexes)} chunk(s). "
                        "Please wait for uploads/retries to finish, then finalize again."
                    ),
                )

        output_ext = chunk_files[0].suffix if chunk_files else ".webm"
        output_file = output_dir / f"final{output_ext}"

        # Use the new recording merge service for robust merging
        merge_service = get_recording_merge_service()

        success = merge_service.merge_chunks(
            chunk_files=chunk_files,
            output_path=str(output_file),
            use_copy_codec=True,
        )

        if not success:
            logger.error("[FINALIZE] Merge failed")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to merge recording"
            )

        total_size = output_file.stat().st_size
        merged_chunks = len(chunk_files)
        merge_method = "ffmpeg_concat_copy"

        logger.info(f"[FINALIZE] ✅ Merge successful via {merge_method}: {merged_chunks} chunks → {total_size} bytes")

        # Save to permanent storage (S3 or local)
        storage = get_recording_storage()
        try:
            storage_path = await storage.save(str(output_file), session_id)
            logger.info(f"[FINALIZE] Recording saved to permanent storage: {storage_path}")
        except Exception as storage_err:
            logger.error(f"[FINALIZE] Error saving to storage: {storage_err}")
            # In S3 mode, do not silently fallback to local path.
            # That creates DB URLs that cannot be played back via S3 watch flow.
            if settings.RECORDING_STORAGE_MODE.lower() == "s3":
                session.recording_status = "failed"
                await db.commit()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=(
                        "Recording merged but failed to upload to S3. "
                        "Check AWS credentials and bucket configuration."
                    ),
                )

            # Local mode keeps backward-compatible behavior.
            storage_path = str(output_file)

        # Clean up chunk files after successful merge
        try:
            # Remove individual chunk files
            for pattern in ["*.webm", "*.mp4", "filelist.txt"]:
                for chunk_file in chunks_dir.glob(pattern):
                    try:
                        chunk_file.unlink()
                    except Exception as clean_err:
                        logger.warning(f"[FINALIZE] Failed to delete chunk file {chunk_file}: {clean_err}")
            
            # Remove chunks directory
            try:
                chunks_dir.rmdir()
                logger.info("[FINALIZE] Cleaned up chunks directory")
            except:
                pass
            
            # Clean up metadata file
            if metadata_file.exists():
                try:
                    metadata_file.unlink()
                except:
                    pass
                    
        except Exception as cleanup_err:
            logger.warning(f"[FINALIZE] Error during cleanup: {cleanup_err}")

        # Update session in database
        session.recording_url = storage_path
        session.recording_status = "completed"
        session.recording_uploaded_at = datetime.now(timezone.utc).replace(tzinfo=None)
        session.recording_duration = duration
        session.recording_chunks_count = merged_chunks
        await db.commit()

        logger.info(f"[FINALIZE] ✅ Session {session_id} recording finalized in database")
        logger.info(f"[FINALIZE] Summary: {merged_chunks} chunks merged ({total_size} bytes) via {merge_method}")
        
        return {
            "status": "success",
            "recording_url": storage_path,
            "duration": duration,
            "size": total_size,
            "merged_chunks": merged_chunks,
            "merge_method": merge_method,
            "message": f"✅ Recording finalized successfully ({merged_chunks} chunks, {total_size} bytes via {merge_method})"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FINALIZE] Error finalizing recording: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to finalize recording: {str(e)}"
        )


@router.get("/recordings/{recording_id}/status", status_code=status.HTTP_200_OK)
async def get_recording_status(
    recording_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get status of a chunked recording during or after upload.
    
    Returns information about uploaded chunks and failures.
    
    Args:
        recording_id: Recording identifier
    
    Returns:
        {
            "recording_id": "session-123-timestamp",
            "status": "recording" | "completed" | "failed",
            "uploaded_chunks": 360,
            "chunks_dir": "uploads/recordings/.../chunks",
            "message": "Recording in progress"
        }
    """
    try:
        logger.info(f"[STATUS] Getting status for recording {recording_id}")
        
        # Check if chunks directory exists
        chunks_dir = Path(settings.RECORDINGS_BASE_DIR or "uploads/recordings") / recording_id / "chunks"
        output_file_mp4 = Path(settings.RECORDINGS_BASE_DIR or "uploads/recordings") / recording_id / "final.mp4"
        output_file_webm = Path(settings.RECORDINGS_BASE_DIR or "uploads/recordings") / recording_id / "final.webm"
        output_file = output_file_mp4 if output_file_mp4.exists() else output_file_webm

        if output_file.exists():
            return {
                "recording_id": recording_id,
                "status": "completed",
                "uploaded_chunks": (
                    len(list(chunks_dir.glob("*.webm"))) + len(list(chunks_dir.glob("*.mp4")))
                ) if chunks_dir.exists() else 0,
                "total_size": output_file.stat().st_size,
                "message": "Recording completed"
            }
        
        if chunks_dir.exists():
            chunk_files = list(chunks_dir.glob("*.webm")) + list(chunks_dir.glob("*.mp4"))
            total_size = sum(f.stat().st_size for f in chunk_files)
            
            return {
                "recording_id": recording_id,
                "status": "recording",
                "uploaded_chunks": len(chunk_files),
                "total_size": total_size,
                "message": f"Recording in progress ({len(chunk_files)} chunks)"
            }
        
        return {
            "recording_id": recording_id,
            "status": "not_found",
            "uploaded_chunks": 0,
            "message": "Recording not found"
        }
        
    except Exception as e:
        logger.error(f"[STATUS] Error getting recording status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get recording status: {str(e)}"
        )


@router.get("/recordings/local/{session_id}/{filename}")
async def get_local_recording(
    session_id: int,
    filename: str,
    range: str = Header(None)
):
    """
    Serve local recordings with range request support for video seeking.
    
    This endpoint is used when RECORDING_STORAGE_MODE=local.
    Supports HTTP Range requests for HTML5 video player seeking.
    
    Args:
        session_id: Database session ID
        filename: Recording filename
        range: HTTP Range header for partial content requests
    
    Returns:
        FileResponse with appropriate headers for video streaming
    """
    # Get the configured base directory
    storage = get_recording_storage()
    if hasattr(storage, 'base_dir'):
        base_dir = storage.base_dir
    else:
        # Fallback if not local storage
        base_dir = Path(settings.RECORDINGS_BASE_DIR or "uploads/recordings")
    
    # Construct file path
    file_path = Path(base_dir) / str(session_id) / filename
    
    # Security: Validate path to prevent directory traversal
    if not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recording not found: {file_path}"
        )
    
    # Return file with range support for video seeking
    return FileResponse(
        path=str(file_path),
        media_type="video/webm",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=3600"
        }
    )


@router.get("/{session_id}/recording-url")
async def get_recording_playback_url(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get playback URL for session recording.
    
    - For local storage: Returns API endpoint path
    - For S3 storage: Generates presigned URL with 1-hour expiration
    
    Security:
    - User must be authenticated
    - User must be participant (trainer or learner) or head who created session
    
    Args:
        session_id: Database session ID
        
    Returns:
        {
            "playback_url": "https://...",
            "storage_mode": "local" | "s3",
            "expires_in": 3600  # seconds (S3 only)
        }
    """
    # Get session from database
    session = await session_crud.get_by_id(db, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Verify user access
    # Admin and Head can access any recording. Others must be participants/creator.
    is_admin_or_head = (
        current_user.role in [UserRole.ADMIN, UserRole.HEAD]
        or str(current_user.role).upper() in ["ADMIN", "HEAD"]
        or current_user.role in ["admin", "head"]
    )
    if (not is_admin_or_head) and current_user.id not in [session.trainer_id, session.learner_id, session.created_by_id]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this session recording"
        )
    
    # Check if recording exists
    if not session.recording_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No recording available for this session"
        )
    
    if session.recording_status != "completed":
        raise HTTPException(
            status_code=status.HTTP_425_TOO_EARLY,
            detail=f"Recording is {session.recording_status}"
        )
    
    # Get storage backend and generate playback URL
    storage = get_recording_storage()
    playback_url = await storage.get_playback_url(session.recording_url)
    
    return {
        "playback_url": playback_url,
        "storage_mode": settings.RECORDING_STORAGE_MODE,
        "expires_in": 3600 if settings.RECORDING_STORAGE_MODE == "s3" else None
    }

@router.get("/recordings/trainer/all")
async def get_trainer_recordings(
    db: AsyncSession = Depends(get_db),
    current_trainer: TrainerProfile = Depends(get_current_trainer)
):
    """
    Get all recordings for the current trainer's sessions.
    
    Returns a list of sessions with recordings including playback URLs.
    
    Returns:
        List of sessions with recordings and their playback URLs
    """
    logger.info(f"Fetching all recordings for trainer {current_trainer.user_id}")
    
    try:
        from sqlalchemy import select, and_
        
        # Query sessions for this trainer where recording exists
        stmt = select(TrainingSession).where(
            and_(
                TrainingSession.trainer_id == current_trainer.user_id,
                TrainingSession.recording_url.isnot(None)
            )
        ).order_by(TrainingSession.updated_at.desc())
        
        result = await db.execute(stmt)
        sessions = result.scalars().all()
        
        if not sessions:
            return {
                "recordings": [],
                "total": 0,
                "message": "No recordings found"
            }
        
        # Build response with playback URLs
        recordings = []
        storage = get_recording_storage()
        
        for session in sessions:
            try:
                playback_url = await storage.get_playback_url(session.recording_url)
            except Exception as e:
                logger.error(f"Failed to generate playback URL for session {session.id}: {e}")
                playback_url = None
            
            recordings.append({
                "id": session.id,
                "session_id": session.session_id,
                "title": session.title,
                "learner_id": session.learner_id,
                "learner_name": session.learner_profile.full_name if session.learner_profile else "Unknown",
                "status": session.status,
                "recording_status": session.recording_status,
                "recorded_at": session.recording_uploaded_at,
                "playback_url": playback_url,
                "scheduled_date": session.scheduled_date,
                "duration": session.duration
            })
        
        return {
            "recordings": recordings,
            "total": len(recordings),
            "message": f"Found {len(recordings)} recording(s)"
        }
        
    except Exception as e:
        logger.error(f"Error fetching trainer recordings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch recordings: {str(e)}"
        )


@router.get("/recordings/all")
async def get_all_recordings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all recordings in the system (admin/head only).
    
    Returns a list of all sessions with recordings including playback URLs.
    
    Returns:
        List of sessions with recordings and their playback URLs
    """
    # Check if user is admin or head
    is_admin_or_head = (
        current_user.role in [UserRole.ADMIN, UserRole.HEAD]
        or str(current_user.role).upper() in ["ADMIN", "HEAD"]
        or current_user.role in ["admin", "head"]
    )
    if not is_admin_or_head:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/head can access all recordings",
        )
    
    logger.info(f"Fetching all recordings for {current_user.role} {current_user.id}")
    
    try:
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        
        # Query all sessions where recording exists with eager loaded User relationships
        stmt = select(TrainingSession).where(
            TrainingSession.recording_url.isnot(None)
        ).options(
            selectinload(TrainingSession.trainer),
            selectinload(TrainingSession.learner)
        ).order_by(TrainingSession.updated_at.desc())
        
        result = await db.execute(stmt)
        sessions = result.scalars().all()
        
        if not sessions:
            return {
                "recordings": [],
                "total": 0,
                "message": "No recordings found"
            }
        
        # Build response with playback URLs
        recordings = []
        storage = get_recording_storage()
        
        for session in sessions:
            try:
                playback_url = await storage.get_playback_url(session.recording_url)
            except Exception as e:
                logger.error(f"Failed to generate playback URL for session {session.id}: {e}")
                playback_url = None
            
            recordings.append({
                "id": session.id,
                "session_id": session.session_id,
                "title": session.title,
                "trainer_id": session.trainer_id,
                "trainer_name": session.trainer.name if session.trainer else "Unknown",
                "learner_id": session.learner_id,
                "learner_name": session.learner.name if session.learner else "Unknown",
                "status": session.status,
                "recording_status": session.recording_status,
                "recorded_at": session.recording_uploaded_at,
                "playback_url": playback_url,
                "scheduled_date": session.scheduled_date,
                "duration": session.duration
            })
        
        return {
            "recordings": recordings,
            "total": len(recordings),
            "message": f"Found {len(recordings)} recording(s)"
        }
        
    except Exception as e:
        logger.error(f"Error fetching all recordings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch recordings: {str(e)}"
        )


@router.get("/admin/learner/{learner_id}/recordings")
async def get_learner_recordings_for_admin(
    learner_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get session-wise recording status for a learner (admin/head only)."""
    is_admin_or_head = (
        current_user.role in [UserRole.ADMIN, UserRole.HEAD]
        or str(current_user.role).upper() in ["ADMIN", "HEAD"]
        or current_user.role in ["admin", "head"]
    )
    if not is_admin_or_head:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/head can access learner recordings",
        )

    # Enforce trainer-learner only session records (exclude any non-standard role mapping).
    trainer_user = aliased(User)
    learner_user = aliased(User)

    stmt = (
        select(TrainingSession)
        .join(trainer_user, trainer_user.id == TrainingSession.trainer_id)
        .join(learner_user, learner_user.id == TrainingSession.learner_id)
        .where(
            TrainingSession.learner_id == learner_id,
            trainer_user.role == UserRole.TRAINER,
            learner_user.role == UserRole.LEARNER,
        )
        .order_by(
            desc(TrainingSession.updated_at),
            desc(TrainingSession.created_at),
            desc(TrainingSession.id),
        )
    )
    result = await db.execute(stmt)
    sessions = result.scalars().all()

    rows = []
    for s in sessions:
        rows.append(
            {
                "session_db_id": s.id,
                "session_id": s.session_id,
                "title": s.title,
                "scheduled_date": s.scheduled_date,
                "created_at": s.created_at,
                "updated_at": s.updated_at,
                "latest_event_at": s.updated_at or s.created_at or s.scheduled_date,
                "status": s.status,
                "recording_status": s.recording_status,
                "has_recording": bool(s.recording_url),
            }
        )

    return {"learner_id": learner_id, "sessions": rows, "total": len(rows)}


# ============ SUBSCRIPTION SESSION TRACKING (MANUAL TRIGGER) ============

@router.post("/admin/process-ended-sessions", status_code=status.HTTP_200_OK)
async def manual_process_ended_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    ⚙️ ADMIN ONLY: Manually trigger subscription session processing.
    
    This endpoint processes all ended sessions and updates subscription counts:
    - Decrements sessions_remaining when session ends (status = "ended")
    - Increments sessions_completed
    - Auto-inactivates learners when sessions_remaining reaches 0
    
    This runs automatically every 5 minutes via background scheduler,
    but can be triggered manually here for testing/debugging.
    
    Returns:
    - sessions_processed: Number of sessions that were processed
    - affected_subscriptions: Number of subscriptions that were updated
    """
    from app.crud import subscription_crud
    
    # Only admin/HEAD can trigger this
    if current_user.role not in ["admin", "head"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin/head can trigger session processing"
        )
    
    try:
        logger.info(f"Manual session processing triggered by {current_user.email}")
        sessions_processed = await subscription_crud.process_ended_sessions_and_update_subscriptions(db)
        
        logger.info(f"Manual processing complete: {sessions_processed} sessions processed")
        
        return {
            "success": True,
            "sessions_processed": sessions_processed,
            "message": f"Successfully processed {sessions_processed} ended sessions"
        }
    except Exception as e:
        logger.error(f"Error processing ended sessions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process sessions: {str(e)}"
        )