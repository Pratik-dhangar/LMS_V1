"""
Coach Appointment Session Model - For one-on-one video conferencing based on appointments
Reuses existing WebRTC infrastructure from training sessions
Note: This is different from coach_sessions table which handles group sessions
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.session import Base


class CoachAppointmentSession(Base):
    """
    One-on-one video conferencing session between coach and client (registered user or guest)
    Created when appointment is confirmed by coach
    """

    __tablename__ = "coach_appointment_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, nullable=False, index=True)
    
    # Link to original appointment (one-to-one relationship)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    # Participants
    coach_id = Column(Integer, ForeignKey("coach_profiles.id", ondelete="CASCADE"), nullable=False)
    
    # Client can be either registered user or guest
    client_user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)  # NULL for guest sessions
    client_name = Column(String(255), nullable=False)  # Cached name (from user or guest)
    client_email = Column(String(255), nullable=False)  # Cached email (from user or guest)
    
    # Session details (copied from appointment at creation)
    title = Column(String(255), nullable=False)  # e.g., "Initial Consultation - John Doe"
    description = Column(Text)
    scheduled_date = Column(DateTime, nullable=False)
    duration = Column(Integer, default=60)  # Session duration in minutes
    session_type = Column(String(255))  # e.g., "initial_consultation", "follow_up"
    
    # Session status: scheduled, active, ended, cancelled
    status = Column(String(50), default="scheduled", nullable=False)
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    
    # Session data
    notes = Column(Text)  # Post-session notes by coach
    
    # Recording fields
    recording_url = Column(String(500), comment="Storage path/key for session recording")
    recording_status = Column(
        String(50), 
        default="pending", 
        comment="Recording status: pending, processing, completed, failed"
    )
    recording_uploaded_at = Column(DateTime, comment="When recording was successfully stored")
    
    # Relationships
    appointment = relationship("Appointment", back_populates="appointment_session", uselist=False)
    coach = relationship("CoachProfile", foreign_keys=[coach_id])
    client_user = relationship("User", foreign_keys=[client_user_id])
    
    # Timestamps
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
    )
