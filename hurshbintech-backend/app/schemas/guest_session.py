"""
Guest Session Schemas - for guest users to join coach sessions
"""

from pydantic import BaseModel, EmailStr
from typing import Optional


class GuestSessionTokenCreate(BaseModel):
    """Schema for creating a guest session token"""
    appointment_id: int


class GuestSessionTokenResponse(BaseModel):
    """Response with guest session access token"""
    token: str
    session_link: str
    expires_in_hours: int
    
    
class GuestSessionAuthRequest(BaseModel):
    """Request to authenticate guest and get session details"""
    token: str


class GuestSessionDetails(BaseModel):
    """Session details returned for guest user"""
    session_id: str
    coach_name: str
    client_name: str
    scheduled_date: str
    scheduled_time: str
    duration: int
    status: str
    appointment_id: int
    # Guest info for verification display
    guest_email: str
    guest_name: str
