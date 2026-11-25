"""
Room-scoped direct messaging endpoints.
"""
import logging
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select, and_, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.rooms import Room
from app.models.memberships import RoomMembership
from app.models.chat_model import RoomMessage
from app.models.demo_profiles import DemoProfile

router = APIRouter()
logger = logging.getLogger(__name__)


async def _check_room_participant(db: AsyncSession, session_id: str, uid: int) -> Room:
    r = await db.execute(select(Room).where(Room.session_id == session_id))
    room = r.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if uid != room.trainer_id and uid != room.learner_id:
        raise HTTPException(status_code=403, detail="Not a participant")
    return room


@router.get("/rooms/{room_id}/messages")
async def list_messages(
    room_id: str,
    before_id: Optional[int] = None,
    limit: int = 50,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await _check_room_participant(db, room_id, user["id"])
    stmt = select(RoomMessage).where(RoomMessage.room_id == room.id).order_by(RoomMessage.created_at.desc())
    if before_id:
        stmt = stmt.where(RoomMessage.id < before_id)
    stmt = stmt.limit(limit)
    r = await db.execute(stmt)
    msgs = r.scalars().all()

    # Gather sender names
    sender_ids = list({m.sender_id for m in msgs})
    name_map = {}
    if sender_ids:
        pr = await db.execute(select(DemoProfile).where(DemoProfile.id.in_(sender_ids)))
        for p in pr.scalars().all():
            name_map[p.id] = p.name

    return [_serialize_msg(m, name_map) for m in reversed(msgs)]


class SendMessageRequest(BaseModel):
    content: str
    message_type: str = "text"


@router.post("/rooms/{room_id}/messages")
async def send_message(
    room_id: str,
    body: SendMessageRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await _check_room_participant(db, room_id, user["id"])
    msg = RoomMessage(
        room_id=room.id,
        sender_id=user["id"],
        message_type=body.message_type,
        content=body.content,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return _serialize_msg(msg, {user["id"]: user["name"]})


@router.post("/rooms/{room_id}/messages/file")
async def send_file_message(
    room_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await _check_room_participant(db, room_id, user["id"])
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="File too large (max 20MB)")

    chat_dir = Path(settings.UPLOADS_DIR) / "chat"
    chat_dir.mkdir(parents=True, exist_ok=True)
    key = f"chat/{uuid.uuid4().hex}_{file.filename}"
    (Path(settings.UPLOADS_DIR) / key.lstrip("chat/")).write_bytes(content)
    # Actually save as uploads/chat/...
    (chat_dir / Path(key).name).write_bytes(content)
    file_key = f"chat/{Path(key).name}"

    msg = RoomMessage(
        room_id=room.id,
        sender_id=user["id"],
        message_type="file",
        file_key=file_key,
        file_name=file.filename,
        file_size=len(content),
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return _serialize_msg(msg, {user["id"]: user["name"]})


@router.post("/rooms/{room_id}/messages/{msg_id}/read")
async def mark_read(
    room_id: str,
    msg_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await _check_room_participant(db, room_id, user["id"])
    await db.execute(
        update(RoomMessage).where(
            and_(RoomMessage.id == msg_id, RoomMessage.room_id == room.id)
        ).values(is_read=True)
    )
    await db.commit()
    return {"status": "read"}


def _serialize_msg(msg: RoomMessage, name_map: dict) -> dict:
    from app.utils.url_helpers import make_upload_url
    file_url = make_upload_url(msg.file_key) if msg.file_key else None
    return {
        "id": msg.id,
        "room_id": msg.room_id,
        "sender_id": msg.sender_id,
        "sender_name": name_map.get(msg.sender_id, "Unknown"),
        "message_type": msg.message_type,
        "content": msg.content,
        "file_key": msg.file_key,
        "file_name": msg.file_name,
        "file_size": msg.file_size,
        "file_url": file_url,
        "is_read": msg.is_read,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }
