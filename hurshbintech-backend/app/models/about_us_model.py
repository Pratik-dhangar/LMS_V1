"""SQLAlchemy ORM Model for About Us Page
"""
import enum
from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class AboutUsStatus(enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"


class AboutUs(Base):
    __tablename__ = "about_us"

    id = Column(Integer, primary_key=True, index=True)
    
    # Version and language support
    version_number = Column(Integer, default=1, nullable=False)
    language_code = Column(String(10), default="en", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    
    # Featured image
    featured_image_url = Column(String(500), nullable=True)
    
    # Hero section
    hero_title = Column(String(255), nullable=True)
    hero_subtitle = Column(String(500), nullable=True)
    
    # Introduction - Who We Are
    intro_title = Column(String(255), nullable=True, default="Who We Are")
    intro_content = Column(Text, nullable=True)
    
    # Mission
    mission_title = Column(String(255), nullable=True, default="Our Mission")
    mission_content = Column(Text, nullable=True)
    
    # Vision
    vision_title = Column(String(255), nullable=True, default="Our Vision")
    vision_content = Column(Text, nullable=True)
    
    # What We Teach - Programs & Content
    programs_title = Column(String(255), nullable=True, default="What We Teach")
    programs_content = Column(Text, nullable=True)
    
    # How We Teach - Teaching Methodology
    methodology_title = Column(String(255), nullable=True, default="How We Teach")
    methodology_content = Column(Text, nullable=True)
    
    # Why Choose Us
    why_us_title = Column(String(255), nullable=True, default="Why Choose Us")
    why_us_content = Column(Text, nullable=True)
    
    # Our Educators / Team
    team_title = Column(String(255), nullable=True, default="Our Educators")
    team_content = Column(Text, nullable=True)
    
    # Learner & Parent Focus
    learner_focus_title = Column(String(255), nullable=True, default="Learner & Parent Focus")
    learner_focus_content = Column(Text, nullable=True)
    
    # Our Values
    values_title = Column(String(255), nullable=True, default="Our Values")
    values_content = Column(Text, nullable=True)
    
    # Our Commitment
    commitment_title = Column(String(255), nullable=True, default="Our Commitment")
    commitment_content = Column(Text, nullable=True)
    
    # Featured Coach for appointment booking
    featured_coach_id = Column(Integer, ForeignKey("coach_profiles.id"), nullable=True)
    
    # Metadata
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(SAEnum(AboutUsStatus), default=AboutUsStatus.DRAFT, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    author = relationship("User", foreign_keys=[author_id])
