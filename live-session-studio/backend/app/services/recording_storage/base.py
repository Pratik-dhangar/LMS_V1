"""
Base interface for recording storage backends.
All storage implementations must inherit from this class.
"""

from abc import ABC, abstractmethod
from typing import Optional


class RecordingStorage(ABC):
    """
    Abstract base class for recording storage backends.
    
    This interface ensures consistent behavior across different storage
    implementations (local filesystem, S3, etc.) without runtime branching.
    """

    @abstractmethod
    async def save(self, local_path: str, session_id: int) -> str:
        """
        Save a recording from local temporary path to persistent storage.
        
        Args:
            local_path: Absolute path to the recording file on local disk
            session_id: Database ID of the session this recording belongs to
            
        Returns:
            Storage path/key that can be used to retrieve the recording later.
            - For local storage: absolute filesystem path
            - For S3 storage: S3 object key
            
        Raises:
            IOError: If file cannot be read or saved
            ValueError: If local_path doesn't exist
        """
        raise NotImplementedError

    @abstractmethod
    async def delete(self, storage_path: str) -> None:
        """
        Delete a recording from persistent storage.
        
        Args:
            storage_path: The path/key returned by save()
            
        Raises:
            IOError: If deletion fails
        """
        raise NotImplementedError

    @abstractmethod
    async def get_playback_url(self, storage_path: str, expires_in: int = 3600) -> str:
        """
        Generate a playback URL for a stored recording.
        
        Args:
            storage_path: The path/key returned by save()
            expires_in: URL expiration time in seconds (for presigned URLs)
            
        Returns:
            URL that can be used to stream/download the recording.
            - For local storage: API endpoint path
            - For S3 storage: presigned URL or CloudFront URL
            
        Raises:
            ValueError: If storage_path is invalid
        """
        raise NotImplementedError

    async def get_file_size(self, storage_path: str) -> Optional[int]:
        """
        Get the size of a stored recording in bytes.
        
        Optional method that can be implemented for storage analytics.
        
        Args:
            storage_path: The path/key returned by save()
            
        Returns:
            File size in bytes, or None if unavailable
        """
        return None
