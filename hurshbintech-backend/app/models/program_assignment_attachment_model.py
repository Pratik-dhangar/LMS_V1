"""SQLAlchemy ORM Model for Program Assignment Attachments
Tracks file attachments (images, videos, PDFs) uploaded by Head or Learner
"""

import enum
from datetime import datetime

from sqlalchemy import Column, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.session import Base


class AttachmentType(str, enum.Enum):
    """Enum for attachment file types"""
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    PDF = "PDF"


class ProgramAssignmentAttachment(Base):
    """File attachments for program assignments"""
    __tablename__ = "program_assignment_attachments"

    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign Keys
    assignment_id = Column(
        Integer,
        ForeignKey("program_assignments.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    uploaded_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    
    # File details
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)  # S3 or local path
    file_type = Column(SQLEnum(AttachmentType), nullable=False)
    file_size = Column(Integer, nullable=True)  # in bytes
    thumbnail_url = Column(String(500), nullable=True)  # for images/videos
    description = Column(String(500), nullable=True)
    
    # Timestamp
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    assignment = relationship("ProgramAssignment", back_populates="attachments")
    uploader = relationship("User")
