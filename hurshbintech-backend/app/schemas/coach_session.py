"""
Coach Appointment Session Schemas - Pydantic models for validation
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CoachSessionCreate(BaseModel):
    """
    Schema for creating a coach session from an appointment
    This is typically called automatically when coach confirms an appointment
    """
    appointment_id: int
    title: Optional[str] = None  # Auto-generated if not provided
    description: Optional[str] = None
    duration: int = Field(default=60, ge=15, le=240)  # 15-240 minutes


class CoachSessionUpdate(BaseModel):
    """Schema for updating coach session (limited fields)"""
    scheduled_date: Optional[datetime] = None
    duration: Optional[int] = Field(None, ge=15, le=240)
    notes: Optional[str] = None


class CoachSessionEnd(BaseModel):
    """Schema for ending a coach session"""
    notes: Optional[str] = None


class CoachSessionResponse(BaseModel):
    """Schema for coach session response"""
    id: int
    session_id: str
    appointment_id: int
    coach_id: int
    client_user_id: Optional[int]  # NULL for guest sessions
    client_name: str
    client_email: str
    title: str
    description: Optional[str]
    scheduled_date: datetime
    duration: int
    session_type: Optional[str]
    status: str  # scheduled, active, ended, cancelled
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    notes: Optional[str]
    
    # Recording fields
    recording_url: Optional[str]
    recording_status: Optional[str]
    recording_uploaded_at: Optional[datetime]
    
    # Additional coach info
    coach_name: Optional[str] = None  # Populated from relationship
    coach_email: Optional[str] = None
    
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CoachSessionListItem(BaseModel):
    """Simplified schema for session list view"""
    id: int
    session_id: str
    appointment_id: int
    client_name: str
    title: str
    scheduled_date: datetime
    duration: int
    status: str
    session_type: Optional[str]
    recording_status: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
