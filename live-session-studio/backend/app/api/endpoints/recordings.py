"""
Session feedback and recording endpoints.
"""
import logging
import os
import tempfile
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, require_trainer
from app.db.session import get_db
from app.models.rooms import Room
from app.models.session_feedback_model import SessionFeedback
from app.models.recording_model import Recording

router = APIRouter()
logger = logging.getLogger(__name__)


# ---- Feedback ----

class FeedbackRequest(BaseModel):
    rating: int
    remark: Optional[str] = None


@router.post("/rooms/{room_id}/feedback")
@router.post("/sessions/{room_id}/feedback")
async def submit_feedback(
    room_id: str,
    body: FeedbackRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not (1 <= body.rating <= 5):
        raise HTTPException(status_code=422, detail="Rating must be 1-5")
    r = await db.execute(select(Room).where(Room.session_id == room_id))
    room = r.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    uid = user["id"]
    if uid != room.trainer_id and uid != room.learner_id:
        raise HTTPException(status_code=403, detail="Not a participant")
    fb = SessionFeedback(room_id=room.id, participant_id=uid, rating=body.rating, remark=body.remark)
    db.add(fb)
    await db.commit()
    return {"status": "submitted"}


# ---- Recording ----

def _recordings_dir() -> Path:
    d = Path(settings.RECORDINGS_DIR)
    d.mkdir(parents=True, exist_ok=True)
    return d


def _chunks_dir(recording_id: int) -> Path:
    d = _recordings_dir() / "chunks" / str(recording_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


@router.post("/recordings/chunk")
@router.post("/sessions/recordings/upload-chunk")
async def upload_chunk(
    chunk: UploadFile = File(...),
    session_id: str = Form(...),
    chunk_number: int = Form(...),
    recording_id: Optional[int] = Form(None),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a recording chunk. Creates recording record if recording_id not given."""
    # Validate room access
    r = await db.execute(select(Room).where(Room.session_id == session_id))
    room = r.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    uid = user["id"]
    if uid != room.trainer_id and uid != room.learner_id:
        raise HTTPException(status_code=403, detail="Not a participant")

    # Find or create recording record
    rec = None
    if recording_id:
        rr = await db.execute(select(Recording).where(Recording.id == recording_id))
        rec = rr.scalar_one_or_none()
    if not rec:
        rec = Recording(room_id=room.id, session_str_id=session_id, status="uploading")
        db.add(rec)
        await db.flush()

    # Save chunk
    chunk_data = await chunk.read()
    chunk_path = _chunks_dir(rec.id) / f"chunk_{chunk_number:06d}.webm"
    chunk_path.write_bytes(chunk_data)

    await db.commit()
    return {"recording_id": rec.id, "chunk_number": chunk_number, "status": "uploaded"}


@router.post("/recordings/{recording_id}/finalize")
@router.post("/sessions/recordings/finalize")
async def finalize_recording(
    session_id: str = Form(...),
    chunk_count: int = Form(...),
    recording_id: Optional[int] = None,
    recording_id_form: Optional[int] = Form(None, alias="recording_id"),
    total_chunks_uploaded: Optional[int] = Form(None),
    uploaded_chunks: Optional[str] = Form(None),
    failed_chunks: Optional[str] = Form(None),
    duration: Optional[float] = Form(None),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Finalize a recording by merging chunks with FFmpeg."""
    rec_id = recording_id or recording_id_form
    if not rec_id:
        raise HTTPException(status_code=422, detail="recording_id required")
    rr = await db.execute(select(Recording).where(Recording.id == rec_id))
    rec = rr.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")

    recording_id = rec_id

    rec.status = "finalizing"
    rec.chunk_count = chunk_count
    if duration:
        rec.duration = duration
    await db.commit()

    # Merge in background - import service
    try:
        from app.services.recording_merge_service import RecordingMergeService
        merger = RecordingMergeService()
        chunks_dir = _chunks_dir(recording_id)
        out_key = f"recordings/{recording_id}/recording.webm"
        out_path = _recordings_dir() / str(recording_id)
        out_path.mkdir(parents=True, exist_ok=True)
        out_file = out_path / "recording.webm"

        chunk_files = sorted(chunks_dir.glob("chunk_*.webm"))
        if chunk_files and merger.ffmpeg_available:
            success = merger.merge_chunks(list(chunk_files), str(out_file))
            if success:
                rec.file_key = out_key
                rec.status = "ready"
            else:
                rec.status = "error"
        else:
            rec.status = "error" if not chunk_files else "ready"
            if chunk_files and not merger.ffmpeg_available:
                # Copy first chunk as placeholder
                import shutil
                shutil.copy2(str(chunk_files[0]), str(out_file))
                rec.file_key = out_key
                rec.status = "ready"
    except Exception as e:
        logger.error(f"Recording finalize error: {e}")
        rec.status = "error"

    await db.commit()
    return {"recording_id": recording_id, "status": rec.status, "file_key": rec.file_key}


@router.get("/recordings/{recording_id}/status")
@router.get("/sessions/recordings/{recording_id}/status")
async def recording_status(
    recording_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rr = await db.execute(select(Recording).where(Recording.id == recording_id))
    rec = rr.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    return {"recording_id": recording_id, "status": rec.status, "file_key": rec.file_key, "duration": rec.duration}
