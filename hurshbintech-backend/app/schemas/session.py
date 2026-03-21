"""
Training Session Schemas - Pydantic models for validation
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_serializer

from app.schemas.program_schema import ProgramInSession


class SessionCreate(BaseModel):
    """Schema for creating a new session (by Head)"""

    title: str = Field(..., min_length=3, max_length=255)
    trainer_id: int
    learner_id: int
    scheduled_date: datetime
    # Duration is required and must be between 15 and 240 minutes
    duration: int = Field(..., ge=15, le=240)
    content_ids: List[int] = Field(default_factory=list)  # IDs of learning content to attach
    goal_ids: List[int] = Field(default_factory=list)  # IDs of learning goals to attach
    program_id: Optional[int] = None  # Optional program to link (goals/content auto-derived if provided)


class SessionUpdate(BaseModel):
    """Schema for updating session"""

    title: Optional[str] = Field(None, min_length=3, max_length=255)
    scheduled_date: Optional[datetime] = None
    duration: Optional[int] = Field(None, ge=15, le=240)
    content_ids: Optional[List[int]] = None  # IDs of learning content to attach
    goal_ids: Optional[List[int]] = None  # IDs of learning goals to attach
    program_id: Optional[int] = None  # Optional program to link or update


class SessionEnd(BaseModel):
    """Schema for ending a session"""

    notes: Optional[str] = None


class LearningContentInSession(BaseModel):
    """Learning content attached to session"""

    id: int
    title: str
    content_type: str
    file_url: Optional[str]  # Optional for YouTube content which doesn't use file_url
    thumbnail_url: Optional[str]
    # YouTube-specific fields
    youtube_url: Optional[str] = None
    youtube_video_id: Optional[str] = None
    is_youtube: bool = False

    class Config:
        from_attributes = True


class LearningGoalInSession(BaseModel):
    """Learning goal attached to session"""

    id: int
    goal: str
    goal_description: Optional[str]
    # Include prompt and reinforcement values from session reports
    prompt_meter: Optional[str] = None
    reinforcement_meter: Optional[str] = None

    class Config:
        from_attributes = True


class SessionResponse(BaseModel):
    """Schema for session response"""

    id: int
    session_id: str
    title: str
    trainer_id: int
    learner_id: int
    created_by_id: int
    status: str
    scheduled_date: datetime
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    trainer_name: str
    learner_name: str
    created_by_name: str
    # Duration (minutes) — required in response; do not silently default to 60
    duration: int
    # New tracking fields
    total_duration: Optional[int] = None  # Actual session duration in minutes
    session_start_time: Optional[datetime] = None  # When trainer started the session
    # Subscription tracking
    subscription_id: Optional[int] = None  # Linked learner subscription for session count tracking
    session_counted: bool = False  # Has this ended session been counted towards subscription usage?
    # Session notes from session_reports table
    session_notes: Optional[str] = None  # Notes stored in session_reports table
    # Recording fields
    recording_url: Optional[str] = None  # Playback URL for session recording
    recording_status: Optional[str] = None  # Status: pending, processing, completed, failed
    recording_uploaded_at: Optional[datetime] = None  # When recording was stored
    # Program link
    program: Optional[ProgramInSession] = None
    learning_contents: List[LearningContentInSession] = []
    learning_goals: List["LearningGoalInSession"] = []
    created_at: datetime
    updated_at: datetime

    @field_serializer("scheduled_date", "started_at", "ended_at", "created_at", "updated_at", "session_start_time", "recording_uploaded_at")
    def serialize_datetime(self, dt: Optional[datetime], _info):
        """Serialize datetime without timezone to preserve local time"""
        if dt is None:
            return None
        # Return datetime string without 'Z' suffix so frontend treats it as local time
        return dt.strftime("%Y-%m-%dT%H:%M:%S")

    class Config:
        from_attributes = True


class SessionFeedbackCreate(BaseModel):
    """Schema for submitting session feedback"""

    rating: int = Field(..., ge=1, le=5, description="Star rating from 1 to 5")
    remark: Optional[str] = Field(None, max_length=1000, description="Optional text feedback")
    attendee_role: str = Field(default="learner", description="Role: learner, guest, client")
    attendee_name: Optional[str] = Field(None, max_length=255)


class SessionFeedbackResponse(BaseModel):
    """Schema for session feedback response"""

    id: int
    session_id: int
    attendee_role: str
    attendee_name: Optional[str] = None
    rating: int
    remark: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
