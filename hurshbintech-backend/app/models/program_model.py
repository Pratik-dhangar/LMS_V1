"""
Program Model - Container for Learning Goals and Learning Content in session scheduling
Program goals and content can be inherited by sessions, but sessions can override both.
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.db.session import Base


class Program(Base):
    """
    A Program bundles a set of goals and learning content that can be
    inherited by sessions. Sessions can override both the goals and content.
    Scoped to a specific head + learner pair so the session scheduling
    dropdown stays focused.
    """

    __tablename__ = "programs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Owner / scope
    head_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    learner_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # JSON arrays referencing IDs in learning_goals and learning_contents tables
    # goal_ids is SET AT CREATION and never modified afterwards
    goal_ids = Column(JSON, nullable=False, default=list)
    # content_ids is freely mutable — updated whenever head changes content during scheduling
    content_ids = Column(JSON, nullable=False, default=list)

    # Soft-delete: keeps historical session → program links intact
    is_active = Column(Boolean, nullable=False, default=True)

    # Timestamps
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

    # Relationships (informational — not used for data storage)
    head = relationship("User", foreign_keys=[head_id])
    learner = relationship("User", foreign_keys=[learner_id])
    sessions = relationship("TrainingSession", back_populates="program", passive_deletes=True)
