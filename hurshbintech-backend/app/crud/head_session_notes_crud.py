"""
Head Session Notes CRUD Operations - Using independent head_session_notes table
Supports save with version tracking and recovery; mirrors session_notes behavior
"""

import logging
from typing import Optional, Dict, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.head_session_notes_model import HeadSessionNotes
from app.models.session_model import TrainingSession

logger = logging.getLogger(__name__)


async def create_or_update_head_session_notes(
    db: AsyncSession,
    session_id: int,
    head_id: int,
    notes: str,
    is_finalized: str = "false"
) -> Optional[Dict[str, Any]]:
    try:
        result = await db.execute(
            select(HeadSessionNotes).where(HeadSessionNotes.session_id == session_id)
        )
        existing_notes = result.scalar_one_or_none()

        if existing_notes:
            existing_notes.notes = notes
            existing_notes.version = existing_notes.version + 1
            existing_notes.is_finalized = is_finalized
            await db.commit()
            await db.refresh(existing_notes)

            logger.info(
                f"✅ Head session notes updated for session {session_id} (v{existing_notes.version})"
            )

            return {
                "id": existing_notes.id,
                "session_id": existing_notes.session_id,
                "head_id": existing_notes.head_id,
                "notes": existing_notes.notes,
                "version": existing_notes.version,
                "is_finalized": existing_notes.is_finalized,
                "created_at": existing_notes.created_at,
                "updated_at": existing_notes.updated_at,
            }
        else:
            db_notes = HeadSessionNotes(
                session_id=session_id,
                head_id=head_id,
                notes=notes,
                version=1,
                is_finalized=is_finalized
            )
            db.add(db_notes)
            await db.commit()
            await db.refresh(db_notes)

            logger.info(
                f"✅ Head session notes created for session {session_id} (v1)"
            )

            return {
                "id": db_notes.id,
                "session_id": db_notes.session_id,
                "head_id": db_notes.head_id,
                "notes": db_notes.notes,
                "version": db_notes.version,
                "is_finalized": db_notes.is_finalized,
                "created_at": db_notes.created_at,
                "updated_at": db_notes.updated_at,
            }

    except Exception as e:
        logger.error(f"❌ Error saving head session notes: {str(e)}")
        await db.rollback()
        raise


async def get_head_session_notes(
    db: AsyncSession,
    session_id: int
) -> Optional[Dict[str, Any]]:
    try:
        result = await db.execute(
            select(HeadSessionNotes).where(HeadSessionNotes.session_id == session_id)
        )
        notes = result.scalar_one_or_none()

        if notes:
            logger.info(f"✅ Head session notes retrieved for session {session_id} (v{notes.version})")
            return {
                "id": notes.id,
                "session_id": notes.session_id,
                "head_id": notes.head_id,
                "notes": notes.notes,
                "version": notes.version,
                "is_finalized": notes.is_finalized,
                "created_at": notes.created_at,
                "updated_at": notes.updated_at,
            }
    except Exception as e:
        logger.error(f"❌ Error fetching head session notes: {str(e)}")

    return None


