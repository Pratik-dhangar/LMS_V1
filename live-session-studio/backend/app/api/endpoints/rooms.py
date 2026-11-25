"""
Room lifecycle endpoints: pairing, invitations, admission, end.
"""
import logging
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_trainer, require_learner
from app.db.session import get_db
from app.models.demo_profiles import DemoProfile
from app.models.rooms import Room
from app.models.memberships import RoomMembership
from app.models.materials import Material

router = APIRouter()
logger = logging.getLogger(__name__)

# In-memory trainer presence: session_id -> bool
# Set by websocket join; cleared on disconnect/end
trainer_presence: dict = {}


async def _build_room_details(room: Room, trainer: Optional[DemoProfile], learner: Optional[DemoProfile], db: Optional[AsyncSession] = None) -> dict:
    """Build the RoomDetails-compatible JSON (see spec §4)."""
    learning_contents = []
    if db:
        res = await db.execute(
            select(Material).where(Material.trainer_id == room.trainer_id).order_by(Material.created_at.desc())
        )
        materials = res.scalars().all()
        from app.utils.url_helpers import make_upload_url
        for m in materials:
            url = None
            if m.file_key:
                url = make_upload_url(m.file_key)
            elif m.external_url:
                url = m.external_url
            learning_contents.append({
                "id": m.id,
                "title": m.title,
                "content_type": m.content_type,
                "file_key": m.file_key,
                "url": url,
                "file_url": url,
                "thumbnail_url": url if m.content_type == "image" else None,
                "original_filename": m.original_filename,
                "mime_type": m.mime_type,
                "file_size": m.file_size,
                "width": m.width,
                "height": m.height,
                "is_youtube": bool(m.external_url and "youtube" in m.external_url),
                "youtube_video_id": None,
            })

    return {
        "id": room.id,
        "session_id": room.session_id,
        "title": "Live Session",
        "trainer_id": room.trainer_id,
        "learner_id": room.learner_id,
        "trainer_name": trainer.name if trainer else "Trainer",
        "learner_name": learner.name if learner else "Learner",
        "status": room.status,
        "started_at": room.started_at.isoformat() if room.started_at else None,
        "ended_at": room.ended_at.isoformat() if room.ended_at else None,
        "duration": None,
        "learning_contents": learning_contents,
        "learning_goals": [],
        "program": None,
        "mode_of_expression": [],
        "trainer_online": trainer_presence.get(room.session_id, False),
    }


async def _get_profile(db: AsyncSession, profile_id: int) -> Optional[DemoProfile]:
    r = await db.execute(select(DemoProfile).where(DemoProfile.id == profile_id))
    return r.scalar_one_or_none()


async def _get_room_by_session_id(db: AsyncSession, session_id: str) -> Optional[Room]:
    r = await db.execute(select(Room).where(Room.session_id == session_id))
    return r.scalar_one_or_none()


async def _get_membership(db: AsyncSession, room_id: int, learner_id: int) -> Optional[RoomMembership]:
    r = await db.execute(
        select(RoomMembership).where(
            and_(RoomMembership.room_id == room_id, RoomMembership.learner_id == learner_id)
        )
    )
    return r.scalar_one_or_none()


# ---- GET /learners ----
@router.get("/learners")
async def list_learners(
    user: dict = Depends(require_trainer),
    db: AsyncSession = Depends(get_db),
):
    """List all learner profiles with busy flag for the selector."""
    r = await db.execute(select(DemoProfile).where(DemoProfile.role == "learner").order_by(DemoProfile.id))
    learners = r.scalars().all()

    # Determine busy: learner has an active room
    result = []
    for learner in learners:
        busy_q = await db.execute(
            select(Room).where(
                and_(Room.learner_id == learner.id, Room.status == "active")
            )
        )
        busy = busy_q.scalar_one_or_none() is not None
        result.append({"id": learner.id, "role": learner.role, "name": learner.name, "busy": busy})
    return result


# ---- POST /rooms ----
class StartRoomRequest(BaseModel):
    learner_id: int


