"""
Head Session Notes Endpoints - For Head to add notes on completed sessions
"""

import logging
from typing import Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_head
from app.crud import head_session_notes_crud
from app.crud import session_crud
from app.db.session import get_db
from app.models.user_model import HeadProfile
from app.schemas.head_session_notes import HeadSessionNotesCreate, HeadSessionNotesUpdate

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/head-session-notes", tags=["Head Session Notes"])


@router.post("/{session_id}", status_code=status.HTTP_201_CREATED)
async def create_or_update_head_notes(
    session_id: int,
    notes_data: HeadSessionNotesCreate,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
) -> Dict[str, Any]:
    """
    Create or update head session notes for completed sessions.
    - First call creates entry (v1)
    - Subsequent calls update same entry and increment version
    - Head can add notes to any completed session (status='ended')
    """
    logger.info(f"Head {current_head.user_id} saving notes for session {session_id}")

    # Get session by internal ID
    session = await session_crud.get_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify session is completed
    if session.status != "ended":
        raise HTTPException(status_code=400, detail="Can only add head notes to completed sessions")

    # Create or update head notes
    notes = await head_session_notes_crud.create_or_update_head_session_notes(
        db=db,
        session_id=session.id,
        head_id=current_head.user_id,
        notes=notes_data.notes or "",
        is_finalized="true"
    )
    
    logger.info(f"✅ Head notes saved successfully for session {session_id}")

    return notes or {"message": "Head notes saved successfully"}


@router.get("/{session_id}")
async def get_head_notes(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
) -> Optional[Dict[str, Any]]:
    """
    Get head session notes for a specific completed session.
    Returns the notes with version info.
    """
    logger.info(f"Head {current_head.user_id} fetching head notes for session {session_id}")

    # Get session by internal ID
    session = await session_crud.get_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get head notes
    notes = await head_session_notes_crud.get_head_session_notes(db, session.id)
    
    return notes


@router.put("/{session_id}")
async def update_head_notes(
    session_id: int,
    notes_data: HeadSessionNotesUpdate,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
) -> Dict[str, Any]:
    """
    Update head session notes (explicit PUT request).
    Same behavior as POST but semantically indicates an update.
    """
    logger.info(f"Head {current_head.user_id} updating head notes for session {session_id}")

    # Get session by internal ID
    session = await session_crud.get_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Verify session is completed
    if session.status != "ended":
        raise HTTPException(status_code=400, detail="Can only add head notes to completed sessions")

    # Update head notes
    notes = await head_session_notes_crud.create_or_update_head_session_notes(
        db=db,
        session_id=session.id,
        head_id=current_head.user_id,
        notes=notes_data.notes or "",
        is_finalized="true"
    )

    return notes or {"message": "Head notes updated successfully"}
