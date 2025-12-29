"""Pydantic schemas for About Us Page
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class AboutUsBase(BaseModel):
    # Version and language
    version_number: int = Field(default=1)
    language_code: str = Field(default="en", max_length=10)
    is_active: bool = Field(default=True)
    
    # Featured image
    featured_image_url: Optional[str] = Field(None, max_length=500)
    
    # Hero section
    hero_title: Optional[str] = Field(None, max_length=255)
    hero_subtitle: Optional[str] = Field(None, max_length=500)
    
    # Introduction - Who We Are
    intro_title: Optional[str] = Field(default="Who We Are", max_length=255)
    intro_content: Optional[str] = None
    
    # Mission
    mission_title: Optional[str] = Field(default="Our Mission", max_length=255)
    mission_content: Optional[str] = None
    
    # Vision
    vision_title: Optional[str] = Field(default="Our Vision", max_length=255)
    vision_content: Optional[str] = None
    
    # What We Teach - Programs & Content
    programs_title: Optional[str] = Field(default="What We Teach", max_length=255)
    programs_content: Optional[str] = None
    
    # How We Teach - Teaching Methodology
    methodology_title: Optional[str] = Field(default="How We Teach", max_length=255)
    methodology_content: Optional[str] = None
    
    # Why Choose Us
    why_us_title: Optional[str] = Field(default="Why Choose Us", max_length=255)
    why_us_content: Optional[str] = None
    
    # Our Educators / Team
    team_title: Optional[str] = Field(default="Our Educators", max_length=255)
    team_content: Optional[str] = None
    
    # Learner & Parent Focus
    learner_focus_title: Optional[str] = Field(default="Learner & Parent Focus", max_length=255)
    learner_focus_content: Optional[str] = None
    
    # Our Values
    values_title: Optional[str] = Field(default="Our Values", max_length=255)
    values_content: Optional[str] = None
    
    # Our Commitment
    commitment_title: Optional[str] = Field(default="Our Commitment", max_length=255)
    commitment_content: Optional[str] = None
    
    # Status
    status: str = Field(default="draft", pattern="^(draft|published)$")


class AboutUsCreate(AboutUsBase):
    pass


class AboutUsUpdate(BaseModel):
    # Version and language
    version_number: Optional[int] = None
    language_code: Optional[str] = Field(None, max_length=10)
    is_active: Optional[bool] = None
    
    # Featured image
    featured_image_url: Optional[str] = Field(None, max_length=500)
    
    # Hero section
    hero_title: Optional[str] = Field(None, max_length=255)
    hero_subtitle: Optional[str] = Field(None, max_length=500)
    
    # Introduction
    intro_title: Optional[str] = Field(None, max_length=255)
    intro_content: Optional[str] = None
    
    # Mission
    mission_title: Optional[str] = Field(None, max_length=255)
    mission_content: Optional[str] = None
    
    # Vision
    vision_title: Optional[str] = Field(None, max_length=255)
    vision_content: Optional[str] = None
    
    # Programs
    programs_title: Optional[str] = Field(None, max_length=255)
    programs_content: Optional[str] = None
    
    # Methodology
    methodology_title: Optional[str] = Field(None, max_length=255)
    methodology_content: Optional[str] = None
    
    # Why Us
    why_us_title: Optional[str] = Field(None, max_length=255)
    why_us_content: Optional[str] = None
    
    # Team
    team_title: Optional[str] = Field(None, max_length=255)
    team_content: Optional[str] = None
    
    # Learner Focus
    learner_focus_title: Optional[str] = Field(None, max_length=255)
    learner_focus_content: Optional[str] = None
    
    # Values
    values_title: Optional[str] = Field(None, max_length=255)
    values_content: Optional[str] = None
    
    # Commitment
    commitment_title: Optional[str] = Field(None, max_length=255)
    commitment_content: Optional[str] = None
    
    # Status
    status: Optional[str] = Field(None, pattern="^(draft|published)$")


class AboutUsAuthor(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        from_attributes = True


class AboutUsResponse(AboutUsBase):
    id: int
    author_id: int
    author: AboutUsAuthor
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
