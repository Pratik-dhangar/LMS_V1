from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class VlogBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    file_url: str
    file_size: float
    thumbnail_url: Optional[str] = None

class VlogCreate(VlogBase):
    pass

class VlogUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    file_url: Optional[str] = None
    file_size: Optional[float] = None
    thumbnail_url: Optional[str] = None

class Vlog(VlogBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True