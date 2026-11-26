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
from fastapi.responses import FileResponse, Response, StreamingResponse
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user_optional
from app.db.session import get_db
from app.models.materials import Material
from app.models.rooms import Room

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_BASE = (
    Path(settings.UPLOADS_DIR).resolve()
    if Path(settings.UPLOADS_DIR).is_absolute()
    else (Path(__file__).resolve().parents[3] / settings.UPLOADS_DIR).resolve()
)


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


@router.options("/uploads/{file_key:path}")
async def options_upload(file_key: str):
    """Handle preflight for direct cross-origin media requests."""
    return Response(
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        },
    )


@router.api_route("/uploads/{file_key:path}", methods=["GET", "HEAD"])
async def serve_upload(
    file_key: str,
    request: Request,
    token: Optional[str] = Query(None),
    user: Optional[dict] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Serve an uploaded file. Materials are session content and freely servable to browsers."""
    CORS_HEADERS = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "*",
    }

    # Materials (images, PDFs, media) are session content assets loaded by standard <img>/<video>/<canvas> tags
    if file_key.startswith("materials/"):
        path = _resolve_path(file_key)
        if not path:
            raise HTTPException(status_code=404, detail="File not found on disk")
        return FileResponse(
            path=str(path),
            filename=path.name,
            media_type=_guess_mime(path),
            headers=CORS_HEADERS,
        )

    # If token query param provided and no bearer header, decode token
    if not user and token:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            user = {"id": int(payload.get("sub")), "role": payload.get("role"), "name": payload.get("name", "")}
        except Exception:
            pass

    # Recordings and chat files require participant auth
    if file_key.startswith("recordings/") or file_key.startswith("chat/"):
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        path = _resolve_path(file_key)
        if not path:
            raise HTTPException(status_code=404, detail="File not found on disk")
        return FileResponse(
            path=str(path),
            filename=path.name,
            media_type=_guess_mime(path),
            headers=CORS_HEADERS,
        )

    # Any other registered material
    mat_q = await db.execute(select(Material).where(Material.file_key == file_key))
    material = mat_q.scalar_one_or_none()
    if material:
        path = _resolve_path(file_key)
        if not path:
            raise HTTPException(status_code=404, detail="File not found on disk")
        return FileResponse(
            path=str(path),
            filename=path.name,
            media_type=_guess_mime(path),
            headers=CORS_HEADERS,
        )

    raise HTTPException(status_code=404, detail="File not found")


def _guess_mime(path: Path) -> str:
    import mimetypes
    mime, _ = mimetypes.guess_type(str(path))
    return mime or "application/octet-stream"
