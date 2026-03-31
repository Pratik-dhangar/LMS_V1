# Authentication schemas for login requests and token responses
from pydantic import BaseModel
from typing import Optional


# User (Admin/Head/Trainer/Consultant) login request with role and passcode
class UserLogin(BaseModel):
    role: str
    passcode: str
    # Optional: Device information for single-device session management
    device_id: Optional[str] = None
    device_name: Optional[str] = None
    device_type: Optional[str] = None  # "mobile", "desktop", "tablet"
    browser_info: Optional[str] = None
    ip_address: Optional[str] = None


# Token response schema
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    name: str
