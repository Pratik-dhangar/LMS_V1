from datetime import datetime

from pydantic import BaseModel, Field


class LearningSkillCreate(BaseModel):
    skill_name: str = Field(..., min_length=2, max_length=255)


class LearningSkillResponse(BaseModel):
    id: int
    skill_name: str
    created_by_admin_id: int
    created_by_name: str
    created_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_user(cls, skill):
        return cls(
            id=skill.id,
            skill_name=skill.skill_name,
            created_by_admin_id=skill.created_by_admin_id,
            created_by_name=skill.created_by.name if skill.created_by else "Unknown",
            created_at=skill.created_at,
        )
