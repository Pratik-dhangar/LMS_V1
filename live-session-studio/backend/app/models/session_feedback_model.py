"""Session feedback model."""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, SmallInteger
from sqlalchemy.sql import func
from app.db.session import Base


class SessionFeedback(Base):
    __tablename__ = "session_feedback"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    participant_id = Column(Integer, ForeignKey("demo_profiles.id"), nullable=False, index=True)
    # 1-5
    rating = Column(SmallInteger, nullable=False)
    remark = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<SessionFeedback room={self.room_id} participant={self.participant_id} rating={self.rating}>"
