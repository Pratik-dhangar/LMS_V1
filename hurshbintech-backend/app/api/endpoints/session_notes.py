"""
Session Notes Endpoints - Independent auto-save with version tracking and disconnect recovery
"""

import logging
from typing import Optional, Dict, Any, Union

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_trainer_optional, get_current_coach_optional, get_current_trainer, get_current_coach, get_current_head
from app.crud import session_notes_crud, session_crud
from app.db.session import get_db
from app.models.user_model import TrainerProfile, HeadProfile, CoachProfile
from app.schemas.session_notes import SessionNotesCreate, SessionNotesUpdate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/session-notes", tags=["Session Notes"])


async def get_session_user(
    current_trainer: Optional[TrainerProfile] = Depends(get_current_trainer_optional),
    current_coach: Optional[CoachProfile] = Depends(get_current_coach_optional),
) -> Union[TrainerProfile, CoachProfile]:
    """Get current user - either trainer or coach"""
    if current_trainer:
        return current_trainer
    if current_coach:
        return current_coach
    raise HTTPException(status_code=401, detail="Not authenticated")


@router.post("/{session_id}", status_code=status.HTTP_201_CREATED)
async def create_or_update_notes(
    session_id: str,
    notes_data: SessionNotesCreate,
    db: AsyncSession = Depends(get_db),
    current_trainer: Optional[TrainerProfile] = Depends(get_current_trainer_optional),
    current_coach: Optional[CoachProfile] = Depends(get_current_coach_optional),
) -> Dict[str, Any]:
    """
    Create or update session notes with auto-save support.
    - First call creates entry (v1)
    - Subsequent calls update same entry and increment version
    - Notes are independent from session reports
    - Trainer and Coaches can save notes at any time (before/during/after session report creation)
    
    **Frontend Integration:**
    - Call with debounce: waits 10s of inactivity
    - Only saves if content has changed
    - Shows "Saving..." indicator during request
    """
    # Determine current user (trainer or coach)
    current_user = current_trainer or current_coach
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_type = "Trainer" if current_trainer else "Coach"
    logger.info(f"{user_type} {current_user.user_id if current_trainer else current_user.id} saving notes for session {session_id}")

    # Get session by session_id string - check both trainer and coach sessions
    session = await session_crud.get_session_by_id(db, session_id)
    coach_session = None
    
    if not session and current_coach:
        # For coaches, check coach_appointment_sessions table
        from app.crud.coach_appointment_session_crud import get_session_by_id as get_coach_session_by_id
        coach_session = await get_coach_session_by_id(db, session_id)
    
    if not session and not coach_session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify user is authorized for this session
    if current_trainer and session:
        if session.trainer_id != current_trainer.user_id:
            raise HTTPException(status_code=403, detail="Not authorized to add notes to this session")
    elif current_coach and coach_session:
        if coach_session.coach_id != current_coach.id:
            raise HTTPException(status_code=403, detail="Not authorized to add notes to this session")

    # Create or update notes (not finalized during active session)
    # Use correct session IDs based on session type
    training_session_id = session.id if session else None
    coach_appointment_session_id = coach_session.id if coach_session else None
    notes_trainer_id = current_trainer.user_id if current_trainer else None
    notes_coach_id = current_coach.id if current_coach else None
    
    notes = await session_notes_crud.create_or_update_session_notes(
        db=db,
        session_id=training_session_id,
        coach_appointment_session_id=coach_appointment_session_id,
        trainer_id=notes_trainer_id,
        coach_id=notes_coach_id,
        notes=notes_data.notes or "",
        is_finalized="false"
    )
    
    logger.info(f"✅ Notes saved successfully for session {session_id}, content length: {len(notes_data.notes or '')}")

    return notes or {"message": "Notes saved successfully"}


@router.get("/{session_id}")
async def get_notes(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_trainer: Optional[TrainerProfile] = Depends(get_current_trainer_optional),
    current_coach: Optional[CoachProfile] = Depends(get_current_coach_optional),
) -> Optional[Dict[str, Any]]:
    """
    Get session notes for a specific session.
    Returns the notes with version info and finalization status.
    """
    # Determine current user (trainer or coach)
    current_user = current_trainer or current_coach
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_type = "Trainer" if current_trainer else "Coach"
    logger.info(f"{user_type} {current_user.user_id if current_trainer else current_user.id} fetching notes for session {session_id}")

    # Get session by session_id string - check both trainer and coach sessions
    session = await session_crud.get_session_by_id(db, session_id)
    coach_session = None
    
    if not session and current_coach:
        # For coaches, check coach_appointment_sessions table
        from app.crud.coach_appointment_session_crud import get_session_by_id as get_coach_session_by_id
        coach_session = await get_coach_session_by_id(db, session_id)
    
    if not session and not coach_session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify user is authorized for this session
    if current_trainer and session:
        if session.trainer_id != current_trainer.user_id:
            raise HTTPException(status_code=403, detail="Not authorized to view notes for this session")
    elif current_coach and coach_session:
        if coach_session.coach_id != current_coach.id:
            raise HTTPException(status_code=403, detail="Not authorized to view notes for this session")

    # Get notes
    training_session_id = session.id if session else None
    coach_appointment_session_id = coach_session.id if coach_session else None
    notes = await session_notes_crud.get_session_notes(
        db,
        session_id=training_session_id,
        coach_appointment_session_id=coach_appointment_session_id
    )
    
    return notes


