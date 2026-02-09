"""
Session Notes CRUD Operations - Using independent session_notes table
Supports auto-save with version tracking and disconnect recovery
"""

import logging
from typing import Optional, Dict, Any

from sqlalchemy import select, update, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.session_notes_model import SessionNotes

logger = logging.getLogger(__name__)


def _session_notes_to_dict(notes: SessionNotes) -> Dict[str, Any]:
    """Convert SessionNotes model to dictionary"""
    return {
        "id": notes.id,
        "session_id": notes.session_id,
        "coach_appointment_session_id": notes.coach_appointment_session_id,
        "trainer_id": notes.trainer_id,
        "coach_id": notes.coach_id,
        "notes": notes.notes,
        "version": notes.version,
        "is_finalized": notes.is_finalized,
        "created_at": notes.created_at,
        "updated_at": notes.updated_at,
    }


async def create_or_update_session_notes(
    db: AsyncSession,
    session_id: Optional[int] = None,
    coach_appointment_session_id: Optional[int] = None,
    trainer_id: Optional[int] = None,
    coach_id: Optional[int] = None,
    notes: str = "",
    is_finalized: str = "false"
) -> Optional[Dict[str, Any]]:
    """
    Create or update session notes for either training sessions or coach appointment sessions.
    - Trainer and Coach can have INDEPENDENT notes for the same session
    - First time: creates new entry with version 1
    - Subsequent: updates same entry (from same trainer/coach) and increments version
    - Auto-saves with debounce (10s of inactivity)
    - Handles disconnect recovery
    
    Key change: Uses composite unique constraints (session_id + trainer_id) or 
    (coach_appointment_session_id + coach_id) to allow multiple notes per session
    """
    if not session_id and not coach_appointment_session_id:
        logger.error("❌ Neither session_id nor coach_appointment_session_id provided")
        raise ValueError("Either session_id or coach_appointment_session_id must be provided")
    
    if (session_id and not trainer_id) and (coach_appointment_session_id and not coach_id):
        logger.error("❌ trainer_id required for training session notes, coach_id required for coach session")
        raise ValueError("trainer_id or coach_id must be provided for respective session type")
    
    session_type = "training" if session_id else "coach appointment"
    session_ref = session_id or coach_appointment_session_id
    user_ref = trainer_id or coach_id
    user_type = "trainer" if trainer_id else "coach"
    
    try:
        # Find existing notes for THIS specific trainer/coach for this session
        # This allows multiple people to have independent notes for the same session
        if session_id and trainer_id:
            query = select(SessionNotes).where(
                (SessionNotes.session_id == session_id) & 
                (SessionNotes.trainer_id == trainer_id)
            )
        elif coach_appointment_session_id and coach_id:
            query = select(SessionNotes).where(
                (SessionNotes.coach_appointment_session_id == coach_appointment_session_id) & 
                (SessionNotes.coach_id == coach_id)
            )
        else:
            raise ValueError("Invalid combination of session_id/trainer_id or coach_appointment_session_id/coach_id")
        
        result = await db.execute(query)
        existing_notes = result.scalar_one_or_none()

        if existing_notes:
            # Update existing entry - only update if it belongs to this trainer/coach
            stmt = update(SessionNotes).where(SessionNotes.id == existing_notes.id)
            
            stmt = stmt.values(
                notes=notes,
                version=SessionNotes.version + 1,
                is_finalized=is_finalized
            )
            
            await db.execute(stmt)
            await db.commit()
            
            # Fetch updated record
            result = await db.execute(query)
            updated_notes = result.scalar_one_or_none()
            
            if updated_notes:
                logger.info(
                    f"✅ Session notes updated for {user_type} {user_ref} in {session_type} session {session_ref} "
                    f"(v{updated_notes.version}) - Content length: {len(notes)}"
                )
                return _session_notes_to_dict(updated_notes)
        else:
            # Create new entry for this trainer/coach
            try:
                db_notes = SessionNotes(
                    session_id=session_id,
                    coach_appointment_session_id=coach_appointment_session_id,
                    trainer_id=trainer_id,
                    coach_id=coach_id,
                    notes=notes,
                    version=1,
                    is_finalized=is_finalized
                )
                db.add(db_notes)
                await db.commit()
                await db.refresh(db_notes)
                
                logger.info(
                    f"✅ Session notes created for {user_type} {user_ref} in {session_type} session {session_ref} "
                    f"(v1) - Content length: {len(notes)}"
                )
                return _session_notes_to_dict(db_notes)
                
            except IntegrityError as e:
                # If insert fails due to unique constraint, it means a concurrent request
                # created the record. Fetch and update it instead.
                await db.rollback()
                logger.warning(
                    f"⚠️ Concurrent insert detected for {user_type} {user_ref} in {session_type} session {session_ref}. "
                    f"Retrying with update. Error: {str(e)}"
                )
                
                # Re-query to get the newly created record
                result = await db.execute(query)
                existing_notes = result.scalar_one_or_none()
                
                if existing_notes:
                    # Update the record that was just created by another concurrent request
                    stmt = update(SessionNotes).where(SessionNotes.id == existing_notes.id)
                    
                    stmt = stmt.values(
                        notes=notes,
                        version=SessionNotes.version + 1,
                        is_finalized=is_finalized,
                        trainer_id=trainer_id or existing_notes.trainer_id,
                        coach_id=coach_id or existing_notes.coach_id,
                    )
                    
                    await db.execute(stmt)
                    await db.commit()
                    
                    result = await db.execute(query)
                    updated_notes = result.scalar_one_or_none()
                    
                    if updated_notes:
                        logger.info(
                            f"✅ Session notes updated (after conflict) for {user_type} {user_ref} in {session_type} session {session_ref} "
                            f"(v{updated_notes.version}) - Content length: {len(notes)}"
                        )
                        return _session_notes_to_dict(updated_notes)
                else:
                    raise e

    except Exception as e:
        logger.error(f"❌ Error saving session notes: {str(e)}", exc_info=True)
        await db.rollback()
        raise


