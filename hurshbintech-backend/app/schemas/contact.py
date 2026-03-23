"""Pydantic schemas for Contact Us Submissions
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, EmailStr


class ContactCreate(BaseModel):
    """Schema for creating a new contact submission"""
    parent_name: str = Field(..., min_length=2, max_length=255, description="Name of the parent/submitter")
    child_name: Optional[str] = Field(None, min_length=2, max_length=255, description="Name of the child")
    child_age: Optional[str] = Field(None, max_length=20, description="Age of the child")
    address: Optional[str] = Field(None, max_length=1000, description="Address")
    email: EmailStr = Field(..., description="Email address")
    phone: Optional[str] = Field(None, max_length=20, description="Phone number")
    message: str = Field(..., min_length=5, max_length=5000, description="Contact message")

    class Config:
        json_schema_extra = {
            "example": {
                "parent_name": "John Doe",
                "child_name": "Jane Doe",
                "child_age": "7",
                "address": "Andheri West, Mumbai",
                "email": "john@example.com",
                "phone": "+91 98XXXXXX",
                "message": "I would like to inquire about your coaching programs..."
            }
        }


class ContactUpdate(BaseModel):
    """Schema for updating contact submission (admin only)"""
    status: Optional[str] = Field(None, description="Contact status: new, read, replied, archived")
    admin_notes: Optional[str] = Field(None, max_length=2000, description="Admin notes/response")
    is_resolved: Optional[bool] = Field(None, description="Is the contact resolved?")

    class Config:
        json_schema_extra = {
            "example": {
                "status": "replied",
                "admin_notes": "We have called the parent regarding their inquiry...",
                "is_resolved": True
            }
        }


class ContactResponse(BaseModel):
    """Schema for returning contact information"""
    id: int
    parent_name: str
    child_name: Optional[str]
    child_age: Optional[str]
    address: Optional[str]
    email: str
    phone: Optional[str]
    message: str
    status: str
    admin_notes: Optional[str]
    is_resolved: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "parent_name": "John Doe",
                "child_name": "Jane Doe",
                "child_age": "7",
                "address": "Andheri West, Mumbai",
                "email": "john@example.com",
                "phone": "+91 98XXXXXX",
                "message": "I would like to inquire about your coaching programs...",
                "status": "new",
                "admin_notes": None,
                "is_resolved": False,
                "created_at": "2024-02-13T10:00:00",
                "updated_at": "2024-02-13T10:00:00"
            }
        }


class ContactListResponse(BaseModel):
    """Schema for paginated list of contacts"""
    data: list[ContactResponse]
    total: int
    skip: int
    limit: int


class ContactStatsResponse(BaseModel):
    """Schema for contact statistics"""
    total_contacts: int
    new_contacts: int
    read_contacts: int
    replied_contacts: int
    archived_contacts: int
    unresolved_contacts: int

    class Config:
        json_schema_extra = {
            "example": {
                "total_contacts": 45,
                "new_contacts": 12,
                "read_contacts": 20,
                "replied_contacts": 10,
                "archived_contacts": 3,
                "unresolved_contacts": 32
            }
        }
