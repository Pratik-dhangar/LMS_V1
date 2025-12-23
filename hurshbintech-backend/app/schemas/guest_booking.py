"""
Schemas for Guest Booking API endpoints
"""

from pydantic import BaseModel, EmailStr
from datetime import date, datetime
from typing import Optional


class GuestOTPRequest(BaseModel):
    """Request to send OTP to guest email"""
    email: EmailStr


class GuestOTPVerify(BaseModel):
    """Request to verify OTP and create guest intent"""
    email: EmailStr
    otp: str  # 6-digit code


class GuestIntentCreate(BaseModel):
    """Guest booking intent data"""
    coach_id: int
    scheduled_date: date
    scheduled_time: str
    session_type: str
    notes: Optional[str] = None
    guest_name: str
    guest_email: EmailStr
    guest_phone: str


class GuestIntentResponse(BaseModel):
    """Response for guest intent appointment"""
    id: int
    coach_id: int
    guest_name: str
    guest_email: str
    guest_phone: str
    scheduled_date: date
    scheduled_time: str
    session_type: str
    status: str
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class GuestPaymentUploadResponse(BaseModel):
    """Response after guest uploads payment"""
    message: str
    appointment_id: int


class CoachGuestApprovalResponse(BaseModel):
    """Response when coach approves guest intent"""
    message: str
    appointment_id: int
    upload_url: str
    token_expires_in_hours: int