@router.post("/rooms", status_code=201)
async def start_room(
    body: StartRoomRequest,
    user: dict = Depends(require_trainer),
    db: AsyncSession = Depends(get_db),
):
    """Create a paired room and invitation atomically. Returns 200 if already active."""
    trainer_id = user["id"]
    learner_id = body.learner_id

    # Validate learner exists
    learner = await _get_profile(db, learner_id)
    if not learner or learner.role != "learner":
        raise HTTPException(status_code=422, detail="Invalid learner_id")
    trainer = await _get_profile(db, trainer_id)

    # Check if same trainer+learner pair already has an active room → return it (200)
    existing_q = await db.execute(
        select(Room).where(
            and_(Room.trainer_id == trainer_id, Room.learner_id == learner_id, Room.status == "active")
        )
    )
    existing = existing_q.scalar_one_or_none()
    if existing:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=200, content=await _build_room_details(existing, trainer, learner, db=db))

    # Trainer already has a different active room → 409
    trainer_active_q = await db.execute(
        select(Room).where(and_(Room.trainer_id == trainer_id, Room.status == "active"))
    )
    if trainer_active_q.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Trainer already has an active room. End it first.")

    # Learner already in a different active room → 409
    learner_active_q = await db.execute(
        select(Room).where(and_(Room.learner_id == learner_id, Room.status == "active"))
    )
    if learner_active_q.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Selected learner is already in an active session.")

    # Create room + membership atomically
    session_id = f"session_{secrets.token_hex(8)}"
    room = Room(
        session_id=session_id,
        trainer_id=trainer_id,
        learner_id=learner_id,
        status="active",
    )
    db.add(room)
    await db.flush()  # get room.id

    membership = RoomMembership(room_id=room.id, learner_id=learner_id, state="invited")
    db.add(membership)
    await db.commit()
    await db.refresh(room)

    return await _build_room_details(room, trainer, learner, db=db)


