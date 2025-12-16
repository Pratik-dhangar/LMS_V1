"""
Local filesystem storage implementation for recordings.
Stores recordings in /var/recordings/{session_id}/ directory structure.
"""

import os
import shutil
from pathlib import Path
from typing import Optional
import logging

from .base import RecordingStorage

logger = logging.getLogger(__name__)


class LocalRecordingStorage(RecordingStorage):
    """
    Local filesystem storage backend for session recordings.
    
    Recordings are organized by session ID:
    /var/recordings/
        ├── 123/
        │   ├── recording_2025-12-15_14-30-00.webm
        │   └── recording_2025-12-15_15-45-00.webm
        └── 124/
            └── recording_2025-12-15_16-00-00.webm
    """

    def __init__(self, base_dir: str = "/var/recordings"):
        """
        Initialize local storage backend.
        
        Args:
            base_dir: Root directory for storing recordings
        """
        self.base_dir = Path(base_dir)
        
        # Ensure base directory exists
        self.base_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"LocalRecordingStorage initialized with base_dir: {self.base_dir}")

    async def save(self, local_path: str, session_id: int) -> str:
        """
        Move recording from temporary location to permanent storage.
        
        Args:
            local_path: Absolute path to recording in Janus temp directory
            session_id: Session database ID
            
        Returns:
            Absolute path to saved recording file
            
        Raises:
            FileNotFoundError: If source file doesn't exist
            IOError: If move operation fails
        """
        source = Path(local_path)
        
        if not source.exists():
            raise FileNotFoundError(f"Recording file not found: {local_path}")
        
        # Create session-specific directory
        session_dir = self.base_dir / str(session_id)
        session_dir.mkdir(parents=True, exist_ok=True)
        
        # Preserve original filename
        target = session_dir / source.name
        
        # Handle duplicate filenames by appending counter
        counter = 1
        while target.exists():
            stem = source.stem
            suffix = source.suffix
            target = session_dir / f"{stem}_{counter}{suffix}"
            counter += 1
        
        try:
            # Move file (faster than copy + delete)
            shutil.move(str(source), str(target))
            logger.info(f"Recording saved: {target}")
            return str(target)
        except Exception as e:
            logger.error(f"Failed to save recording: {e}")
            raise IOError(f"Failed to move recording to {target}: {e}")

    async def delete(self, storage_path: str) -> None:
        """
        Delete a recording from local filesystem.
        
        Args:
            storage_path: Absolute path to recording file
            
        Raises:
            IOError: If deletion fails
        """
        path = Path(storage_path)
        
        try:
            if path.exists():
                path.unlink()
                logger.info(f"Recording deleted: {storage_path}")
                
                # Clean up empty session directory
                session_dir = path.parent
                if session_dir.exists() and not any(session_dir.iterdir()):
                    session_dir.rmdir()
                    logger.info(f"Empty session directory removed: {session_dir}")
            else:
                logger.warning(f"Recording not found for deletion: {storage_path}")
        except Exception as e:
            logger.error(f"Failed to delete recording: {e}")
            raise IOError(f"Failed to delete recording {storage_path}: {e}")

    async def get_playback_url(self, storage_path: str, expires_in: int = 3600) -> str:
        """
        Generate API endpoint URL for local recording playback.
        
        Args:
            storage_path: Absolute filesystem path to recording
            expires_in: Ignored for local storage (no expiration)
            
        Returns:
            Relative URL path for API endpoint
        """
        # Convert absolute path to relative path from base_dir
        path = Path(storage_path)
        
        try:
            relative_path = path.relative_to(self.base_dir)
        except ValueError:
            # If path is not under base_dir, use filename only
            logger.warning(f"Recording path outside base_dir: {storage_path}")
            relative_path = path.name
        
        # Return API endpoint path that will be handled by local playback route
        # Note: router is mounted at /api/sessions, so full path is /api/sessions/recordings/local/...
        return f"/api/sessions/recordings/local/{relative_path}"

    async def get_file_size(self, storage_path: str) -> Optional[int]:
        """
        Get recording file size in bytes.
        
        Args:
            storage_path: Absolute filesystem path to recording
            
        Returns:
            File size in bytes, or None if file doesn't exist
        """
        path = Path(storage_path)
        
        if path.exists() and path.is_file():
            return path.stat().st_size
        
        return None
