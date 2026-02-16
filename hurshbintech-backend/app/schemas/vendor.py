"""
Vendor schemas for CRUD operations
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class VendorCreate(BaseModel):
    """Schema for creating a new vendor"""
    
    name: str
    email: EmailStr
    contact_number: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    company_name: Optional[str] = None
    website: Optional[str] = None
    tax_id: Optional[str] = None


class VendorUpdate(BaseModel):
    """Schema for updating vendor information"""
    
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    contact_number: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    company_name: Optional[str] = None
    website: Optional[str] = None
    tax_id: Optional[str] = None
    is_active: Optional[bool] = None


class VendorResponse(BaseModel):
    """Schema for vendor response"""
    
    id: int
    admin_id: int
    name: str
    email: str
    contact_number: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    company_name: Optional[str] = None
    website: Optional[str] = None
    tax_id: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class VendorListResponse(BaseModel):
    """Schema for vendor list response with pagination"""
    
    id: int
    name: str
    email: str
    contact_number: str
    company_name: Optional[str] = None
    city: Optional[str] = None
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
