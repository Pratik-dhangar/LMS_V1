"""
Webinar Schemas
Pydantic schemas for webinar API requests and responses
"""

from datetime import date, time, datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, field_validator


# ============ PARTICIPANT SCHEMAS ============

class ParticipantBase(BaseModel):
    """Base participant information"""
    user_id: Optional[int] = None
    unregistered_email: Optional[EmailStr] = None


class ParticipantResponse(BaseModel):
    """Participant response with user details"""
    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    unregistered_email: Optional[EmailStr] = None
    invitation_sent: bool = False
    invitation_sent_at: Optional[datetime] = None
    invited_at: datetime

    class Config:
        from_attributes = True


# ============ WEBINAR SCHEMAS ============

class WebinarCreate(BaseModel):
    """Schema for creating a new webinar"""
    title: str
    description: Optional[str] = None
    meeting_link: str
    scheduled_date: date
    scheduled_time: time
    participant_user_ids: Optional[List[int]] = []  # Registered users
    unregistered_emails: Optional[List[EmailStr]] = []  # Unregistered participants

    @field_validator('title')
    @classmethod
    def validate_title(cls, v):
        if not v or len(v.strip()) < 3:
            raise ValueError('Title must be at least 3 characters long')
        return v.strip()

    @field_validator('meeting_link')
    @classmethod
    def validate_meeting_link(cls, v):
        if not v or len(v.strip()) < 10:
            raise ValueError('Meeting link is required')
        # Basic URL validation
        if not any(v.startswith(prefix) for prefix in ['http://', 'https://']):
            raise ValueError('Meeting link must be a valid URL starting with http:// or https://')
        return v.strip()


class WebinarUpdate(BaseModel):
    """Schema for updating a webinar"""
    title: Optional[str] = None
    description: Optional[str] = None
    meeting_link: Optional[str] = None
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[time] = None

    @field_validator('title')
    @classmethod
    def validate_title(cls, v):
        if v is not None and len(v.strip()) < 3:
            raise ValueError('Title must be at least 3 characters long')
        return v.strip() if v else None

    @field_validator('meeting_link')
    @classmethod
    def validate_meeting_link(cls, v):
        if v is not None:
            if len(v.strip()) < 10:
                raise ValueError('Meeting link is required')
            if not any(v.startswith(prefix) for prefix in ['http://', 'https://']):
                raise ValueError('Meeting link must be a valid URL starting with http:// or https://')
        return v.strip() if v else None


class WebinarResponse(BaseModel):
    """Schema for webinar response"""
    id: int
    title: str
    description: Optional[str] = None
    meeting_link: str
    platform: Optional[str] = None  # Auto-detected platform (zoom, google_meet, etc.)
    platform_display_name: Optional[str] = None  # User-friendly name
    scheduled_date: date
    scheduled_time: time
    created_by_user_id: Optional[int] = None
    created_by_name: Optional[str] = None
    created_by_role: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    participants: List[ParticipantResponse] = []
    participant_count: int = 0

    class Config:
        from_attributes = True


class WebinarListResponse(BaseModel):
    """Simplified webinar response for list views"""
    id: int
    title: str
    description: Optional[str] = None
    meeting_link: str
    platform: Optional[str] = None  # Auto-detected platform (zoom, google_meet, etc.)
    platform_display_name: Optional[str] = None  # User-friendly name
    scheduled_date: date
    scheduled_time: time
    created_by_user_id: Optional[int] = None
    created_by_name: Optional[str] = None
    created_by_role: Optional[str] = None
    created_at: datetime
    participant_count: int = 0

    class Config:
        from_attributes = True


class AddParticipantsRequest(BaseModel):
    """Schema for adding participants to existing webinar"""
    participant_user_ids: Optional[List[int]] = []
    unregistered_emails: Optional[List[EmailStr]] = []
