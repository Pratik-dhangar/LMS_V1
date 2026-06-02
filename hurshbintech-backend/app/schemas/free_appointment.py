"""Pydantic schemas for free appointment submissions."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class FreeAppointmentCreate(BaseModel):
    child_name: str = Field(..., min_length=2, max_length=255)
    age: int = Field(..., ge=0, le=18)
    concerns: Optional[str] = None
    diagnosis: Optional[str] = None
    address: Optional[str] = None
    contact_number: str = Field(..., min_length=10, max_length=20)
    reference_by: Optional[str] = Field(None, max_length=255)

    @field_validator("contact_number")
    @classmethod
    def validate_contact_number(cls, v):
        cleaned = v.strip()
        if not cleaned.replace("+", "").replace("-", "").replace(" ", "").isdigit():
            raise ValueError("Contact number must contain only digits")
        return cleaned


class FreeAppointmentResponse(FreeAppointmentCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FreeAppointmentListResponse(BaseModel):
    data: list[FreeAppointmentResponse]
    total: int
    skip: int
    limit: int
