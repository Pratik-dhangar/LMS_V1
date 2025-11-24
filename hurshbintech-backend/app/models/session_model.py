"""
Training Session Model - For video conferencing sessions
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Table
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.db.session import Base


# Association table for many-to-many relationship between sessions and learning content
session_content_association = Table(
    'session_learning_content',
    Base.metadata,
    Column('session_id', Integer, ForeignKey('training_sessions.id', ondelete='CASCADE'), primary_key=True),
    Column('content_id', Integer, ForeignKey('learning_contents.id', ondelete='CASCADE'), primary_key=True)
)

session_goal_association = Table(
    'session_learning_goal',
    Base.metadata,
    Column('session_id', Integer, ForeignKey('training_sessions.id', ondelete='CASCADE'), primary_key=True),
    Column('goal_id', Integer, ForeignKey('learning_goals.id', ondelete='CASCADE'), primary_key=True)
)


class TrainingSession(Base):
    """Training session for video conferencing between trainer and learner"""
    __tablename__ = "training_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    duration = Column(Integer)  # Session duration in minutes
    
    # Participants
    trainer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    learner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Head who created the session
    
    # Session status: scheduled, active, ended, cancelled
    status = Column(String(50), default="scheduled", nullable=False)
    scheduled_date = Column(DateTime, nullable=False)
    started_at = Column(DateTime)
    ended_at = Column(DateTime)
    
    # Session data
    notes = Column(Text)
    
    # Relationships
    trainer = relationship("User", foreign_keys=[trainer_id])
    learner = relationship("User", foreign_keys=[learner_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    learning_contents = relationship(
        "LearningContent",
        secondary=session_content_association,
        backref="sessions"
    )
    learning_goals = relationship(
        "LearningGoals",
        secondary=session_goal_association,
        backref="sessions"
    )
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

