"""
Session Notes Endpoints - Auto-save session notes in session_reports table
"""

import logging
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_trainer, get_current_head
from app.crud import session_notes_crud, session_crud
from app.db.session import get_db
from app.models.user_model import TrainerProfile, HeadProfile
from app.schemas.session_notes import SessionNotesCreate, SessionNotesUpdate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/session-notes", tags=["Session Notes"])


@router.post("/{session_id}", status_code=status.HTTP_201_CREATED)
async def create_or_update_notes(
    session_id: str,
    notes_data: SessionNotesCreate,
    db: AsyncSession = Depends(get_db),
    current_trainer: TrainerProfile = Depends(get_current_trainer),
) -> Dict[str, Any]:
    """
    Create or update session notes with auto-save support.
    Trainer can save notes during active session or after completion.
    """
    logger.info(f"Trainer {current_trainer.user_id} saving notes for session {session_id}")

    # Get session by session_id string
    session = await session_crud.get_session_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify trainer is authorized for this session
    if session.trainer_id != current_trainer.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to add notes to this session")

    # Create or update notes (not finalized during active session)
    notes = await session_notes_crud.create_or_update_session_notes(
        db=db,
        session_id=session.id,  # Use internal ID
        trainer_id=current_trainer.user_id,
        notes=notes_data.notes or "",
        is_finalized="false"
    )

    return notes or {"message": "Notes saved successfully"}


@router.get("/{session_id}")
async def get_notes(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_trainer: TrainerProfile = Depends(get_current_trainer),
) -> Optional[Dict[str, Any]]:
    """
    Get session notes for a specific session.
    Returns the latest finalized or draft notes.
    """
    logger.info(f"Trainer {current_trainer.user_id} fetching notes for session {session_id}")

    # Get session by session_id string
    session = await session_crud.get_session_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify trainer is authorized for this session
    if session.trainer_id != current_trainer.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view notes for this session")

    # Get notes
    notes = await session_notes_crud.get_session_notes(db, session.id)
    
    return notes


@router.put("/{session_id}")
async def update_notes(
    session_id: str,
    notes_data: SessionNotesUpdate,
    db: AsyncSession = Depends(get_db),
    current_trainer: TrainerProfile = Depends(get_current_trainer),
) -> Dict[str, Any]:
    """
    Update session notes.
    Same as create_or_update but uses PUT method for clarity.
    """
    logger.info(f"Trainer {current_trainer.user_id} updating notes for session {session_id}")

    # Get session by session_id string
    session = await session_crud.get_session_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify trainer is authorized for this session
    if session.trainer_id != current_trainer.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update notes for this session")

    # Update notes
    notes = await session_notes_crud.create_or_update_session_notes(
        db=db,
        session_id=session.id,
        trainer_id=current_trainer.user_id,
        notes=notes_data.notes or "",
        is_finalized="false"
    )

    return notes or {"message": "Notes updated successfully"}


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
