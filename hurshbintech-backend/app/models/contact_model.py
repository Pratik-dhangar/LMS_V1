"""SQLAlchemy ORM Model for Contact Us Submissions
"""
import enum
from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, Integer, String, Text
from sqlalchemy.sql import func

from app.db.session import Base


class ContactStatus(enum.Enum):
    new = "new"
    read = "read"
    replied = "replied"
    archived = "archived"


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    
    # Submitter info
    parent_name = Column(String(255), nullable=False, index=True)
    child_name = Column(String(255), nullable=True, index=True)
    child_age = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    
    # Message
    message = Column(Text, nullable=False)
    
    # Admin tracking - Store as string to avoid PostgreSQL enum case sensitivity issues
    status = Column(SAEnum(ContactStatus), default=ContactStatus.new, nullable=False, index=True)
    admin_notes = Column(Text, nullable=True)
    is_resolved = Column(Boolean, default=False, nullable=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self):
        return f"<Contact(id={self.id}, parent_name={self.parent_name}, email={self.email}, status={self.status})>"
