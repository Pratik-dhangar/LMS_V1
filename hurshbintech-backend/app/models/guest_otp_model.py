"""
Guest OTP Model - For storing temporary OTPs for guest email verification
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func

from app.db.session import Base


class GuestOTP(Base):
    """
    Temporary OTP storage for guest email verification (10-minute TTL).
    
    Security:
    - OTP is 6-digit random code
    - Valid for 10 minutes only (expires_at timestamp)
    - Can only be used once (is_used flag)
    - Email-indexed for fast lookup
    """
    __tablename__ = "guest_otps"

    id = Column(Integer, primary_key=True, index=True)
    
    # Guest email (case-insensitive for consistency)
    email = Column(String(255), nullable=False, index=True)
    
    # OTP code (6-digit number)
    otp_code = Column(String(6), nullable=False)
    
    # Whether this OTP has been used
    is_used = Column(Boolean, default=False, index=True)
    
    # OTP expiration time (10 minutes from generation)
    expires_at = Column(DateTime, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
