"""
Program Schemas - Pydantic models for Program validation

Rules enforced at the schema level:
  - ProgramCreate includes goal_ids (set once at creation)
  - ProgramUpdateContent does NOT include goal_ids (goals are immutable)
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ProgramCreate(BaseModel):
    """Create a new program. goal_ids are locked after creation."""
    name: str = Field(..., min_length=1, max_length=255, description="Program name e.g. 'Program-A'")
    skill: Optional[str] = None
    description: Optional[str] = None  # Deprecated alias for backward compatibility
    learner_id: int = Field(..., description="Learner this program is for")
    goal_ids: List[int] = Field(default_factory=list, description="Learning goal IDs — locked after creation")
    content_ids: List[int] = Field(default_factory=list, description="Learning content IDs — mutable")


class ProgramUpdateContent(BaseModel):
    """
    Update a program. Intentionally excludes goal_ids to enforce the lock.
    Only name, description, and content_ids can be changed.
    """
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    skill: Optional[str] = None
    description: Optional[str] = None  # Deprecated alias for backward compatibility
    content_ids: Optional[List[int]] = None


class ProgramInSession(BaseModel):
    """Slim program info embedded inside SessionResponse"""
    id: int
    name: str
    skill: Optional[str] = None
    description: Optional[str] = None  # Deprecated alias for backward compatibility
    goal_ids: List[int] = []
    content_ids: List[int] = []

    class Config:
        from_attributes = True


class ProgramListItem(BaseModel):
    """Program item for dropdown lists in scheduling UI"""
    id: int
    name: str
    skill: Optional[str] = None
    description: Optional[str] = None  # Deprecated alias for backward compatibility
    learner_id: Optional[int] = None
    goal_ids: List[int] = []
    content_ids: List[int] = []
    is_active: bool = True

    class Config:
        from_attributes = True


class ProgramResponse(BaseModel):
    """Full program detail response"""
    id: int
    name: str
    skill: Optional[str] = None
    description: Optional[str] = None  # Deprecated alias for backward compatibility
    head_id: Optional[int] = None
    learner_id: Optional[int] = None
    goal_ids: List[int] = []
    content_ids: List[int] = []
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
