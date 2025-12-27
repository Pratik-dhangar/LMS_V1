"""Pydantic schemas for Blog
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class BlogBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    excerpt: Optional[str] = Field(None, max_length=500)
    content: str = Field(..., min_length=1)
    featured_image_url: Optional[str] = Field(None, max_length=500)
    status: str = Field(default="draft", pattern="^(draft|published)$")


class BlogCreate(BlogBase):
    pass


class BlogUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    excerpt: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = Field(None, min_length=1)
    featured_image_url: Optional[str] = Field(None, max_length=500)
    status: Optional[str] = Field(None, pattern="^(draft|published)$")


class BlogAuthor(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        from_attributes = True


class BlogResponse(BlogBase):
    id: int
    slug: str
    author_id: int
    author: BlogAuthor
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BlogListResponse(BaseModel):
    blogs: list[BlogResponse]
    total: int
    page: int
    per_page: int
    total_pages: int
