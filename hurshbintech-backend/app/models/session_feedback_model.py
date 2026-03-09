"""
Session Feedback Model - Stores attendee feedback after session ends
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.session import Base


class SessionFeedback(Base):
    """Feedback submitted by attendee (learner/guest/client) after a session ends"""

    __tablename__ = "session_feedback"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        Integer, ForeignKey("training_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    attendee_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # For guests who may not have a user account
    attendee_name = Column(String(255), nullable=True)
    attendee_role = Column(String(50), nullable=False, default="learner")  # learner, guest, client

    rating = Column(Integer, nullable=False)  # 1-5 star rating
    remark = Column(Text, nullable=True)  # Optional text remark

    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
    )
