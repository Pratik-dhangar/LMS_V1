"""
Session notes endpoints.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_trainer
from app.db.session import get_db
from app.models.rooms import Room
from app.models.session_notes_model import SessionNote

router = APIRouter()
logger = logging.getLogger(__name__)


async def _get_room_checked(db, session_id: str, trainer_id: int) -> Room:
    r = await db.execute(select(Room).where(Room.session_id == session_id))
    room = r.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.trainer_id != trainer_id:
        raise HTTPException(status_code=403, detail="Not the room trainer")
    return room


@router.get("/rooms/{room_id}/notes")
async def get_notes(
    room_id: str,
    user: dict = Depends(require_trainer),
    db: AsyncSession = Depends(get_db),
):
    room = await _get_room_checked(db, room_id, user["id"])
    r = await db.execute(
        select(SessionNote).where(
            and_(SessionNote.room_id == room.id, SessionNote.trainer_id == user["id"])
        )
    )
    note = r.scalar_one_or_none()
    return {"content": note.content if note else "", "room_id": room_id}


class SaveNotesRequest(BaseModel):
    content: Optional[str] = None
    notes: Optional[str] = None

    def get_text(self) -> str:
        if self.notes is not None:
            return self.notes
        if self.content is not None:
            return self.content
        return ""


@router.get("/rooms/{room_id}/notes")
@router.get("/session-notes/{room_id}")
async def get_notes(
    room_id: str,
    user: dict = Depends(require_trainer),
    db: AsyncSession = Depends(get_db),
):
    room = await _get_room_checked(db, room_id, user["id"])
    r = await db.execute(
        select(SessionNote).where(
            and_(SessionNote.room_id == room.id, SessionNote.trainer_id == user["id"])
        )
    )
    note = r.scalar_one_or_none()
    text = note.content if note else ""
    return {"content": text, "notes": text, "room_id": room_id}


@router.post("/rooms/{room_id}/notes")
@router.post("/session-notes/{room_id}")
@router.post("/session-notes/{room_id}/force-save")
@router.post("/session-notes/{room_id}/finalize")
@router.put("/session-notes/{room_id}")
async def save_notes(
    room_id: str,
    body: SaveNotesRequest,
    user: dict = Depends(require_trainer),
    db: AsyncSession = Depends(get_db),
):
    room = await _get_room_checked(db, room_id, user["id"])
    r = await db.execute(
        select(SessionNote).where(
            and_(SessionNote.room_id == room.id, SessionNote.trainer_id == user["id"])
        )
    )
    note = r.scalar_one_or_none()
    text = body.get_text()
    if note:
        note.content = text
    else:
        note = SessionNote(room_id=room.id, trainer_id=user["id"], content=text)
        db.add(note)
    await db.commit()
    return {"status": "saved", "notes": text, "content": text}


@router.delete("/rooms/{room_id}/notes")
async def clear_notes(
    room_id: str,
    user: dict = Depends(require_trainer),
    db: AsyncSession = Depends(get_db),
):
    room = await _get_room_checked(db, room_id, user["id"])
    r = await db.execute(
        select(SessionNote).where(
            and_(SessionNote.room_id == room.id, SessionNote.trainer_id == user["id"])
        )
    )
    note = r.scalar_one_or_none()
    if note:
        note.content = ""
        await db.commit()
    return {"status": "cleared"}
