"""
Session Report Model - For storing session report data and session notes
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.session import Base


class SessionReport(Base):
    """Session report storing prompt and reinforcement meter values for each program, plus session notes"""

    __tablename__ = "session_reports"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        Integer, ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    learner_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    program_id = Column(
        Integer, ForeignKey("learning_goals.id", ondelete="SET NULL"), nullable=True, index=True
    )
    program_name = Column(String(500), nullable=False)
    prompt_meter = Column(
        String(10), nullable=False
    )  # Values: 'I', '10', '20', '30', '40', '50', '60', '70', '80', '90'
    reinforcement_meter = Column(
        String(10), nullable=False
    )  # Values: 'Full', '90', '80', '70', '60', '50', '40', '30', '20', '10'
    
    # Session notes - stored at the session level (same for all report rows of a session)
    session_notes = Column(Text, nullable=True)  # Trainer's notes for this session

    # Relationships
    session = relationship("TrainingSession", backref="session_reports")
    learner = relationship("User", foreign_keys=[learner_id])
    program = relationship("LearningGoals", foreign_keys=[program_id])

    # Timestamps
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
