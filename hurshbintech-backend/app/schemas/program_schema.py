"""
Program Schemas - Pydantic models for Program validation

Rules enforced at the schema level:
  - ProgramCreate includes goal_ids (set once at creation)
  - ProgramUpdateContent does NOT include goal_ids (goals are immutable)
  - skills array stores multi-skill mapping with sub-programs
"""

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class SkillWithGoals(BaseModel):
    """A skill with its associated learning goals (sub-programs)"""
    skill_id: int = Field(..., description="Learning skill ID")
    skill_name: str = Field(..., description="Skill name")
    goal_ids: List[int] = Field(default_factory=list, description="Learning goal IDs for this skill")


class ProgramCreate(BaseModel):
    """Create a new program. goal_ids are locked after creation."""
    name: str = Field(..., min_length=1, max_length=255, description="Program name e.g. 'Program-A'")
    skill: Optional[str] = None
    description: Optional[str] = None  # Deprecated alias for backward compatibility
    learner_id: int = Field(..., description="Learner this program is for")
    goal_ids: List[int] = Field(default_factory=list, description="Learning goal IDs — locked after creation")
    content_ids: List[int] = Field(default_factory=list, description="Learning content IDs — mutable")
    skills: List[SkillWithGoals] = Field(default_factory=list, description="Multi-skill structure with sub-programs")


class ProgramUpdateContent(BaseModel):
    """
    Update a program.
    Supports updating learner, skill structure, goal_ids, and content_ids.
    """
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    learner_id: Optional[int] = None
    skill: Optional[str] = None
    description: Optional[str] = None  # Deprecated alias for backward compatibility
    goal_ids: Optional[List[int]] = None
    skills: Optional[List[SkillWithGoals]] = None
    content_ids: Optional[List[int]] = None


class ProgramInSession(BaseModel):
    """Slim program info embedded inside SessionResponse"""
    id: int
    name: str
    skill: Optional[str] = None
    description: Optional[str] = None  # Deprecated alias for backward compatibility
    goal_ids: List[int] = []
    content_ids: List[int] = []
    skills: List[Dict] = []

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
    skills: List[Dict] = []
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
    skills: List[Dict] = []
    is_active: bool = True
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
