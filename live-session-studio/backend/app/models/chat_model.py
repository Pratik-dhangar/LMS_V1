"""Room-scoped direct chat message model."""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.sql import func
from app.db.session import Base


class RoomMessage(Base):
    __tablename__ = "room_messages"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("demo_profiles.id"), nullable=False, index=True)
    # text | file
    message_type = Column(String(20), nullable=False, default="text")
    content = Column(Text, nullable=True)
    # For file messages: file_key under uploads/chat/
    file_key = Column(String(500), nullable=True)
    file_name = Column(String(500), nullable=True)
    file_size = Column(Integer, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<RoomMessage id={self.id} room={self.room_id} sender={self.sender_id}>"
