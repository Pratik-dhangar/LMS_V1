"""Pydantic schemas for Assigned Training
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class TrainingFileInfo(BaseModel):
    """File information stored in training"""
    name: str
    url: str
    size: int
    type: str  # 'pdf', 'video', 'image', 'document', etc.


class AssignedTrainingBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    custom_content: Optional[str] = Field(None)  # HTML or rich text content
    featured_image_url: Optional[str] = Field(None)  # Thumbnail URL
    training_files: Optional[List[TrainingFileInfo]] = Field(default_factory=list)  # List of uploaded files
    training_ref_ids: Optional[List[int]] = Field(default_factory=list)
    target_roles: List[str] = Field(...)  # e.g., ["all"], ["admin", "head"], etc.
    target_user_ids: Optional[List[int]] = Field(default_factory=list)  # Specific user IDs
    active: bool = Field(default=True)
    custom_metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)



class AssignedTrainingCreate(AssignedTrainingBase):
    """Request schema for creating assigned training"""
    pass


class AssignedTrainingUpdate(BaseModel):
    """Request schema for updating assigned training"""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    custom_content: Optional[str] = None
    training_ref_ids: Optional[List[int]] = None
    target_roles: Optional[List[str]] = None
    target_user_ids: Optional[List[int]] = None
    active: Optional[bool] = None
    custom_metadata: Optional[Dict[str, Any]] = None


class AdminUser(BaseModel):
    """Minimal Admin user info"""
    id: int
    name: str
    email: Optional[str]

    class Config:
        from_attributes = True


class AssignedTrainingResponse(AssignedTrainingBase):
    """Response schema for assigned training"""
    id: int
    assigned_by_admin: Optional[int]
    assigned_by: Optional[AdminUser]
    created_at: datetime
    updated_at: datetime
    
    # User-specific fields (populated for non-admin users)
    user_status: Optional[str] = None  # "NEW", "IN_PROGRESS", "COMPLETED"
    user_progress: Optional[Dict[str, Any]] = None
    user_started_at: Optional[datetime] = None
    user_completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AssignedTrainingListResponse(BaseModel):
    """Response schema for paginated list of trainings"""
    items: List[AssignedTrainingResponse]
    total: int
    skip: int
    limit: int


class AssignedTrainingUserResponse(BaseModel):
    """Response schema for user-specific training assignment"""
    id: int
    assigned_training_id: int
    user_id: int
    status: str
    progress: Optional[Dict[str, Any]]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    evidence: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MarkCompleteRequest(BaseModel):
    """Request schema for marking training as complete"""
    evidence: Optional[str] = Field(None, max_length=5000)


class UserAssignmentStatusResponse(BaseModel):
    """Response for user assignment status"""
    training_id: int
    status: str
    progress: Optional[Dict[str, Any]]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
