"""Room (live session pair) model."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.session import Base


class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    # Public stable identifier used in URLs and WebSocket paths
    session_id = Column(String(100), unique=True, nullable=False, index=True)
    trainer_id = Column(Integer, ForeignKey("demo_profiles.id"), nullable=False, index=True)
    learner_id = Column(Integer, ForeignKey("demo_profiles.id"), nullable=False, index=True)
    # active | ended
    status = Column(String(20), nullable=False, default="active", index=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Room id={self.id} session_id={self.session_id} status={self.status}>"
