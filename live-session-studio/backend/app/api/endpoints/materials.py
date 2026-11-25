"""
Material upload and library endpoints.
Trainer-authorized upload. Files served via /api/uploads/{file_key:path}.
"""
import logging
import mimetypes
import os
import secrets
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, require_trainer
from app.db.session import get_db
from app.models.materials import Material

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "video/mp4", "video/webm", "video/ogg",
    "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm",
    "application/pdf",
}
MAX_SIZE_BYTES = 100 * 1024 * 1024  # 100 MB


def _get_materials_dir() -> Path:
    d = Path(settings.UPLOADS_DIR) / "materials"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _content_type_from_mime(mime: str) -> str:
    if mime.startswith("image"):
        return "image"
    if mime.startswith("video"):
        return "video"
    if mime.startswith("audio"):
        return "audio"
    if mime == "application/pdf":
        return "pdf"
    return "file"


@router.get("/materials")
async def list_materials(
    user: dict = Depends(require_trainer),
    db: AsyncSession = Depends(get_db),
):
    """List trainer's material library."""
    r = await db.execute(
        select(Material).where(Material.trainer_id == user["id"]).order_by(Material.created_at.desc())
    )
    items = r.scalars().all()
    base = settings.UPLOADS_DIR
    result = []
    for item in items:
        result.append(_serialize_material(item))
    return result


@router.post("/materials", status_code=201)
async def upload_material(
    title: str = Form(...),
    file: Optional[UploadFile] = File(None),
    external_url: Optional[str] = Form(None),
    user: dict = Depends(require_trainer),
    db: AsyncSession = Depends(get_db),
):
    """Upload a material file or register a YouTube link."""
    if not file and not external_url:
        raise HTTPException(status_code=422, detail="Provide file or external_url")

    mat = Material(trainer_id=user["id"], title=title)

    if external_url:
        mat.content_type = "youtube"
        mat.external_url = external_url
    else:
        # Read and validate file
        content = await file.read()
        if len(content) > MAX_SIZE_BYTES:
            raise HTTPException(status_code=422, detail="File exceeds 100 MB limit")

        mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or "application/octet-stream"
        if mime not in ALLOWED_TYPES:
            raise HTTPException(status_code=422, detail=f"Unsupported file type: {mime}")

        ext = Path(file.filename).suffix if file.filename else ""
        key = f"{uuid.uuid4().hex}{ext}"
        dest = _get_materials_dir() / key
        dest.write_bytes(content)

        mat.content_type = _content_type_from_mime(mime)
        mat.file_key = f"materials/{key}"
        mat.original_filename = file.filename
        mat.mime_type = mime
        mat.file_size = len(content)

    db.add(mat)
    await db.commit()
    await db.refresh(mat)
    return _serialize_material(mat)


def _serialize_material(item: Material) -> dict:
    from app.utils.url_helpers import make_upload_url
    url = None
    if item.file_key:
        url = make_upload_url(item.file_key)
    elif item.external_url:
        url = item.external_url
    return {
        "id": item.id,
        "title": item.title,
        "content_type": item.content_type,
        "file_key": item.file_key,
        "url": url,
        "file_url": url,
        "thumbnail_url": url if item.content_type == "image" else None,
        "original_filename": item.original_filename,
        "mime_type": item.mime_type,
        "file_size": item.file_size,
        "width": item.width,
        "height": item.height,
        "external_url": item.external_url,
        "is_youtube": bool(item.external_url and "youtube" in item.external_url),
        "youtube_url": item.external_url if (item.external_url and "youtube" in item.external_url) else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }
