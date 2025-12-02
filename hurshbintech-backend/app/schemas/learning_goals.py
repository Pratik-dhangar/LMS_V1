from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class LearningGoalsCreate(BaseModel):
    goal: str = Field(..., min_length=3, max_length=255)
    goal_description: Optional[str] = None


class LearningGoalsUpdate(BaseModel):
    goal: Optional[str] = Field(None, min_length=3, max_length=255)
    goal_description: Optional[str] = None


class LearningGoalsResponse(BaseModel):
    id: int
    goal: str
    goal_description: Optional[str]
    created_by_admin_id: int
    created_by_name: str
    updated_by_id: Optional[int]
    updated_by_name: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_users(cls, goal):
        return cls(
            id=goal.id,
            goal=goal.goal,
            goal_description=goal.goal_description,
            created_by_admin_id=goal.created_by_admin_id,
            created_by_name=goal.created_by.name if goal.created_by else "Unknown",
            updated_by_id=goal.updated_by_id,
            updated_by_name=goal.updated_by.name if goal.updated_by else None,
            created_at=goal.created_at,
            updated_at=goal.updated_at,
        )
