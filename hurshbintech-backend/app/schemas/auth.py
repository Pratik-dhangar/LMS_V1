# Authentication schemas for login requests and token responses
from pydantic import BaseModel


# User (Admin/Head/Trainer/Consultant) login request with role and passcode
class UserLogin(BaseModel):
    role: str
    passcode: str


# Token response schema
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    name: str
