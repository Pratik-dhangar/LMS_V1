"""
Reference data schemas for file management
Placeholder for future S3 integration
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ReferenceDataCreate(BaseModel):
    """Schema for creating reference data (file upload)"""

    data_type: str
    file_path: str
    description: Optional[str] = None


class ReferenceDataResponse(BaseModel):
    """Schema for reference data response"""

    id: int
    data_type: str
    file_path: str
    description: Optional[str]
    uploaded_at: datetime

    class Config:
        from_attributes = True
