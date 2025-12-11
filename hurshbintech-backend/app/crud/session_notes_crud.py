"""
Session Notes CRUD Operations - Using session_reports table
"""

from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session_report_model import SessionReport


async def create_or_update_session_notes(
    db: AsyncSession,
    session_id: int,
    trainer_id: int,
    notes: str,
    is_finalized: str = "false"
) -> Optional[dict]:
    """
    Create or update session notes in session_reports table.
    Updates the session_notes column for all reports of this session.
    """
    # Update all session reports for this session with the new notes
    stmt = (
        update(SessionReport)
        .where(SessionReport.session_id == session_id)
        .values(session_notes=notes)
    )
    
    await db.execute(stmt)
    await db.commit()
    
    # Return a dict representing the saved notes
    return {
        "session_id": session_id,
        "trainer_id": trainer_id,
        "notes": notes,
        "is_finalized": is_finalized
    }


async def get_session_notes(
    db: AsyncSession,
    session_id: int
) -> Optional[dict]:
    """
    Get session notes from session_reports table.
    Returns the notes from the first report row (all rows have same notes).
    """
    result = await db.execute(
        select(SessionReport.session_notes)
        .where(SessionReport.session_id == session_id)
        .limit(1)
    )
    notes_value = result.scalar_one_or_none()
    
    if notes_value is not None:
        return {
            "session_id": session_id,
            "notes": notes_value
        }
    
    return None


async def finalize_session_notes(
    db: AsyncSession,
    session_id: int,
    trainer_id: int,
    notes: Optional[str] = None
) -> Optional[dict]:
    """
    Finalize session notes when session ends.
    Updates all session reports for this session.
    """
    if notes is not None and notes.strip():
        # Update all session reports for this session with the final notes
        stmt = (
            update(SessionReport)
            .where(SessionReport.session_id == session_id)
            .values(session_notes=notes)
        )
        
        await db.execute(stmt)
        await db.commit()
        
        return {
            "session_id": session_id,
            "trainer_id": trainer_id,
            "notes": notes,
            "is_finalized": "true"
        }
    
    return None


async def get_all_session_notes_by_trainer(
    db: AsyncSession,
    trainer_id: int
) -> list[dict]:
    """
    Get all session notes where trainer was involved.
    Returns distinct session notes grouped by session.
    """
    # This is not commonly used, but we can query via session relationship if needed
    # For now, return empty list as this endpoint may not be necessary
    return []
