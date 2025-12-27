from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class VlogBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    file_url: str
    file_size: float
    thumbnail_url: Optional[str] = None
    status: Optional[str] = Field(default="draft")  # "draft" or "published"


class VlogCreate(VlogBase):
    pass


class VlogUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    file_url: Optional[str] = None
    file_size: Optional[float] = None
    thumbnail_url: Optional[str] = None
    status: Optional[str] = None


class Vlog(VlogBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime

    @field_validator('status', mode='before')
    @classmethod
    def convert_enum_to_str(cls, v):
        """Convert enum to string value"""
        if hasattr(v, 'value'):
            return v.value
        return v

    class Config:
        from_attributes = True


class VlogListResponse(BaseModel):
    vlogs: List[Vlog]
    total: int
    page: int
    per_page: int
    total_pages: int
