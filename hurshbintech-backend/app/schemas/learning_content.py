from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class LearningContentCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    content_type: str = Field(..., pattern="^(image|pdf|video|audio|document)$")
    file_url: str = Field(..., max_length=500)
    file_size: Optional[int] = None
    thumbnail_url: Optional[str] = None


class LearningContentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None


class LearningContentResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    content_type: str
    file_url: str
    file_size: Optional[int]
    thumbnail_url: Optional[str]
    created_by_admin_id: int
    created_by_name: str
    updated_by_id: Optional[int]
    updated_by_name: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_users(cls, content):
        return cls(
            id=content.id,
            title=content.title,
            description=content.description,
            content_type=(
                content.content_type.value
                if hasattr(content.content_type, "value")
                else content.content_type
            ),
            file_url=content.file_url,
            file_size=content.file_size,
            thumbnail_url=content.thumbnail_url,
            created_by_admin_id=content.created_by_admin_id,
            created_by_name=content.created_by.name if content.created_by else "Unknown",
            updated_by_id=content.updated_by_id,
            updated_by_name=content.updated_by.name if content.updated_by else None,
            created_at=content.created_at,
            updated_at=content.updated_at,
        )
