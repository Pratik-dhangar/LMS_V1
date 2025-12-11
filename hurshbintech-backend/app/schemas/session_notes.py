"""
Session Notes Schemas - Pydantic models for validation
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SessionNotesCreate(BaseModel):
    """Schema for creating session notes"""

    notes: Optional[str] = None


class SessionNotesUpdate(BaseModel):
    """Schema for updating session notes"""

    notes: Optional[str] = None


class SessionNotesResponse(BaseModel):
    """Schema for session notes response"""

    id: int
    session_id: int
    trainer_id: int
    notes: Optional[str]
    version: int
    is_finalized: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
