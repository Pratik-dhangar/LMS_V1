"""
URL helper utilities for the standalone Live Session Studio.
"""
from app.core.config import settings


def make_upload_url(file_key: str) -> str:
    """Build a backend-served URL for an uploaded file."""
    if not file_key:
        return ""
    # Remove leading slash if present
    key = file_key.lstrip("/")
    # API base is configured in frontend as VITE_API_BASE_URL=http://localhost:8002/api
    # Backend endpoint is /api/uploads/{file_key}
    return f"/api/uploads/{key}"
