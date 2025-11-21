from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.db.session import Base

class ContentType(str, enum.Enum):
    IMAGE = "image"
    PDF = "pdf"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"

class LearningContent(Base):
    __tablename__ = "learning_contents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    content_type = Column(SQLEnum(ContentType), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=True)  # in bytes
    thumbnail_url = Column(String(500), nullable=True)  # for videos/images

    # Metadata
    created_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_admin_id])
    updated_by = relationship("User", foreign_keys=[updated_by_id])