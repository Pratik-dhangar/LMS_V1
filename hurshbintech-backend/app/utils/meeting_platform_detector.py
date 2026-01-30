"""
Meeting Platform Detection Utility
Detects the meeting platform from meeting URLs
"""

from typing import Optional
from urllib.parse import urlparse


class MeetingPlatform:
    """Meeting platform constants"""
    ZOOM = "zoom"
    GOOGLE_MEET = "google_meet"
    MICROSOFT_TEAMS = "microsoft_teams"
    WEBEX = "webex"
    SKYPE = "skype"
    GOTOMEETING = "gotomeeting"
    JITSI = "jitsi"
    WHEREBY = "whereby"
    BLUEJEANS = "bluejeans"
    OTHER = "other"


def detect_meeting_platform(meeting_link: str) -> str:
    """
    Detect the meeting platform from a meeting link URL
    
    Args:
        meeting_link: The meeting URL
        
    Returns:
        Platform name as string (e.g., 'zoom', 'google_meet', 'microsoft_teams')
    """
    if not meeting_link:
        return MeetingPlatform.OTHER
    
    try:
        parsed = urlparse(meeting_link.lower())
        domain = parsed.netloc
        
        # Zoom patterns
        if any(pattern in domain for pattern in ['zoom.us', 'zoom.com']):
            return MeetingPlatform.ZOOM
        
        # Google Meet patterns
        if any(pattern in domain for pattern in ['meet.google.com', 'meet.google']):
            return MeetingPlatform.GOOGLE_MEET
        
        # Microsoft Teams patterns
        if any(pattern in domain for pattern in ['teams.microsoft.com', 'teams.live.com']):
            return MeetingPlatform.MICROSOFT_TEAMS
        
        # Webex patterns
        if any(pattern in domain for pattern in ['webex.com', 'ciscospark.com']):
            return MeetingPlatform.WEBEX
        
        # Skype patterns
        if any(pattern in domain for pattern in ['skype.com', 'lync.com']):
            return MeetingPlatform.SKYPE
        
        # GoToMeeting patterns
        if any(pattern in domain for pattern in ['gotomeeting.com', 'gotomeet.me']):
            return MeetingPlatform.GOTOMEETING
        
        # Jitsi patterns
        if any(pattern in domain for pattern in ['meet.jit.si', 'jitsi']):
            return MeetingPlatform.JITSI
        
        # Whereby patterns
        if 'whereby.com' in domain:
            return MeetingPlatform.WHEREBY
        
        # BlueJeans patterns
        if 'bluejeans.com' in domain:
            return MeetingPlatform.BLUEJEANS
        
        return MeetingPlatform.OTHER
        
    except Exception:
        return MeetingPlatform.OTHER


def get_platform_display_name(platform: str) -> str:
    """
    Get a user-friendly display name for the platform
    
    Args:
        platform: Platform identifier
        
    Returns:
        Display name for the platform
    """
    display_names = {
        MeetingPlatform.ZOOM: "Zoom",
        MeetingPlatform.GOOGLE_MEET: "Google Meet",
        MeetingPlatform.MICROSOFT_TEAMS: "Microsoft Teams",
        MeetingPlatform.WEBEX: "Webex",
        MeetingPlatform.SKYPE: "Skype",
        MeetingPlatform.GOTOMEETING: "GoToMeeting",
        MeetingPlatform.JITSI: "Jitsi Meet",
        MeetingPlatform.WHEREBY: "Whereby",
        MeetingPlatform.BLUEJEANS: "BlueJeans",
        MeetingPlatform.OTHER: "External Platform"
    }
    return display_names.get(platform, "External Platform")


def get_platform_color(platform: str) -> str:
    """
    Get a color code for the platform badge
    
    Args:
        platform: Platform identifier
        
    Returns:
        Color code (hex or CSS color name)
    """
    colors = {
        MeetingPlatform.ZOOM: "#2D8CFF",
        MeetingPlatform.GOOGLE_MEET: "#00897B",
        MeetingPlatform.MICROSOFT_TEAMS: "#6264A7",
        MeetingPlatform.WEBEX: "#00BCF2",
        MeetingPlatform.SKYPE: "#00AFF0",
        MeetingPlatform.GOTOMEETING: "#F68D2E",
        MeetingPlatform.JITSI: "#1D76BA",
        MeetingPlatform.WHEREBY: "#5D5FEF",
        MeetingPlatform.BLUEJEANS: "#0E78D5",
        MeetingPlatform.OTHER: "#6B7280"
    }
    return colors.get(platform, "#6B7280")
