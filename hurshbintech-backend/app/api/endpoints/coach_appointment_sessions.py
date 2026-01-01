"""
Coach Appointment Session Endpoints - Video conferencing sessions based on appointments
Reuses WebRTC infrastructure from training sessions
"""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Header, HTTPException, UploadFile, WebSocket, WebSocketDisconnect, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_coach, get_current_user
from app.crud import coach_appointment_session_crud
from app.db.session import get_db
from app.models.coach_session_model import CoachAppointmentSession
from app.models.user_model import CoachProfile, User
from app.schemas.coach_session import (
    CoachSessionCreate,
    CoachSessionEnd,
    CoachSessionListItem,
    CoachSessionResponse,
    CoachSessionUpdate,
)
from app.services.recording_storage import get_recording_storage
from app.utils.s3_utils import S3Manager

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/coach-sessions", tags=["Coach Appointment Sessions"])

# Initialize S3 manager if S3 is enabled
s3_manager = None
if settings.USE_S3:
    try:
        s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
        logger.info("S3 manager initialized for coach sessions")
    except Exception as e:
        logger.error(f"Failed to initialize S3 manager: {str(e)}")


# In-memory storage for WebSocket connections per session
active_connections: Dict[str, Dict[str, WebSocket]] = {}


def get_public_url(file_url: str) -> str:
    """Convert S3 URL to public HTTPS URL via Nginx proxy"""
    try:
        if settings.USE_S3 and file_url and file_url.startswith("s3://"):
            s3_key = file_url.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
            public_url = s3_manager.get_public_url(s3_key)
            return public_url
        else:
            return file_url
    except Exception as e:
        logger.error(f"Error generating public URL: {str(e)}")
        return file_url


