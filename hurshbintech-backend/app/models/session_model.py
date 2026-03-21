"""
Training Session Model - For video conferencing sessions
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import relationship, backref

from app.db.session import Base

# Association table for many-to-many relationship between sessions and learning content
session_content_association = Table(
    "session_learning_content",
    Base.metadata,
    Column(
        "session_id",
        Integer,
        ForeignKey("training_sessions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "content_id",
        Integer,
        ForeignKey("learning_contents.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)

session_goal_association = Table(
    "session_learning_goal",
    Base.metadata,
    Column(
        "session_id",
        Integer,
        ForeignKey("training_sessions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "goal_id", Integer, ForeignKey("learning_goals.id", ondelete="CASCADE"), primary_key=True
    ),
)


class TrainingSession(Base):
    """Training session for video conferencing between trainer and learner"""

    __tablename__ = "training_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    duration = Column(Integer)  # Session duration in minutes

    # Participants
    trainer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    learner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_by_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )  # Head who created the session
    
    # Subscription tracking
    subscription_id = Column(Integer, ForeignKey("learner_subscriptions.id", ondelete="SET NULL"), nullable=True, index=True, comment="Linked learner subscription for session count tracking")
    session_counted = Column(Integer, default=False, nullable=False, comment="Has this ended session been counted towards subscription usage?")

    # New tracking fields
    total_duration = Column(Integer, comment="Total duration of session in minutes")  # Calculated duration
    learner_name = Column(String(255), comment="Cached learner name for quick access")  # Denormalized for performance
    session_start_time = Column(DateTime, comment="When session was actually started by trainer")  # Actual start time by trainer

    # Session status: scheduled, active, ended, cancelled
    status = Column(String(50), default="scheduled", nullable=False)
    scheduled_date = Column(DateTime, nullable=False)
    started_at = Column(DateTime)
    ended_at = Column(DateTime)

    # Program link (optional) — set at scheduling time; governs which program's goals/content were used
    program_id = Column(
        Integer,
        ForeignKey("programs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Session data
    notes = Column(Text)
    
    # Recording fields
    recording_url = Column(String(500), comment="Storage path/key for session recording")
    recording_status = Column(
        String(50), 
        default="pending", 
        comment="Recording status: pending, recording, processing, completed, failed"
    )
    recording_uploaded_at = Column(DateTime, comment="When recording was successfully stored")
    recording_started_at = Column(DateTime, nullable=True, comment="When recording started (for chunked uploads)")
    recording_duration = Column(Integer, nullable=True, comment="Total recording duration in seconds")

    # Relationships
    trainer = relationship("User", foreign_keys=[trainer_id], passive_deletes=True)
    learner = relationship("User", foreign_keys=[learner_id], passive_deletes=True)
    created_by = relationship("User", foreign_keys=[created_by_id], passive_deletes=True)
    subscription = relationship("LearnerSubscription", foreign_keys=[subscription_id], passive_deletes=True)
    learning_contents = relationship(
        "LearningContent", secondary=session_content_association, backref="sessions"
    )
    learning_goals = relationship(
        "LearningGoals", secondary=session_goal_association, backref="sessions"
    )
    program = relationship("Program", foreign_keys=[program_id], back_populates="sessions")

    # Timestamps
    created_at = Column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
