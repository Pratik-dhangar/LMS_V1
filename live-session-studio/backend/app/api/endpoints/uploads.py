"""
File serving endpoint: /api/uploads/{file_key:path}
Validates token and room/material access. Returns range-supporting response.
"""
import hashlib
import hmac
import logging
import os
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.materials import Material
from app.models.rooms import Room

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_BASE = Path(settings.UPLOADS_DIR)


def _resolve_path(file_key: str) -> Optional[Path]:
    """Safely resolve file_key to an absolute path under UPLOADS_DIR."""
    try:
        full = (UPLOAD_BASE / file_key).resolve()
        base = UPLOAD_BASE.resolve()
        if str(full).startswith(str(base)):
            return full if full.exists() else None
    except Exception:
        pass
    return None


@router.get("/uploads/{file_key:path}")
async def serve_upload(
    file_key: str,
    request: Request,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Serve an uploaded file. Validates participant access."""
    # Check material access - trainer owns it or learner is in active room with trainer
    uid = user["id"]
    role = user["role"]

    # Find material by file_key
    mat_q = await db.execute(select(Material).where(Material.file_key == file_key))
    material = mat_q.scalar_one_or_none()

    if material:
        if role == "trainer" and material.trainer_id == uid:
            pass  # trainer owns it
        elif role == "learner":
            # Learner must be in an active/admitted room with this trainer
            room_q = await db.execute(
                select(Room).where(
                    Room.learner_id == uid,
                    Room.trainer_id == material.trainer_id,
                    Room.status == "active",
                )
            )
            if not room_q.scalar_one_or_none():
                raise HTTPException(status_code=403, detail="No active room access to this material")
        else:
            raise HTTPException(status_code=403, detail="Access denied")
    elif file_key.startswith("recordings/") or file_key.startswith("chat/"):
        # Allow participant access
        pass
    else:
        raise HTTPException(status_code=404, detail="File not found")

    path = _resolve_path(file_key)
    if not path:
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=str(path),
        filename=path.name,
        media_type=_guess_mime(path),
    )


def _guess_mime(path: Path) -> str:
    import mimetypes
    mime, _ = mimetypes.guess_type(str(path))
    return mime or "application/octet-stream"
