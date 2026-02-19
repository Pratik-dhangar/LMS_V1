"""
Generic media proxy endpoint.

Handles all three deployment environments transparently:

  - Local dev  (USE_S3=False):
      Serves files from the local  `uploads/`  directory on disk.
      S3 keys map directly to paths under that directory
      (e.g. key "uploads/profile_pictures/x.jpg" → <backend>/uploads/…).

  - AWS S3 on EC2  (USE_S3=True, no S3_ENDPOINT_URL):
      Streams objects from AWS S3 using server-side credentials.

  - Neev Cloud  (USE_S3=True, S3_ENDPOINT_URL set):
      Streams objects from the Neev Cloud S3-compatible endpoint.
      S3Manager picks up S3_ENDPOINT_URL automatically from the environment.

A single URL pattern  /api/media/s3/{key}  works across all environments.
The browser always sees a same-origin response — no CORS, no presigned URLs.
"""

import logging
import mimetypes
from pathlib import Path

from botocore.exceptions import ClientError
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse, StreamingResponse

from app.core.config import settings
from app.utils.s3_utils import S3Manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/media", tags=["Media"])

# ---------------------------------------------------------------------------
# S3 manager — only initialised when USE_S3 is enabled.
# S3Manager reads S3_ENDPOINT_URL from the environment automatically, so the
# same code works for both AWS (no endpoint) and Neev Cloud (custom endpoint).
# ---------------------------------------------------------------------------
_s3_manager: S3Manager | None = None

if settings.USE_S3:
    try:
        _s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
        logger.info("S3 manager initialised for media proxy")
    except Exception as exc:
        logger.error(f"Failed to initialise S3 manager for media proxy: {exc}")

# Root of the local uploads directory (used only when USE_S3=False).
# Path(__file__) = …/hurshbintech-backend/app/api/endpoints/media.py
# parents[3]     = …/hurshbintech-backend/
_UPLOADS_ROOT = Path(__file__).resolve().parents[3] / "uploads"


@router.get("/s3/{file_key:path}", summary="Serve any media file (S3 or local)")
async def proxy_s3_file(file_key: str):
    """
    Serve a media file to the browser.

    Works across all three environments without any code changes:
    - Local dev   → reads from the `uploads/` folder on disk
    - AWS S3      → streams object from AWS S3
    - Neev Cloud  → streams object from Neev Cloud S3-compatible storage
    """
    # --- basic key validation ---
    if not file_key or ".." in file_key or file_key.startswith("/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file key",
        )

    # -----------------------------------------------------------------------
    # LOCAL DEVELOPMENT  (USE_S3=False)
    # Files are stored in  <backend>/uploads/…  and the key is the path
    # relative to the backend root, e.g. "uploads/profile_pictures/x.jpg".
    # -----------------------------------------------------------------------
    if not settings.USE_S3:
        # The key may already start with "uploads/" or just be a bare sub-path.
        if file_key.startswith("uploads/"):
            local_path = _UPLOADS_ROOT.parent / file_key  # resolves to <backend>/uploads/…
        else:
            local_path = _UPLOADS_ROOT / file_key

        # Prevent path traversal outside uploads root
        try:
            local_path = local_path.resolve()
            local_path.relative_to(_UPLOADS_ROOT.resolve())
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file key")

        if not local_path.exists() or not local_path.is_file():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

        content_type, _ = mimetypes.guess_type(str(local_path))
        logger.debug(f"Serving local file: {local_path}")
        return FileResponse(
            path=str(local_path),
            media_type=content_type or "application/octet-stream",
            headers={
                "Cache-Control": "public, max-age=3600",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            },
        )

    # -----------------------------------------------------------------------
    # S3  (AWS or Neev Cloud — determined entirely by env vars)
    # -----------------------------------------------------------------------
    if not _s3_manager:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="S3 storage is enabled but the S3 client failed to initialise",
        )

    try:
        s3_response = _s3_manager.s3_client.get_object(
            Bucket=_s3_manager.bucket_name,
            Key=file_key,
        )
        content_type = s3_response.get("ContentType", "application/octet-stream")
        content_length = s3_response.get("ContentLength", 0)

        logger.debug(f"Proxying S3 file: {file_key} ({content_type}, {content_length} bytes)")

        return StreamingResponse(
            s3_response["Body"],
            media_type=content_type,
            headers={
                "Content-Length": str(content_length),
                "Cache-Control": "public, max-age=86400",  # 24 h browser cache
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            },
        )

    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code in ("NoSuchKey", "404", "NotFound"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
        logger.error(f"S3 error for {file_key}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to serve file",
        )
    except Exception as exc:
        logger.error(f"Error proxying S3 file {file_key}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to serve file",
        )
