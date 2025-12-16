"""
Factory for creating appropriate recording storage backend.
Single decision point based on RECORDING_STORAGE_MODE configuration.
"""

import logging

from app.core.config import settings
from pathlib import Path
from .base import RecordingStorage
from .local_storage import LocalRecordingStorage
from .s3_storage import S3RecordingStorage

logger = logging.getLogger(__name__)


def get_recording_storage() -> RecordingStorage:
    """
    Get the appropriate recording storage backend based on configuration.
    
    This is the ONLY place where storage mode branching occurs.
    All other code uses the RecordingStorage interface without conditions.
    
    Returns:
        RecordingStorage instance (LocalRecordingStorage or S3RecordingStorage)
        
    Raises:
        RuntimeError: If RECORDING_STORAGE_MODE is invalid or backend fails to initialize
        
    Environment:
        RECORDING_STORAGE_MODE: "local" or "s3"
        
    Examples:
        # In webhook handler
        storage = get_recording_storage()
        url = await storage.save(janus_file_path, session_id)
        
        # In playback endpoint
        storage = get_recording_storage()
        playback_url = await storage.get_playback_url(recording_url)
    """
    mode = settings.RECORDING_STORAGE_MODE.lower()
    
    if mode == "local":
        logger.info("Using LocalRecordingStorage backend")
        # Determine base directory: prefer settings.RECORDINGS_BASE_DIR, otherwise
        # default to backend/uploads/recordings relative to this project.
        base_dir = settings.RECORDINGS_BASE_DIR or str(
            Path(__file__).resolve().parents[3] / "uploads" / "recordings"
        )
        return LocalRecordingStorage(base_dir=base_dir)
    
    elif mode == "s3":
        logger.info("Using S3RecordingStorage backend")
        return S3RecordingStorage()
    
    else:
        raise RuntimeError(
            f"Invalid RECORDING_STORAGE_MODE: '{settings.RECORDING_STORAGE_MODE}'. "
            "Must be 'local' or 's3'. Check your environment configuration."
        )


# Optional: Singleton pattern if you want to reuse the same instance
_storage_instance: RecordingStorage | None = None


def get_recording_storage_singleton() -> RecordingStorage:
    """
    Get or create a singleton instance of the recording storage backend.
    
    Use this if you want to avoid recreating S3 clients on every request.
    For most use cases, get_recording_storage() is sufficient.
    
    Returns:
        Cached RecordingStorage instance
    """
    global _storage_instance
    
    if _storage_instance is None:
        _storage_instance = get_recording_storage()
        logger.info(f"Recording storage singleton initialized: {type(_storage_instance).__name__}")
    
    return _storage_instance
