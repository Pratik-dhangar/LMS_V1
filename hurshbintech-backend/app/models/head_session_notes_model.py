"""
Head Session Notes Model - For storing head's session notes (similar to trainer session notes)
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text, String
from sqlalchemy.orm import relationship

from app.db.session import Base


class HeadSessionNotes(Base):
    """Head session notes written by Head during or after session - Independent entity"""

    __tablename__ = "head_session_notes"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        Integer, ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    head_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    notes = Column(Text, nullable=True)
    version = Column(Integer, default=1, nullable=False)
    is_finalized = Column(String(10), default="false", nullable=False)

    # Relationships
    session = relationship("TrainingSession", backref="head_session_notes")
    head = relationship("User", foreign_keys=[head_id])

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
