"""
Recording storage abstraction layer.
Provides unified interface for local and S3 storage backends.
"""

from .base import RecordingStorage
from .factory import get_recording_storage

__all__ = ["RecordingStorage", "get_recording_storage"]
