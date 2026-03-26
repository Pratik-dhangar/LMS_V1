"""
Training Session Model - For video conferencing sessions
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Table, Text
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
    has_recording = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        comment="Whether this session has a recording",
    )
    recording_id = Column(
        String(255),
        nullable=True,
        unique=True,
        comment="Unique recording identifier",
    )
    recording_url = Column(String(500), comment="Storage path/key for session recording")
    recording_status = Column(
        String(50), 
        default="pending", 
        comment="Recording status: pending, recording, processing, completed, failed"
    )
    recording_error = Column(Text, nullable=True, comment="Error details if recording fails")
    recording_uploaded_at = Column(DateTime, comment="When recording was successfully stored")
    recording_started_at = Column(DateTime, nullable=True, comment="When recording started (for chunked uploads)")
    recording_created_at = Column(DateTime, nullable=True, comment="When recording metadata was created")
    recording_duration = Column(Integer, nullable=True, comment="Total recording duration in seconds")
    recording_chunks_count = Column(
        Integer,
        nullable=True,
        default=0,
        server_default="0",
        comment="Number of chunks uploaded",
    )
    s3_key = Column(String(500), nullable=True, comment="S3 key for stored recording")

    __table_args__ = (
        Index("ix_training_sessions_has_recording", "has_recording"),
        Index("ix_training_sessions_recording_id", "recording_id", unique=True),
        Index("ix_training_sessions_recording_started_at", "recording_started_at"),
    )

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

    def start_recording(self, recording_id: str) -> None:
        self.recording_id = recording_id
        self.recording_status = "recording"
        self.recording_started_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self.recording_created_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self.has_recording = True

    def mark_processing(self) -> None:
        self.recording_status = "processing"

    def finalize_recording(self, recording_url: str, duration: int, s3_key: str = None) -> None:
        self.recording_status = "completed"
        self.recording_url = recording_url
        self.recording_duration = duration
        self.recording_uploaded_at = datetime.now(timezone.utc).replace(tzinfo=None)
        if s3_key:
            self.s3_key = s3_key

    def mark_recording_failed(self, error: str) -> None:
        self.recording_status = "failed"
        self.recording_error = error

    def update_chunk_count(self, count: int) -> None:
        self.recording_chunks_count = count

    def is_recording_ready(self) -> bool:
        return (
            self.recording_status == "completed"
            and self.recording_url is not None
            and self.has_recording is True
        )

    def get_recording_info(self) -> dict:
        return {
            "has_recording": self.has_recording,
            "recording_id": self.recording_id,
            "recording_status": self.recording_status,
            "recording_url": self.recording_url,
            "recording_duration": self.recording_duration,
            "recording_error": self.recording_error,
            "chunks_uploaded": self.recording_chunks_count,
            "s3_key": self.s3_key,
        }


class RecordingChunk(Base):
    __tablename__ = "recording_chunks"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False)
    recording_id = Column(String(255), nullable=False)
    chunk_number = Column(Integer, nullable=False)
    file_path = Column(String(500), nullable=False)
    s3_key = Column(String(500), nullable=True)
    file_hash = Column(String(64), nullable=True)
    file_size = Column(Integer, nullable=True)
    status = Column(String(50), nullable=False, default="uploaded", server_default="uploaded")
    uploaded_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
    )
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )

    __table_args__ = (
        Index("ix_recording_chunks_recording_id", "recording_id"),
        Index("ix_recording_chunks_chunk_number", "recording_id", "chunk_number"),
    )


class RecordingLog(Base):
    __tablename__ = "recording_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("training_sessions.id", ondelete="SET NULL"), nullable=True)
    recording_id = Column(String(255), nullable=True)
    event_type = Column(String(50), nullable=False)
    event_message = Column(Text, nullable=False)
    chunk_number = Column(Integer, nullable=True)
    error_details = Column(Text, nullable=True)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_recording_logs_session_id", "session_id"),
        Index("ix_recording_logs_recording_id", "recording_id"),
        Index("ix_recording_logs_event_type", "event_type"),
    )
