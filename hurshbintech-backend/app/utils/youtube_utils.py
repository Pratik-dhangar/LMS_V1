"""
YouTube URL parsing and metadata extraction utilities
"""
import re
from typing import Optional, Tuple


class YouTubeUtils:
    """Utility functions for YouTube URL handling and metadata extraction"""
    
    @staticmethod
    def extract_video_id(url: str) -> Optional[str]:
        """
        Extract YouTube video ID from various URL formats.
        
        Supports:
        - youtu.be/XXX
        - youtube.com/watch?v=XXX
        - youtube.com/embed/XXX
        - youtube.com/v/XXX
        
        Args:
            url: YouTube URL in any standard format
            
        Returns:
            11-character video ID or None if invalid
        """
        if not url:
            return None
            
        # Pattern 1: youtu.be/videoId
        match = re.search(r'(?:https?://)?(?:www\.)?youtu\.be/([a-zA-Z0-9_-]{11})', url)
        if match:
            return match.group(1)
        
        # Pattern 2: youtube.com/watch?v=videoId
        match = re.search(r'(?:https?://)?(?:www\.)?youtube\.com/watch\?.*v=([a-zA-Z0-9_-]{11})', url)
        if match:
            return match.group(1)
        
        # Pattern 3: youtube.com/embed/videoId
        match = re.search(r'(?:https?://)?(?:www\.)?youtube\.com/embed/([a-zA-Z0-9_-]{11})', url)
        if match:
            return match.group(1)
        
        # Pattern 4: youtube.com/v/videoId
        match = re.search(r'(?:https?://)?(?:www\.)?youtube\.com/v/([a-zA-Z0-9_-]{11})', url)
        if match:
            return match.group(1)
        
        return None
    
    @staticmethod
    def get_thumbnail_url(video_id: str, quality: str = 'hqdefault') -> str:
        """
        Get YouTube thumbnail URL for a video ID.
        
        Quality options (in order of availability):
        - 'maxres': 1280x720 (highest, may not exist)
        - 'sddefault': 640x480
        - 'hqdefault': 480x360 (most reliable)
        - 'mqdefault': 320x180
        - 'default': 120x90 (smallest)
        
        Args:
            video_id: 11-character YouTube video ID
            quality: Thumbnail quality preference
            
        Returns:
            Full URL to thumbnail image
        """
        if not video_id or len(video_id) != 11:
            return f"https://img.youtube.com/vi/undefined/hqdefault.jpg"
        
        base_url = f"https://img.youtube.com/vi/{video_id}"
        
        # Try maxres first, but hqdefault is most reliable
        if quality == 'maxres':
            return f"{base_url}/maxresdefault.jpg"
        elif quality == 'sddefault':
            return f"{base_url}/sddefault.jpg"
        elif quality == 'mqdefault':
            return f"{base_url}/mqdefault.jpg"
        elif quality == 'default':
            return f"{base_url}/default.jpg"
        else:
            # Default to hqdefault (most consistent)
            return f"{base_url}/hqdefault.jpg"
    
    @staticmethod
    def get_embed_url(video_id: str, autoplay: bool = False, controls: bool = True) -> str:
        """
        Generate YouTube embed URL for iframe.
        
        Args:
            video_id: 11-character YouTube video ID
            autoplay: Auto-start playback (bool)
            controls: Show player controls (bool)
            
        Returns:
            Full iframe src URL
        """
        params = f"?autoplay={'1' if autoplay else '0'}&controls={'1' if controls else '0'}&rel=0&modestbranding=1"
        return f"https://www.youtube.com/embed/{video_id}{params}"
    
    @staticmethod
    def validate_and_extract(url: str) -> Optional[Tuple[str, str, str]]:
        """
        Validate YouTube URL and extract all necessary metadata.
        
        Args:
            url: YouTube URL to validate
            
        Returns:
            Tuple of (video_id, thumbnail_url, embed_url) if valid
            None if invalid
        """
        video_id = YouTubeUtils.extract_video_id(url)
        
        if not video_id:
            return None
        
        return (
            video_id,
            YouTubeUtils.get_thumbnail_url(video_id),
            YouTubeUtils.get_embed_url(video_id)
        )
