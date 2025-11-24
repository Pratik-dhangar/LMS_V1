"""
Training Session Endpoints - Video conferencing sessions
"""
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict
import json
import logging

from app.db.session import get_db
from app.schemas.session import SessionCreate, SessionResponse, SessionEnd
from app.models.user_model import User, TrainerProfile, LearnerProfile, HeadProfile
from app.models.session_model import TrainingSession
from app.core.deps import get_current_user, get_current_trainer, get_current_learner, get_current_head
from app.crud import session_crud, user_crud

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["Training Sessions"])

# In-memory storage for WebSocket connections per session
active_connections: Dict[str, List[WebSocket]] = {}


@router.get("/all", response_model=List[SessionResponse])
async def get_all_sessions(
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head)
):
    """Get all sessions created by current Head"""
    logger.info(f"Head {current_head.user_id} fetching all sessions")
    
    # Import here to avoid circular imports
    from app.crud.session_crud import get_all_sessions_by_head
    
    sessions = await get_all_sessions_by_head(db, current_head.user_id)
    return [build_session_response(s) for s in sessions]


# Helper function to build SessionResponse from TrainingSession model
def build_session_response(session: TrainingSession) -> SessionResponse:
    """Build SessionResponse from TrainingSession model"""
    return SessionResponse(
        id=session.id,
        session_id=session.session_id,
        title=session.title,
        description=session.description,
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
        learning_contents=[
            {
                "id": content.id,
                "title": content.title,
                "content_type": content.content_type.value,
                "file_url": content.file_url,
                "thumbnail_url": content.thumbnail_url
            }
            for content in (session.learning_contents or [])
        ],
        learning_goals=[
            {
                "id": goal.id,
                "goal": goal.goal,
                "goal_description": goal.goal_description
            }
            for goal in (session.learning_goals or [])
        ]
    )


# ============ TRAINER ENDPOINTS ============

@router.post("/create", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_training_session(
    session_data: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Head creates a new training session"""
    logger.info(f"User {current_user.id} ({current_user.role}) attempting to create session")
    
    # Only Head can create sessions
    # Handle both enum and string comparison
    from app.models.user_model import UserRole
    is_head = (current_user.role == UserRole.HEAD) or (str(current_user.role).upper() == "HEAD") or (current_user.role == "head")
    logger.info(f"Is head check: {is_head}, role value: {current_user.role}, role type: {type(current_user.role)}")
    
    if not is_head:
        logger.warning(f"User {current_user.id} with role {current_user.role} attempted to create session")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Only Head users can create sessions"
        )
    
    # Head must specify trainer_id
    if not session_data.trainer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Head must specify trainer_id when creating session"
        )
    
    logger.info(f"Head {current_user.id} creating session for trainer {session_data.trainer_id} and learner {session_data.learner_id}")
    
    new_session = await session_crud.create_session(
        db, session_data, current_user.id
    )
    
    logger.info(f"Session created successfully: {new_session.session_id}")
    return build_session_response(new_session)


@router.get("/trainer/sessions", response_model=List[SessionResponse])
async def get_trainer_sessions_list(
    db: AsyncSession = Depends(get_db),
    current_trainer: TrainerProfile = Depends(get_current_trainer)
):
    """Get all sessions for current trainer"""
    logger.info(f"Fetching sessions for trainer {current_trainer.user_id}")
    
    sessions = await session_crud.get_trainer_sessions(db, current_trainer.user_id)
    
    return [build_session_response(s) for s in sessions]


@router.post("/{session_id}/start", response_model=SessionResponse)
async def start_training_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_trainer: TrainerProfile = Depends(get_current_trainer)
):
    """Start a scheduled session"""
    logger.info(f"Trainer {current_trainer.user_id} starting session {session_id}")
    
    session = await session_crud.get_session_by_id(db, session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.trainer_id != current_trainer.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to start this session")
    
    if session.status != "scheduled":
        raise HTTPException(status_code=400, detail="Session is not in scheduled state")
    
    started_session = await session_crud.start_session(db, session_id)
    
    return build_session_response(started_session)


@router.post("/{session_id}/end")
async def end_training_session(
    session_id: str,
    session_end: SessionEnd,
    db: AsyncSession = Depends(get_db),
    current_trainer: TrainerProfile = Depends(get_current_trainer)
):
    """End an active session"""
    logger.info(f"Trainer {current_trainer.user_id} ending session {session_id}")

    session = await session_crud.get_session_by_id(db, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.trainer_id != current_trainer.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to end this session")

    ended_session = await session_crud.end_session(db, session_id, session_end.notes)

    # Broadcast session end to all participants via WebSocket
    if session_id in active_connections:
        end_message = {
            "type": "session_ended",
            "payload": {
                "session_id": session_id,
                "ended_by": "trainer",
                "ended_at": ended_session.ended_at.isoformat() if ended_session.ended_at else None,
                "notes": session_end.notes
            }
        }
        for connection in active_connections[session_id]:
            try:
                await connection.send_text(json.dumps(end_message))
            except Exception as e:
                logger.error(f"Failed to send session end message: {e}")

    return {"message": "Session ended successfully"}


# ============ LEARNER ENDPOINTS ============

@router.get("/learner/sessions", response_model=List[SessionResponse])
async def get_learner_sessions_list(
    db: AsyncSession = Depends(get_db),
    current_learner: LearnerProfile = Depends(get_current_learner)
):
    """Get active sessions for current learner"""
    logger.info(f"Fetching sessions for learner {current_learner.user_id}")
    
    sessions = await session_crud.get_learner_sessions(db, current_learner.user_id)
    
    return [build_session_response(s) for s in sessions]


@router.post("/{session_id}/join")
async def join_training_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_learner: LearnerProfile = Depends(get_current_learner)
):
    """Learner joins an active session"""
    logger.info(f"Learner {current_learner.user_id} joining session {session_id}")
    
    session = await session_crud.get_session_by_id(db, session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.learner_id != current_learner.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to join this session")
    
    if session.status != "active":
        raise HTTPException(status_code=400, detail="Session is not active")
    
    return {"message": "Joined session successfully"}


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session_details(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get session details"""
    logger.info(f"User {current_user.id} fetching session {session_id}")
    
    session = await session_crud.get_session_by_id(db, session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify user is part of the session
    if current_user.id not in [session.trainer_id, session.learner_id]:
        raise HTTPException(status_code=403, detail="Not authorized to view this session")
    
    return build_session_response(session)


# ============ WEBSOCKET ENDPOINT ============

@router.websocket("/ws/{session_id}/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    user_id: int
):
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
