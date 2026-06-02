from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class GalleryBase(BaseModel):
    photo_url: Optional[str] = None
    photo_size: Optional[float] = None
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    video_size: Optional[float] = None
    video_thumbnail_url: Optional[str] = None
    status: Optional[str] = Field(default="draft")  # "draft" or "published"


class GalleryCreate(GalleryBase):
    pass


class GalleryUpdate(BaseModel):
    photo_url: Optional[str] = None
    photo_size: Optional[float] = None
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    video_size: Optional[float] = None
    video_thumbnail_url: Optional[str] = None
    status: Optional[str] = None


class Gallery(GalleryBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime

    @field_validator("status", mode="before")
    @classmethod
    def convert_enum_to_str(cls, v):
        """Convert enum to string value"""
        if hasattr(v, "value"):
            return v.value
        return v

    class Config:
        from_attributes = True


class GalleryListResponse(BaseModel):
    galleries: List[Gallery]
    total: int
    page: int
