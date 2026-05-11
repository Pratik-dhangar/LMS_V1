"""
Device Session Model - Tracks active devices for each user
Enforces single-device active session constraint
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import backref, relationship
from app.db.session import Base


class DeviceSession(Base):
    """
    Tracks device sessions for users.
    Enforces constraint: only ONE device can be active per user at a time.
    """

    __tablename__ = "device_sessions"

    # Core Fields
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Device Information
    device_id = Column(String(255), nullable=False, index=True)  # Unique device identifier (fingerprint/UUID)
    device_name = Column(String(255), nullable=True)  # e.g., "Chrome on Windows 10", "Safari on iPhone"
    device_type = Column(String(50), nullable=True)  # e.g., "mobile", "desktop", "tablet"
    browser_info = Column(String(255), nullable=True)  # e.g., "Chrome 120.0", "Safari 17.0"
    ip_address = Column(String(50), nullable=True)
    
    # Session Information
    access_token_hash = Column(String(255), nullable=False, index=True)  # Hash of the JWT token
    is_active = Column(Boolean, default=True, index=True)  # Is this device currently active?
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), index=True)
    last_activity_at = Column(DateTime, default=func.now(), onupdate=func.now())
    deactivated_at = Column(DateTime, nullable=True)  # When was this session deactivated?
    
    # Relationships
    user = relationship(
        "User",
        backref=backref("device_sessions", passive_deletes=True, cascade="all, delete-orphan"),
    )

    def __repr__(self):
        return f"<DeviceSession(user_id={self.user_id}, device_id={self.device_id}, is_active={self.is_active})>"
