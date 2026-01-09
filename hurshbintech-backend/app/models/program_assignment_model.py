"""SQLAlchemy ORM Model for Program Assignment
Tracks program assignments from Head to Learners with completion status, notes, and dates
"""

import enum
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, Integer, Text, Date, String, JSON
from sqlalchemy.orm import relationship

from app.db.session import Base


class CompletionStatus(str, enum.Enum):
    """Enum for program assignment completion status"""
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class ProgramAssignment(Base):
    """Tracks program assignments from Head to Learners"""
    __tablename__ = "program_assignments"

    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign Keys
    learner_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    program_ids = Column(
        JSON,
        nullable=False,
        default=list
    )  # List of program IDs assigned under this title
    assigned_by_head = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    
    # Assignment details
    assignment_title = Column(String(255), nullable=False)  # Title/Name for this assignment
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    duration_days = Column(Integer, nullable=True)  # Manual override, null = auto-calculate
    head_notes = Column(Text, nullable=True)
    learner_notes = Column(Text, nullable=True)
    
    # Completion tracking
    completion_status = Column(
        SQLEnum(CompletionStatus),
        nullable=False,
        default=CompletionStatus.NOT_STARTED,
        index=True
    )
    completed_at = Column(DateTime, nullable=True)
    
    # Final Feedback from Head
    final_feedback_rating = Column(Integer, nullable=True)  # 1-5 stars
    final_feedback_remarks = Column(Text, nullable=True)
    final_feedback_given_at = Column(DateTime, nullable=True)
    
    # Future enhancement
    notification_sent = Column(Boolean, default=False, nullable=False)
    
    # Timestamps
    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    learner = relationship("User", foreign_keys=[learner_id], backref="program_assignments")
    assigned_by = relationship("User", foreign_keys=[assigned_by_head])
    attachments = relationship(
        "ProgramAssignmentAttachment",
        back_populates="assignment",
        cascade="all, delete-orphan"
    )
    # content_assignments backref is created automatically by LearnerContentAssignment.program_assignment relationship