@router.put("/{session_id}")
async def update_notes(
    session_id: str,
    notes_data: SessionNotesUpdate,
    db: AsyncSession = Depends(get_db),
    current_trainer: Optional[TrainerProfile] = Depends(get_current_trainer_optional),
    current_coach: Optional[CoachProfile] = Depends(get_current_coach_optional),
) -> Dict[str, Any]:
    """
    Update session notes (explicit PUT request).
    Same behavior as POST but semantically indicates an update.
    Supports both Trainers and Coaches.
    """
    # Determine current user (trainer or coach)
    current_user = current_trainer or current_coach
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_type = "Trainer" if current_trainer else "Coach"
    logger.info(f"{user_type} {current_user.user_id if current_trainer else current_user.id} updating notes for session {session_id}")

    # Get session by session_id string - check both trainer and coach sessions
    session = await session_crud.get_session_by_id(db, session_id)
    coach_session = None
    
    if not session and current_coach:
        # For coaches, check coach_appointment_sessions table
        from app.crud.coach_appointment_session_crud import get_session_by_id as get_coach_session_by_id
        coach_session = await get_coach_session_by_id(db, session_id)
    
    if not session and not coach_session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify user is authorized for this session
    if current_trainer and session:
        if session.trainer_id != current_trainer.user_id:
            raise HTTPException(status_code=403, detail="Not authorized to update notes for this session")
    elif current_coach and coach_session:
        if coach_session.coach_id != current_coach.id:
            raise HTTPException(status_code=403, detail="Not authorized to update notes for this session")

    # Update notes
    training_session_id = session.id if session else None
    coach_appointment_session_id = coach_session.id if coach_session else None
    notes_trainer_id = current_trainer.user_id if current_trainer else None
    notes_coach_id = current_coach.id if current_coach else None
    
    notes = await session_notes_crud.create_or_update_session_notes(
        db=db,
        session_id=training_session_id,
        coach_appointment_session_id=coach_appointment_session_id,
        trainer_id=notes_trainer_id,
        coach_id=notes_coach_id,
        notes=notes_data.notes or "",
        is_finalized="false"
    )

    return notes or {"message": "Notes updated successfully"}


@router.post("/{session_id}/force-save")
async def force_save_notes(
    session_id: str,
    notes_data: SessionNotesCreate,
    db: AsyncSession = Depends(get_db),
    current_trainer: TrainerProfile = Depends(get_current_trainer),
) -> Dict[str, Any]:
    """
    Force save session notes immediately on disconnect recovery.
    Bypasses normal debounce, ensures data persistence.
    
    **Use Cases:**
    - WebSocket disconnected, trainer reconnects
    - Browser loses internet, then regains connection
    - Trainer closes app without normal shutdown
    
    **Frontend Integration:**
    - Call on WebSocket disconnect event
    - Call before page unload with unsaved changes
    - Call on connection restoration
    """
    logger.warning(f"Trainer {current_trainer.user_id} force-saving notes for session {session_id} (DISCONNECT RECOVERY)")

    # Get session by session_id string
    session = await session_crud.get_session_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify trainer is authorized for this session
    if session.trainer_id != current_trainer.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to save notes for this session")

    # Force save notes
    notes = await session_notes_crud.force_save_session_notes(
        db=db,
        session_id=session.id,
        trainer_id=current_trainer.user_id,
        notes=notes_data.notes or ""
    )
    
    if notes:
        logger.warning(f"⚠️ Notes force-saved for session {session_id} (v{notes.get('version', '?')})")
        return notes
    else:
        raise HTTPException(status_code=500, detail="Failed to force save notes")


@router.post("/{session_id}/finalize")
async def finalize_notes(
    session_id: str,
    notes_data: Optional[SessionNotesCreate] = None,
    db: AsyncSession = Depends(get_db),
    current_trainer: TrainerProfile = Depends(get_current_trainer),
) -> Dict[str, Any]:
    """
    Finalize session notes when session ends.
    Marks notes as finalized and prevents further auto-saves.
    
    **Use Cases:**
    - Called after session.status changes to 'ended'
    - Trainer explicitly marks notes as complete
    - Session timeout or forced end
    
    **Optional:** Can provide final notes content if not yet saved
    """
    logger.info(f"Trainer {current_trainer.user_id} finalizing notes for session {session_id}")

    # Get session by session_id string
    session = await session_crud.get_session_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify trainer is authorized for this session
    if session.trainer_id != current_trainer.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to finalize notes for this session")

    # Finalize notes
    final_notes = notes_data.notes if notes_data else None
    notes = await session_notes_crud.finalize_session_notes(
        db=db,
        session_id=session.id,
        notes=final_notes
    )
    
    if notes:
        logger.info(f"✅ Notes finalized for session {session_id} (v{notes.get('version', '?')})")
        return notes
    else:
        return {"message": "Notes finalization completed"}


@router.get("/{session_id}/with-details")
async def get_notes_with_details(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_trainer: TrainerProfile = Depends(get_current_trainer),
) -> Optional[Dict[str, Any]]:
    """
    Get session notes with related session details.
    Includes session title, status, timing info for context.
    """
    logger.info(f"Trainer {current_trainer.user_id} fetching notes with details for session {session_id}")

    # Get session by session_id string
    session = await session_crud.get_session_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify trainer is authorized for this session
    if session.trainer_id != current_trainer.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view notes for this session")

    # Get notes with details
    notes = await session_notes_crud.get_session_notes_with_session_details(db, session.id)
    
    return notes


@router.get("/by-session-internal/{session_internal_id}")
async def get_notes_by_internal_id(
    session_internal_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
) -> Optional[Dict[str, Any]]:
    """
    Get session notes by internal session ID.
    Used by Head to view notes for any session.
    """
    logger.info(f"Head {current_head.user_id} fetching notes for session ID {session_internal_id}")

    # Get notes
    notes = await session_notes_crud.get_session_notes(db, session_internal_id)
    
    return notes
