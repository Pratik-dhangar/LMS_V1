"""
Session Notes Model - For storing trainer's session notes with auto-save support
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text, String
from sqlalchemy.orm import relationship

from app.db.session import Base


class SessionNotes(Base):
    """Session notes written by trainer during or after session"""

    __tablename__ = "session_notes"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        Integer, ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    trainer_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    notes = Column(Text, nullable=True)  # The actual notes content
    version = Column(Integer, default=1, nullable=False)  # Version number for tracking updates
    is_finalized = Column(String(10), default="false", nullable=False)  # "true" when session ends, "false" during session
    
    # Relationships
    session = relationship("TrainingSession", backref="session_notes_history")
    trainer = relationship("User", foreign_keys=[trainer_id])

    # Timestamps
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False
    )
