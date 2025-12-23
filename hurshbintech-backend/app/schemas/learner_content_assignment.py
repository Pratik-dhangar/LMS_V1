"""Pydantic schemas for Learner Content Assignment"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class LearnerContentAssignmentCreate(BaseModel):
    """Schema for creating a learner content assignment"""
    learner_id: int
    content_id: int


class LearnerContentAssignmentResponse(BaseModel):
    """Schema for learner content assignment response"""
    id: int
    learner_id: int
    content_id: int
    assigned_by_head: Optional[int]
    program_assignment_id: Optional[int]
    assigned_at: datetime

    class Config:
        from_attributes = True
