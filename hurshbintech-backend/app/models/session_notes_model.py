"""
Session Notes Model - For storing trainer's session notes with auto-save support
Independent from SessionReport - can be created/updated anytime
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text, String
from sqlalchemy.orm import relationship

from app.db.session import Base


class SessionNotes(Base):
    """Session notes written by trainer or coach during or after session - Independent entity"""

    __tablename__ = "session_notes"

    id = Column(Integer, primary_key=True, index=True)
    
    # Support both training sessions and coach appointment sessions
    session_id = Column(
        Integer, ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=True, index=True
    )
    coach_appointment_session_id = Column(
        Integer, ForeignKey("coach_appointment_sessions.id", ondelete="CASCADE"), nullable=True, index=True
    )
    
    trainer_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    coach_id = Column(
        Integer, ForeignKey("coach_profiles.id", ondelete="CASCADE"), nullable=True, index=True
    )
    
    notes = Column(Text, nullable=True)  # The actual notes content
    version = Column(Integer, default=1, nullable=False)  # Version number for tracking updates
    is_finalized = Column(String(10), default="false", nullable=False)  # "true" when session ends, "false" during session
    
    # Relationships
    session = relationship("TrainingSession", backref="session_notes", foreign_keys=[session_id])
    coach_appointment_session = relationship("CoachAppointmentSession", backref="session_notes", foreign_keys=[coach_appointment_session_id])
    trainer = relationship("User", foreign_keys=[trainer_id])
    coach = relationship("CoachProfile", foreign_keys=[coach_id])

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
