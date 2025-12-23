"""
S3 storage implementation for recordings.
Uploads recordings to AWS S3 with automatic cleanup of local temp files.
"""

import os
from pathlib import Path
from typing import Optional
from uuid import uuid4
import logging

from app.core.config import settings
from app.utils.s3_utils import S3Manager
from .base import RecordingStorage

logger = logging.getLogger(__name__)


class S3RecordingStorage(RecordingStorage):
    """
    AWS S3 storage backend for session recordings.
    
    Recordings are organized in S3 with the following structure:
    s3://bucket-name/
        └── uploads/
            └── session_recordings/
                ├── 123/
                │   ├── abc123.webm
                │   └── def456.webm
                └── 124/
                    └── ghi789.webm
    
    Each recording gets a unique UUID filename to avoid collisions.
    """

    def __init__(self):
        """
        Initialize S3 storage backend using app configuration.
        
        Raises:
            RuntimeError: If S3 credentials are not configured
        """
        if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
            raise RuntimeError(
                "S3 storage mode requires AWS credentials. "
                "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in environment."
            )
        
        self.s3_manager = S3Manager(
            bucket_name=settings.S3_BUCKET_NAME,
            region=settings.AWS_REGION
        )
        logger.info(
            f"S3RecordingStorage initialized for bucket: {settings.S3_BUCKET_NAME}"
        )

    async def save(self, local_path: str, session_id: int) -> str:
        """
        Upload recording to S3 and clean up local temp file.
        
        Args:
            local_path: Absolute path to recording in Janus temp directory
            session_id: Session database ID
            
        Returns:
            S3 object key (e.g., "uploads/session_recordings/123/abc123.webm")
            
        Raises:
            FileNotFoundError: If source file doesn't exist
            IOError: If upload fails
        """
        source = Path(local_path)
        
        if not source.exists():
            raise FileNotFoundError(f"Recording file not found: {local_path}")
        
        # Generate unique S3 key with session ID prefix
        file_extension = source.suffix
        unique_filename = f"{uuid4()}{file_extension}"
        
        try:
            # Read file content
            with open(source, 'rb') as f:
                file_content = f.read()
            
            # Determine content type
            content_type = "video/webm" if file_extension == ".webm" else "application/octet-stream"
            
            # Upload to S3 using existing S3Manager (folder will be prepended with 'uploads/')
            s3_key = self.s3_manager.upload_file(
                file_content=file_content,
                folder=f"session_recordings/{session_id}",
                filename=unique_filename,
                content_type=content_type
            )
            
            logger.info(f"Recording uploaded to S3: {s3_key}")
            
            # Clean up local temp file after successful upload
            try:
                source.unlink()
                logger.info(f"Temp file cleaned up: {local_path}")
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup temp file: {cleanup_error}")
            
            return s3_key
            
        except Exception as e:
            logger.error(f"Failed to upload recording to S3: {e}")
            raise IOError(f"S3 upload failed for {local_path}: {e}")

    async def delete(self, storage_path: str) -> None:
        """
        Delete a recording from S3.
        
        Args:
            storage_path: S3 object key (e.g., "uploads/session_recordings/123/abc123.webm")
            
        Raises:
            IOError: If deletion fails
        """
        try:
            success = self.s3_manager.delete_file(storage_path)
            
            if success:
                logger.info(f"Recording deleted from S3: {storage_path}")
            else:
                logger.warning(f"S3 deletion returned False: {storage_path}")
                
        except Exception as e:
            logger.error(f"Failed to delete recording from S3: {e}")
            raise IOError(f"S3 deletion failed for {storage_path}: {e}")

    async def get_playback_url(self, storage_path: str, expires_in: int = 3600) -> str:
        """
        Generate presigned URL for S3 recording playback.
        
        Args:
            storage_path: S3 object key (e.g., "uploads/session_recordings/123/abc123.webm")
            expires_in: URL expiration time in seconds (default: 1 hour)
            
        Returns:
            Presigned S3 URL valid for specified duration
            
        Raises:
            ValueError: If storage_path is invalid
        """
        try:
            presigned_url = self.s3_manager.generate_signed_url(
                s3_key=storage_path,
                expiration_seconds=expires_in
            )
            
            if not presigned_url:
                raise ValueError(f"Failed to generate presigned URL for {storage_path}")
            
            logger.debug(f"Presigned URL generated for: {storage_path}")
            return presigned_url
            
        except Exception as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            raise ValueError(f"Presigned URL generation failed for {storage_path}: {e}")

    async def get_file_size(self, storage_path: str) -> Optional[int]:
        """
        Get recording file size from S3 metadata.
        
        Args:
            storage_path: S3 object key
            
        Returns:
            File size in bytes, or None if unavailable
        """
        try:
            response = self.s3_manager.s3_client.head_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=storage_path
            )
            return response.get('ContentLength')
        except Exception as e:
            logger.warning(f"Failed to get S3 file size: {e}")
            return None