# ---- GET /rooms/current ----
@router.get("/rooms/current")
async def get_current_room(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Current user's active paired room or null."""
    uid = user["id"]
    role = user["role"]
    if role == "trainer":
        q = await db.execute(select(Room).where(and_(Room.trainer_id == uid, Room.status == "active")))
    else:
        q = await db.execute(select(Room).where(and_(Room.learner_id == uid, Room.status == "active")))
    room = q.scalar_one_or_none()
    if not room:
        return None
    trainer = await _get_profile(db, room.trainer_id)
    learner = await _get_profile(db, room.learner_id)
    return await _build_room_details(room, trainer, learner, db=db)


# ---- GET /invitations/mine ----
@router.get("/invitations/mine")
async def get_my_invitations(
    user: dict = Depends(require_learner),
    db: AsyncSession = Depends(get_db),
):
    """Active invitations for the authenticated learner only."""
    learner_id = user["id"]
    q = await db.execute(
        select(RoomMembership, Room).join(Room, RoomMembership.room_id == Room.id).where(
            and_(
                RoomMembership.learner_id == learner_id,
                Room.status == "active",
                RoomMembership.state.in_(["invited", "join_requested", "admitted", "rejected", "left"]),
            )
        )
    )
    rows = q.all()
    result = []
    for mem, room in rows:
        trainer = await _get_profile(db, room.trainer_id)
        learner = await _get_profile(db, room.learner_id)
        detail = await _build_room_details(room, trainer, learner, db=db)
        detail["membership_state"] = mem.state
        result.append(detail)
    return result


# ---- GET /rooms/{room_id} ----
@router.get("/rooms/{room_id}")
@router.get("/sessions/{room_id}")
async def get_room(
    room_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Room details - only for paired participants."""
    room = await _get_room_by_session_id(db, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    uid = user["id"]
    if uid != room.trainer_id and uid != room.learner_id:
        raise HTTPException(status_code=403, detail="Not a participant of this room")
    trainer = await _get_profile(db, room.trainer_id)
    learner = await _get_profile(db, room.learner_id)
    return await _build_room_details(room, trainer, learner, db=db)


# ---- POST /rooms/{room_id}/join ----
@router.post("/rooms/{room_id}/join")
@router.post("/sessions/{room_id}/join")
async def join_room(
    room_id: str,
    user: dict = Depends(require_learner),
    db: AsyncSession = Depends(get_db),
):
    """Selected learner requests entry. Idempotent while pending."""
    room = await _get_room_by_session_id(db, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.status != "active":
        raise HTTPException(status_code=409, detail="Room is not active")
    learner_id = user["id"]
    if room.learner_id != learner_id:
        raise HTTPException(status_code=403, detail="You are not the selected learner for this room")

    mem = await _get_membership(db, room.id, learner_id)
    if not mem:
        raise HTTPException(status_code=403, detail="No invitation found")
    if mem.state == "admitted":
        return {"state": "admitted"}
    if mem.state in ("invited", "join_requested", "rejected", "left"):
        mem.state = "join_requested"
        await db.commit()
        return {"state": "join_requested"}
    raise HTTPException(status_code=409, detail=f"Cannot join from state: {mem.state}")


# ---- POST /rooms/{room_id}/admit ----
@router.post("/rooms/{room_id}/admit")
async def admit_learner(
    room_id: str,
    user: dict = Depends(require_trainer),
    db: AsyncSession = Depends(get_db),
):
    """Trainer admits the pending learner."""
    room = await _get_room_by_session_id(db, room_id)
    if not room or room.trainer_id != user["id"]:
        raise HTTPException(status_code=403, detail="Not the room trainer")
    if room.status != "active":
        raise HTTPException(status_code=409, detail="Room ended")
    mem = await _get_membership(db, room.id, room.learner_id)
    if not mem or mem.state not in ("join_requested", "admitted"):
        raise HTTPException(status_code=409, detail="No pending join request")
    mem.state = "admitted"
    await db.commit()
    return {"state": "admitted"}


# ---- POST /rooms/{room_id}/reject ----
@router.post("/rooms/{room_id}/reject")
async def reject_learner(
    room_id: str,
    user: dict = Depends(require_trainer),
    db: AsyncSession = Depends(get_db),
):
    """Trainer rejects the pending learner."""
    room = await _get_room_by_session_id(db, room_id)
    if not room or room.trainer_id != user["id"]:
        raise HTTPException(status_code=403, detail="Not the room trainer")
    mem = await _get_membership(db, room.id, room.learner_id)
    if mem and mem.state == "join_requested":
        mem.state = "rejected"
        await db.commit()
    return {"state": "rejected"}


# ---- POST /rooms/{room_id}/remove ----
@router.post("/rooms/{room_id}/remove")
async def remove_learner(
    room_id: str,
    user: dict = Depends(require_trainer),
    db: AsyncSession = Depends(get_db),
):
    """Trainer removes an admitted learner."""
    room = await _get_room_by_session_id(db, room_id)
    if not room or room.trainer_id != user["id"]:
        raise HTTPException(status_code=403, detail="Not the room trainer")
    mem = await _get_membership(db, room.id, room.learner_id)
    if mem:
        mem.state = "rejected"
        await db.commit()
    return {"state": "rejected"}


# ---- POST /rooms/{room_id}/leave ----
@router.post("/rooms/{room_id}/leave")
@router.post("/sessions/{room_id}/leave")
async def leave_room(
    room_id: str,
    user: dict = Depends(require_learner),
    db: AsyncSession = Depends(get_db),
):
    """Learner marks themselves as left."""
    room = await _get_room_by_session_id(db, room_id)
    if not room or room.learner_id != user["id"]:
        raise HTTPException(status_code=403, detail="Not the selected learner")
    mem = await _get_membership(db, room.id, user["id"])
    if mem and mem.state not in ("closed",):
        mem.state = "left"
        await db.commit()
    return {"state": "left"}


# ---- POST /rooms/{room_id}/end ----
@router.post("/rooms/{room_id}/end")
@router.post("/sessions/{room_id}/end")
async def end_room(
    room_id: str,
    user: dict = Depends(require_trainer),
    db: AsyncSession = Depends(get_db),
):
    """Trainer ends the room. Idempotent."""
    room = await _get_room_by_session_id(db, room_id)
    if not room or room.trainer_id != user["id"]:
        raise HTTPException(status_code=403, detail="Not the room trainer")
    if room.status == "ended":
        return {"status": "ended"}
    room.status = "ended"
    room.ended_at = datetime.now(timezone.utc)
    # Close membership
    mem = await _get_membership(db, room.id, room.learner_id)
    if mem:
        mem.state = "closed"
    await db.commit()
    # Clear presence
    trainer_presence.pop(room_id, None)
    return {"status": "ended"}
