"""SQLAlchemy ORM Model for Learner Content Assignment
Tracks direct assignment of learning content to learners (beyond program-based content)
"""

from datetime import datetime
import enum
import json

from sqlalchemy import Column, DateTime, ForeignKey, Integer, func, Text, Boolean, String
from sqlalchemy.orm import relationship

from app.db.session import Base


class ContentCompletionStatus(enum.Enum):
    """Enum for content completion status"""
    NEW = "NEW"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    LATE_SUBMITTED = "LATE_SUBMITTED"
    REVIEWED = "REVIEWED"
    RESUBMISSION_REQUIRED = "RESUBMISSION_REQUIRED"


class LearnerContentAssignment(Base):
    """Direct assignment of learning content to learners"""
    __tablename__ = "learner_content_assignments"

    id = Column(Integer, primary_key=True, index=True)
    learner_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    content_id = Column(
        Integer,
        ForeignKey("learning_contents.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    assigned_by_head = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    program_assignment_id = Column(
        Integer,
        ForeignKey("program_assignments.id", ondelete="CASCADE"),
        nullable=True,  # Null if manually assigned, not null if part of program
        index=True
    )
    
    # Status tracking
    completion_status = Column(
        String(50),
        default=ContentCompletionStatus.NEW.value,
        nullable=False
    )
    started_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by_head = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Head Feedback & Rating
    head_feedback_text = Column(Text, nullable=True)  # Remarks from head
    head_rating = Column(Integer, nullable=True)  # 1-5 star rating
    feedback_given_at = Column(DateTime(timezone=True), nullable=True)
    
    # Feedback History (JSON array of {feedback_text, rating, timestamp, updated_at})
    feedback_history = Column(Text, nullable=True, default="[]")  # Stored as JSON string
    
    # Resubmission Policy
    resubmit_allowed = Column(Boolean, default=True, nullable=False)  # Configurable per assignment
    
    assigned_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    learner = relationship("User", foreign_keys=[learner_id], backref="content_assignments")
    content = relationship("LearningContent", back_populates="learner_assignments")
    assigned_by = relationship("User", foreign_keys=[assigned_by_head])
    reviewer = relationship("User", foreign_keys=[reviewed_by_head])
    program_assignment = relationship("ProgramAssignment", backref="content_assignments")