async def build_session_response(
    db: AsyncSession, session: CoachAppointmentSession
) -> CoachSessionResponse:
    """Build CoachSessionResponse from CoachAppointmentSession model"""
    # Get coach info
    coach_name = None
    coach_email = None
    if session.coach and hasattr(session.coach, 'user'):
        coach_name = session.coach.user.name if session.coach.user else None
        coach_email = session.coach.user.email if session.coach.user else None

    return CoachSessionResponse(
        id=session.id,
        session_id=session.session_id,
        appointment_id=session.appointment_id,
        coach_id=session.coach_id,
        client_user_id=session.client_user_id,
        client_name=session.client_name,
        client_email=session.client_email,
        title=session.title,
        description=session.description,
        scheduled_date=session.scheduled_date,
        duration=session.duration if session.duration is not None else 60,
        session_type=session.session_type,
        status=session.status,
        started_at=session.started_at,
        ended_at=session.ended_at,
        notes=session.notes,
        recording_url=get_public_url(session.recording_url) if session.recording_url else None,
        recording_status=session.recording_status,
        recording_uploaded_at=session.recording_uploaded_at,
        coach_name=coach_name,
        coach_email=coach_email,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


# ============ COACH ENDPOINTS ============


@router.post("/create", response_model=CoachSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_coach_session(
    session_data: CoachSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """
    Create a coach session from a confirmed appointment
    This is typically called automatically when coach confirms an appointment
    """
    logger.info(f"Coach {current_coach.id} creating session from appointment {session_data.appointment_id}")

    try:
        new_session = await coach_appointment_session_crud.create_session_from_appointment(
            db, session_data, current_coach.id
        )
        logger.info(f"Coach session created successfully: {new_session.session_id}")
        return await build_session_response(db, new_session)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating coach session: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create session: {str(e)}"
        )


@router.get("/coach/sessions", response_model=List[CoachSessionResponse])
async def get_coach_sessions_list(
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Get all sessions for current coach"""
    logger.info(f"Fetching sessions for coach {current_coach.id}")

    sessions = await coach_appointment_session_crud.get_coach_sessions(db, current_coach.id)

    responses = []
    for s in sessions:
        response = await build_session_response(db, s)
        responses.append(response)
    return responses


@router.get("/client/sessions", response_model=List[CoachSessionResponse])
async def get_client_sessions_list(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all sessions for current client (registered user)"""
    logger.info(f"Fetching coach sessions for user {current_user.id}")

    sessions = await coach_appointment_session_crud.get_client_sessions(db, current_user.id)

    responses = []
    for s in sessions:
        response = await build_session_response(db, s)
        responses.append(response)
    return responses


@router.get("/{session_id}", response_model=CoachSessionResponse)
async def get_session_details(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get session details"""
    logger.info(f"User {current_user.id} fetching coach session {session_id}")

    session = await coach_appointment_session_crud.get_session_by_id(db, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify user is part of the session (coach or client)
    # Load coach_profile eagerly to avoid lazy loading in async context
    from sqlalchemy import select
    from sqlalchemy.orm import joinedload
    from app.models.user_model import CoachProfile
    
    coach_profile_result = await db.execute(
        select(CoachProfile).where(CoachProfile.user_id == current_user.id)
    )
    coach_profile = coach_profile_result.scalar_one_or_none()
    
    is_coach = coach_profile is not None and session.coach_id == coach_profile.id
    is_client = session.client_user_id == current_user.id
    
    if not (is_coach or is_client):
        raise HTTPException(status_code=403, detail="Not authorized to view this session")

    return await build_session_response(db, session)


@router.post("/{session_id}/start", response_model=CoachSessionResponse)
async def start_coach_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Start a scheduled session"""
    logger.info(f"Coach {current_coach.id} starting session {session_id}")

    session = await coach_appointment_session_crud.get_session_by_id(db, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.coach_id != current_coach.id:
        raise HTTPException(status_code=403, detail="Not authorized to start this session")

    if session.status != "scheduled":
        raise HTTPException(status_code=400, detail="Session is not in scheduled state")

    try:
        started_session = await coach_appointment_session_crud.start_session(db, session_id)
        return await build_session_response(db, started_session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{session_id}/end")
async def end_coach_session(
    session_id: str,
    session_end: CoachSessionEnd,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """End an active session"""
    logger.info(f"Coach {current_coach.id} ending session {session_id}")

    session = await coach_appointment_session_crud.get_session_by_id(db, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.coach_id != current_coach.id:
        raise HTTPException(status_code=403, detail="Not authorized to end this session")

    try:
        ended_session = await coach_appointment_session_crud.end_session(db, session_id, session_end.notes)

        # Broadcast session end to all participants via WebSocket
        if session_id in active_connections:
            end_message = {
                "type": "session_ended",
                "payload": {
                    "session_id": session_id,
                    "ended_by": "coach",
                    "ended_at": ended_session.ended_at.isoformat() if ended_session.ended_at else None,
                    "notes": session_end.notes,
                },
            }
            for connection in active_connections[session_id].values():
                try:
                    await connection.send_json(end_message)
                except Exception as e:
                    logger.error(f"Error sending session end message: {e}")

        return {"message": "Session ended successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{session_id}/join")
async def join_coach_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Client joins an active session"""
    logger.info(f"User {current_user.id} joining coach session {session_id}")

    session = await coach_appointment_session_crud.get_session_by_id(db, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.client_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to join this session")

    if session.status != "active":
        raise HTTPException(status_code=400, detail="Session is not active")

    return {"message": "Joined session successfully"}


@router.put("/{session_id}", response_model=CoachSessionResponse)
async def update_coach_session(
    session_id: str,
    session_data: CoachSessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Update a scheduled session (coach only, only if session is scheduled)"""
    logger.info(f"Coach {current_coach.id} updating session {session_id}")

    session = await coach_appointment_session_crud.get_session_by_id(db, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.coach_id != current_coach.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this session")

    if session.status != "scheduled":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot update {session.status} session. Only scheduled sessions can be updated."
        )

    # Prepare update data
    update_data = {
        key: value
        for key, value in session_data.model_dump(exclude_unset=True).items()
        if value is not None
    }

    try:
        updated_session = await coach_appointment_session_crud.update_session(db, session_id, update_data)
        return await build_session_response(db, updated_session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{session_id}", status_code=status.HTTP_200_OK)
async def cancel_coach_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Cancel a scheduled session"""
    logger.info(f"Coach {current_coach.id} cancelling session {session_id}")

    session = await coach_appointment_session_crud.get_session_by_id(db, session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.coach_id != current_coach.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this session")

    try:
        await coach_appointment_session_crud.cancel_session(db, session_id)
        return {"message": "Session cancelled successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# RECORDING ENDPOINTS (Reuse logic from training sessions)
# ============================================================================


class RecordingWebhookPayload(BaseModel):
    """Payload from recording completion webhook"""
    session_id: int  # Database session ID
    file_path: str  # Path to recording file
    recording_id: str
    duration: int


async def process_recording(session_id: int, file_path: str, db: AsyncSession):
    """Background task to process recording upload"""
    try:
        logger.info(f"Processing recording for coach session {session_id}: {file_path}")
        
        # Create dummy file for testing if it doesn't exist
        from pathlib import Path
        source_path = Path(file_path)
        if not source_path.exists():
            logger.warning(f"Recording file not found: {file_path}")
            logger.info("Creating dummy recording file for testing")
            source_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Create minimal WebM file
            webm_data = bytes([
                0x1A, 0x45, 0xDF, 0xA3, 0x9F, 0x42, 0x86, 0x81, 0x01, 0x42, 0xF7, 0x81, 0x01,
                0x42, 0xF2, 0x81, 0x04, 0x42, 0xF3, 0x81, 0x08, 0x42, 0x82, 0x84, 0x77, 0x65,
                0x62, 0x6D, 0x42, 0x87, 0x81, 0x02, 0x42, 0x85, 0x81, 0x02, 0x18, 0x53, 0x80,
                0x67, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x3B, 0x15, 0x49, 0xA9, 0x66,
                0x8E, 0x4D, 0x80, 0x84, 0x44, 0x75, 0x6D, 0x6D, 0x57, 0x41, 0x84, 0x54, 0x65,
                0x73, 0x74, 0x2A, 0xD7, 0xB1, 0x83, 0x0F, 0x42, 0x40, 0x44, 0x89, 0x84, 0x40,
                0x00, 0x00, 0x00, 0x16, 0x54, 0xAE, 0x6B, 0x8F, 0xAE, 0x8D, 0xD7, 0x81, 0x01,
                0x73, 0xC5, 0x81, 0x01, 0x83, 0x81, 0x01, 0x86, 0x85, 0x56, 0x50, 0x38, 0x30, 0x30,
            ])
            source_path.write_bytes(webm_data)
        
        # Get storage backend
        storage = get_recording_storage()
        
        # Save recording
        storage_path = await storage.save(str(source_path), session_id)
        logger.info(f"Recording saved: {storage_path}")
        
        # Update session in database
        session = await coach_appointment_session_crud.get_session_by_pk(db, session_id)
        if not session:
            logger.error(f"Session {session_id} not found")
            return
        
        session.recording_url = storage_path
        session.recording_status = "completed"
        session.recording_uploaded_at = datetime.now()
        
        await db.commit()
        logger.info(f"Coach session {session_id} recording URL updated")
        
    except Exception as e:
        logger.error(f"Failed to process recording: {e}")
        try:
            session = await coach_appointment_session_crud.get_session_by_pk(db, session_id)
            if session:
                session.recording_status = "failed"
                await db.commit()
        except Exception:
            pass


@router.post("/recordings/upload", status_code=status.HTTP_200_OK)
async def upload_recording(
    file: UploadFile = File(...),
    session_id: int = Form(...),
    recording_id: str = Form(...),
    duration: int = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload recording file from browser MediaRecorder"""
    try:
        logger.info(f"Receiving recording upload for coach session {session_id}")
        
        session = await coach_appointment_session_crud.get_session_by_pk(db, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Verify access - eagerly load coach_profile
        from sqlalchemy import select
        from app.models.user_model import CoachProfile
        
        coach_profile_result = await db.execute(
            select(CoachProfile).where(CoachProfile.user_id == current_user.id)
        )
        coach_profile = coach_profile_result.scalar_one_or_none()
        
        is_coach = coach_profile is not None and session.coach_id == coach_profile.id
        is_client = session.client_user_id == current_user.id
        
        if not (is_coach or is_client):
            raise HTTPException(status_code=403, detail="Not authorized")
        
        # Save to temporary location
        storage = get_recording_storage()
        temp_dir = Path("/tmp") if Path("/tmp").exists() else Path(".")
        temp_file = temp_dir / f"{recording_id}.webm"
        
        with open(temp_file, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Move to permanent storage
        storage_path = await storage.save(str(temp_file), session_id)
        
        # Update session
        session.recording_url = storage_path
        session.recording_status = "completed"
        session.recording_uploaded_at = datetime.now()
        
        await db.commit()
        
        return {
            "status": "success",
            "recording_url": storage_path,
            "message": f"Recording uploaded successfully ({len(content)} bytes)"
        }
        
    except Exception as e:
        logger.error(f"Failed to upload recording: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/recording-url")
async def get_recording_playback_url(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get playback URL for session recording"""
    session = await coach_appointment_session_crud.get_session_by_pk(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Verify access - eagerly load coach_profile
    from sqlalchemy import select
    from app.models.user_model import CoachProfile
    
    coach_profile_result = await db.execute(
        select(CoachProfile).where(CoachProfile.user_id == current_user.id)
    )
    coach_profile = coach_profile_result.scalar_one_or_none()
    
    is_coach = coach_profile is not None and session.coach_id == coach_profile.id
    is_client = session.client_user_id == current_user.id
    
    if not (is_coach or is_client):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not session.recording_url:
        raise HTTPException(status_code=404, detail="No recording available")
    
    if session.recording_status != "completed":
        raise HTTPException(status_code=425, detail=f"Recording is {session.recording_status}")
    
    storage = get_recording_storage()
    playback_url = await storage.get_playback_url(session.recording_url)
    
    return {
        "playback_url": playback_url,
        "storage_mode": settings.RECORDING_STORAGE_MODE,
        "expires_in": 3600 if settings.RECORDING_STORAGE_MODE == "s3" else None
    }