async def get_session_notes(
    db: AsyncSession,
    session_id: Optional[int] = None,
    coach_appointment_session_id: Optional[int] = None,
    trainer_id: Optional[int] = None,
    coach_id: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    """
    Get session notes for a specific user (trainer or coach) for a session.
    Returns the notes entry for that specific person, or None if they haven't saved notes yet.
    This allows retrieving trainer notes and coach notes separately.
    """
    if not session_id and not coach_appointment_session_id:
        logger.error("❌ Neither session_id nor coach_appointment_session_id provided")
        return None
    
    session_type = "training" if session_id else "coach appointment"
    session_ref = session_id or coach_appointment_session_id
    user_type = "trainer" if trainer_id else "coach"
    user_ref = trainer_id or coach_id
    
    try:
        # Query for notes from specific trainer or coach
        if session_id and trainer_id:
            result = await db.execute(
                select(SessionNotes).where(
                    (SessionNotes.session_id == session_id) &
                    (SessionNotes.trainer_id == trainer_id)
                )
            )
        elif coach_appointment_session_id and coach_id:
            result = await db.execute(
                select(SessionNotes).where(
                    (SessionNotes.coach_appointment_session_id == coach_appointment_session_id) &
                    (SessionNotes.coach_id == coach_id)
                )
            )
        else:
            logger.error("❌ Invalid combination - need trainer_id for training sessions or coach_id for coach sessions")
            return None
        
        notes = result.scalar_one_or_none()
        
        if notes:
            logger.info(f"✅ Session notes retrieved for {user_type} {user_ref} in {session_type} session {session_ref} (v{notes.version})")
            return _session_notes_to_dict(notes)
        else:
            logger.info(f"ℹ️ No session notes found for {user_type} {user_ref} in {session_type} session {session_ref}")
            
    except Exception as e:
        logger.error(f"❌ Error fetching session notes: {str(e)}", exc_info=True)
    
    return None


async def force_save_session_notes(
    db: AsyncSession,
    session_id: int,
    trainer_id: int,
    notes: str
) -> Optional[Dict[str, Any]]:
    """
    Force save session notes on disconnect/reconnect.
    Bypasses normal debounce, ensures data persistence immediately.
    Used when trainer's connection is lost and recovered.
    """
    try:
        result = await db.execute(
            select(SessionNotes)
            .where(SessionNotes.session_id == session_id)
        )
        existing_notes = result.scalar_one_or_none()

        if existing_notes:
            # Only update if the new content has changed
            if existing_notes.notes != notes:
                existing_notes.notes = notes
                existing_notes.version = existing_notes.version + 1
                await db.commit()
                await db.refresh(existing_notes)
                
                logger.warning(
                    f"⚠️ Session notes force-saved for session {session_id} "
                    f"(v{existing_notes.version}) - Disconnect recovery"
                )
            else:
                logger.info(f"ℹ️ Session notes unchanged, skipping force-save for session {session_id}")
            
            return {
                "id": existing_notes.id,
                "session_id": existing_notes.session_id,
                "trainer_id": existing_notes.trainer_id,
                "notes": existing_notes.notes,
                "version": existing_notes.version,
                "is_finalized": existing_notes.is_finalized,
                "created_at": existing_notes.created_at,
                "updated_at": existing_notes.updated_at,
                "recovered": True
            }
        else:
            # Create new entry if doesn't exist
            db_notes = SessionNotes(
                session_id=session_id,
                trainer_id=trainer_id,
                notes=notes,
                version=1,
                is_finalized="false"
            )
            db.add(db_notes)
            await db.commit()
            await db.refresh(db_notes)
            
            logger.warning(
                f"⚠️ Session notes created via force-save for session {session_id} "
                f"- Disconnect recovery"
            )
            
            return {
                "id": db_notes.id,
                "session_id": db_notes.session_id,
                "trainer_id": db_notes.trainer_id,
                "notes": db_notes.notes,
                "version": db_notes.version,
                "is_finalized": db_notes.is_finalized,
                "created_at": db_notes.created_at,
                "updated_at": db_notes.updated_at,
                "recovered": True
            }

    except Exception as e:
        logger.error(f"❌ Error force-saving session notes: {str(e)}")
        await db.rollback()
        raise


async def finalize_session_notes(
    db: AsyncSession,
    session_id: int,
    notes: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Finalize session notes when session ends.
    Marks is_finalized as 'true' and updates notes if provided.
    Called after session status changes to 'ended'.
    """
    try:
        result = await db.execute(
            select(SessionNotes)
            .where(SessionNotes.session_id == session_id)
        )
        existing_notes = result.scalar_one_or_none()

        if existing_notes:
            # Update with final notes if provided
            if notes and notes.strip():
                existing_notes.notes = notes
                existing_notes.version = existing_notes.version + 1
            
            existing_notes.is_finalized = "true"
            await db.commit()
            await db.refresh(existing_notes)
            
            logger.info(
                f"✅ Session notes finalized for session {session_id} "
                f"(v{existing_notes.version}) - Session ended"
            )
            
            return {
                "id": existing_notes.id,
                "session_id": existing_notes.session_id,
                "trainer_id": existing_notes.trainer_id,
                "notes": existing_notes.notes,
                "version": existing_notes.version,
                "is_finalized": existing_notes.is_finalized,
                "created_at": existing_notes.created_at,
                "updated_at": existing_notes.updated_at,
            }
        else:
            # Create entry with finalized status if doesn't exist
            if notes and notes.strip():
                result = await db.execute(
                    select(TrainingSession).where(TrainingSession.id == session_id)
                )
                session = result.scalar_one_or_none()
                
                if session:
                    db_notes = SessionNotes(
                        session_id=session_id,
                        trainer_id=session.trainer_id,
                        notes=notes,
                        version=1,
                        is_finalized="true"
                    )
                    db.add(db_notes)
                    await db.commit()
                    await db.refresh(db_notes)
                    
                    logger.info(
                        f"✅ Session notes created and finalized for session {session_id} "
                        f"- Session ended without draft notes"
                    )
                    
                    return {
                        "id": db_notes.id,
                        "session_id": db_notes.session_id,
                        "trainer_id": db_notes.trainer_id,
                        "notes": db_notes.notes,
                        "version": db_notes.version,
                        "is_finalized": db_notes.is_finalized,
                        "created_at": db_notes.created_at,
                        "updated_at": db_notes.updated_at,
                    }
            else:
                logger.info(f"ℹ️ No notes to finalize for session {session_id}")
        
        return None

    except Exception as e:
        logger.error(f"❌ Error finalizing session notes: {str(e)}")
        await db.rollback()
        raise


async def get_session_notes_with_session_details(
    db: AsyncSession,
    session_id: int
) -> Optional[Dict[str, Any]]:
    """
    Get session notes with related session details.
    Includes session info for context.
    """
    try:
        result = await db.execute(
            select(SessionNotes, TrainingSession)
            .where(SessionNotes.session_id == session_id)
            .join(TrainingSession, SessionNotes.session_id == TrainingSession.id)
        )
        row = result.first()
        
        if row:
            notes, session = row
            return {
                "id": notes.id,
                "session_id": notes.session_id,
                "trainer_id": notes.trainer_id,
                "notes": notes.notes,
                "version": notes.version,
                "is_finalized": notes.is_finalized,
                "created_at": notes.created_at,
                "updated_at": notes.updated_at,
                "session_title": session.title,
                "session_status": session.status,
                "session_started_at": session.started_at,
                "session_ended_at": session.ended_at,
            }
    except Exception as e:
        logger.error(f"❌ Error fetching session notes with details: {str(e)}")
    
    return None

async def get_all_session_notes(
    db: AsyncSession,
    session_id: Optional[int] = None,
    coach_appointment_session_id: Optional[int] = None
) -> list[Dict[str, Any]]:
    """
    Get ALL notes for a session (from all trainers/coaches who saved notes).
    Returns a list of notes entries, one per person who saved notes.
    Useful for admin views or aggregated reports.
    """
    if not session_id and not coach_appointment_session_id:
        logger.error("❌ Neither session_id nor coach_appointment_session_id provided")
        return []
    
    session_type = "training" if session_id else "coach appointment"
    session_ref = session_id or coach_appointment_session_id
    
    try:
        if session_id:
            result = await db.execute(
                select(SessionNotes).where(SessionNotes.session_id == session_id)
                .order_by(SessionNotes.created_at)
            )
        else:
            result = await db.execute(
                select(SessionNotes).where(SessionNotes.coach_appointment_session_id == coach_appointment_session_id)
                .order_by(SessionNotes.created_at)
            )
        
        notes_list = result.scalars().all()
        
        if notes_list:
            logger.info(f"✅ Retrieved {len(notes_list)} note(s) for {session_type} session {session_ref}")
            return [_session_notes_to_dict(note) for note in notes_list]
        else:
            logger.info(f"ℹ️ No notes found for {session_type} session {session_ref}")
            return []
            
    except Exception as e:
        logger.error(f"❌ Error fetching all session notes: {str(e)}", exc_info=True)
        return []