async def force_save_head_session_notes(
    db: AsyncSession,
    session_id: int,
    head_id: int,
    notes: str
) -> Optional[Dict[str, Any]]:
    try:
        result = await db.execute(
            select(HeadSessionNotes).where(HeadSessionNotes.session_id == session_id)
        )
        existing_notes = result.scalar_one_or_none()

        if existing_notes:
            if existing_notes.notes != notes:
                existing_notes.notes = notes
                existing_notes.version = existing_notes.version + 1
                await db.commit()
                await db.refresh(existing_notes)

                logger.warning(
                    f"⚠️ Head session notes force-saved for session {session_id} (v{existing_notes.version})"
                )
            else:
                logger.info(f"ℹ️ Head session notes unchanged, skipping force-save for session {session_id}")

            return {
                "id": existing_notes.id,
                "session_id": existing_notes.session_id,
                "head_id": existing_notes.head_id,
                "notes": existing_notes.notes,
                "version": existing_notes.version,
                "is_finalized": existing_notes.is_finalized,
                "created_at": existing_notes.created_at,
                "updated_at": existing_notes.updated_at,
                "recovered": True
            }
        else:
            db_notes = HeadSessionNotes(
                session_id=session_id,
                head_id=head_id,
                notes=notes,
                version=1,
                is_finalized="false"
            )
            db.add(db_notes)
            await db.commit()
            await db.refresh(db_notes)

            logger.warning(
                f"⚠️ Head session notes created via force-save for session {session_id} - Recovery"
            )

            return {
                "id": db_notes.id,
                "session_id": db_notes.session_id,
                "head_id": db_notes.head_id,
                "notes": db_notes.notes,
                "version": db_notes.version,
                "is_finalized": db_notes.is_finalized,
                "created_at": db_notes.created_at,
                "updated_at": db_notes.updated_at,
                "recovered": True
            }

    except Exception as e:
        logger.error(f"❌ Error force-saving head session notes: {str(e)}")
        await db.rollback()
        raise


async def finalize_head_session_notes(
    db: AsyncSession,
    session_id: int,
    notes: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    try:
        result = await db.execute(
            select(HeadSessionNotes).where(HeadSessionNotes.session_id == session_id)
        )
        existing_notes = result.scalar_one_or_none()

        if existing_notes:
            if notes and notes.strip():
                existing_notes.notes = notes
                existing_notes.version = existing_notes.version + 1

            existing_notes.is_finalized = "true"
            await db.commit()
            await db.refresh(existing_notes)

            logger.info(
                f"✅ Head session notes finalized for session {session_id} (v{existing_notes.version})"
            )

            return {
                "id": existing_notes.id,
                "session_id": existing_notes.session_id,
                "head_id": existing_notes.head_id,
                "notes": existing_notes.notes,
                "version": existing_notes.version,
                "is_finalized": existing_notes.is_finalized,
                "created_at": existing_notes.created_at,
                "updated_at": existing_notes.updated_at,
            }
        else:
            if notes and notes.strip():
                result = await db.execute(
                    select(TrainingSession).where(TrainingSession.id == session_id)
                )
                session = result.scalar_one_or_none()

                if session:
                    db_notes = HeadSessionNotes(
                        session_id=session_id,
                        head_id=session.trainer_id if hasattr(session, 'trainer_id') else None,
                        notes=notes,
                        version=1,
                        is_finalized="true"
                    )
                    db.add(db_notes)
                    await db.commit()
                    await db.refresh(db_notes)

                    logger.info(
                        f"✅ Head session notes created and finalized for session {session_id}"
                    )

                    return {
                        "id": db_notes.id,
                        "session_id": db_notes.session_id,
                        "head_id": db_notes.head_id,
                        "notes": db_notes.notes,
                        "version": db_notes.version,
                        "is_finalized": db_notes.is_finalized,
                        "created_at": db_notes.created_at,
                        "updated_at": db_notes.updated_at,
                    }
            else:
                logger.info(f"ℹ️ No head notes to finalize for session {session_id}")

        return None

    except Exception as e:
        logger.error(f"❌ Error finalizing head session notes: {str(e)}")
        await db.rollback()
        raise


async def get_head_session_notes_with_session_details(
    db: AsyncSession,
    session_id: int
) -> Optional[Dict[str, Any]]:
    try:
        result = await db.execute(
            select(HeadSessionNotes, TrainingSession)
            .where(HeadSessionNotes.session_id == session_id)
            .join(TrainingSession, HeadSessionNotes.session_id == TrainingSession.id)
        )
        row = result.first()

        if row:
            notes, session = row
            return {
                "id": notes.id,
                "session_id": notes.session_id,
                "head_id": notes.head_id,
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
        logger.error(f"❌ Error fetching head session notes with details: {str(e)}")

    return None
