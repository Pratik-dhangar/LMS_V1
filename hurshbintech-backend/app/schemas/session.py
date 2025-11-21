"""
Training Session Schemas - Pydantic models for validation
"""
from pydantic import BaseModel, Field, field_serializer
from typing import Optional, List
from datetime import datetime


class SessionCreate(BaseModel):
    """Schema for creating a new session (by Head)"""
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    trainer_id: int
    learner_id: int
    scheduled_date: datetime
    duration: int = Field(default=60, ge=15, le=240)  # Duration in minutes (15-240)
    content_ids: List[int] = Field(default_factory=list)  # IDs of learning content to attach
    goal_ids: List[int] = Field(default_factory=list)  # IDs of learning goals to attach


class SessionUpdate(BaseModel):
    """Schema for updating session"""
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    duration: Optional[int] = Field(None, ge=15, le=240)


class SessionEnd(BaseModel):
    """Schema for ending a session"""
    notes: Optional[str] = None


class LearningContentInSession(BaseModel):
    """Learning content attached to session"""
    id: int
    title: str
    content_type: str
    file_url: str
    thumbnail_url: Optional[str]
    
    class Config:
        from_attributes = True


class LearningGoalInSession(BaseModel):
    """Learning goal attached to session"""
    id: int
    goal: str
    goal_description: Optional[str]
    
    class Config:
        from_attributes = True



class SessionResponse(BaseModel):
    """Schema for session response"""
    id: int
    session_id: str
    title: str
    description: Optional[str]
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
    duration: int = 60  # Default to 60 minutes for old sessions
    learning_contents: List[LearningContentInSession] = []
    learning_goals: List['LearningGoalInSession'] = []
    created_at: datetime
    updated_at: datetime
    
    @field_serializer('scheduled_date', 'started_at', 'ended_at', 'created_at', 'updated_at')
    def serialize_datetime(self, dt: Optional[datetime], _info):
        """Serialize datetime without timezone to preserve local time"""
        if dt is None:
            return None
        # Return datetime string without 'Z' suffix so frontend treats it as local time
        return dt.strftime('%Y-%m-%dT%H:%M:%S')
    
    class Config:
        from_attributes = True
