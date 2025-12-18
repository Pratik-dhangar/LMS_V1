"""
Head Session Notes Schemas - Pydantic models for validation
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class HeadSessionNotesCreate(BaseModel):
    """Schema for creating head session notes"""

    notes: Optional[str] = None


class HeadSessionNotesUpdate(BaseModel):
    """Schema for updating head session notes"""

    notes: Optional[str] = None


class HeadSessionNotesResponse(BaseModel):
    """Schema for head session notes response"""

    id: int
    session_id: int
    head_id: int
    notes: Optional[str]
    version: int
    is_finalized: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
