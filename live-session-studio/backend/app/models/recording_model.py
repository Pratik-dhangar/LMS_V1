"""Recording metadata model."""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.sql import func
from app.db.session import Base


class Recording(Base):
    __tablename__ = "recordings"

    id = Column(Integer, primary_key=True, index=True)
    # Numeric room id (for recording chunk upload compatibility)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True, index=True)
    # String session_id for path/lookup
    session_str_id = Column(String(100), nullable=True, index=True)
    # Storage key (path under RECORDINGS_DIR/)
    file_key = Column(String(500), nullable=True)
    # pending | uploading | finalizing | ready | error
    status = Column(String(30), nullable=False, default="pending")
    duration = Column(Float, nullable=True)
    chunk_count = Column(Integer, nullable=True)
    total_size = Column(Integer, nullable=True)
    # Soft-delete
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Recording id={self.id} room={self.room_id} status={self.status}>"
