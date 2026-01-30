"""
Webinar Models
Manages webinars created by Admin, Coach, or Head users
Supports external meeting platforms (Zoom, Meet, Teams, etc.)
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Date, Time
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class Webinar(Base):
    """
    Webinars table - stores webinar information
    Created by Admin, Coach, or Head users
    """
    __tablename__ = "webinars"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    meeting_link = Column(String(500), nullable=False)  # External meeting link (Zoom, Meet, Teams)
    
    # Scheduling
    scheduled_date = Column(Date, nullable=False)
    scheduled_time = Column(Time, nullable=False)
    
    # Creator (Admin, Coach, or Head)
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    participants = relationship("WebinarParticipant", back_populates="webinar", cascade="all, delete-orphan")


class WebinarParticipant(Base):
    """
    Webinar participants - can be registered users or unregistered (email only)
    """
    __tablename__ = "webinar_participants"

    id = Column(Integer, primary_key=True, index=True)
    webinar_id = Column(Integer, ForeignKey("webinars.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Participant can be either a registered user OR an unregistered email
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    unregistered_email = Column(String(255), nullable=True)  # For non-registered participants
    
    # Email tracking
    invitation_sent = Column(Boolean, default=False)
    invitation_sent_at = Column(DateTime, nullable=True)
    
    # Timestamps
    invited_at = Column(DateTime, default=func.now(), nullable=False)
    
    # Relationships
    webinar = relationship("Webinar", back_populates="participants")
    user = relationship("User", foreign_keys=[user_id])
