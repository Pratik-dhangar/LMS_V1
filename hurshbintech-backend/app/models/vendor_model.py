"""SQLAlchemy ORM Models for Vendor Management
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class Vendor(Base):
    """
    Vendor Management Model - Vendors managed by Admin users
    """

    __tablename__ = "vendors"

    # Primary Fields
    id = Column(Integer, primary_key=True, index=True)
    
    # Admin who created/manages this vendor
    admin_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Vendor Basic Info
    name = Column(String(255), nullable=False, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    contact_number = Column(String(20), nullable=False, unique=True, index=True)
    
    # Additional vendor information
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    
    # Business details
    company_name = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
    tax_id = Column(String(100), nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), index=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    admin = relationship("User", foreign_keys=[admin_id])
