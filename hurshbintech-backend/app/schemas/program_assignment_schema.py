"""Pydantic schemas for Program Assignment"""

from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models.program_assignment_model import CompletionStatus
from app.models.program_assignment_attachment_model import AttachmentType


# ============= Program Learning Content Schemas =============

class ProgramContentLink(BaseModel):
    """Schema for program-content link"""
    content_id: int
    sequence_order: int


class ProgramContentReorder(BaseModel):
    """Schema for reordering program contents"""
    content_orders: List[dict] = Field(..., example=[{"content_id": 1, "sequence_order": 0}])


class LearningContentInProgram(BaseModel):
    """Schema for learning content within a program"""
    id: int
    title: str
    description: Optional[str]
    content_type: str
    file_url: str
    thumbnail_url: Optional[str]
    sequence_order: int

    class Config:
        from_attributes = True


class ProgramWithContents(BaseModel):
    """Schema for program with its learning contents"""
    id: int
    goal: str
    goal_description: Optional[str]
    contents: List[LearningContentInProgram] = []

    class Config:
        from_attributes = True


# ============= Program Assignment Schemas =============

class ProgramAssignmentCreate(BaseModel):
    """Schema for creating a program assignment"""
    learner_ids: List[int] = Field(..., min_length=1)
    program_id: int
    start_date: date
    end_date: date
    duration_days: Optional[int] = None
    head_notes: Optional[str] = None
    extra_content_ids: Optional[List[int]] = Field(default=None, description="Additional learning content IDs to assign")


class ProgramAssignmentUpdate(BaseModel):
    """Schema for updating a program assignment (Head)"""
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    duration_days: Optional[int] = None
    head_notes: Optional[str] = None
    completion_status: Optional[CompletionStatus] = None


class LearnerAssignmentUpdate(BaseModel):
    """Schema for updating assignment (Learner - restricted)"""
    learner_notes: Optional[str] = None
    completion_status: Optional[CompletionStatus] = None


class UserBasic(BaseModel):
    """Basic user info"""
    id: int
    name: str
    email: Optional[str]

    class Config:
        from_attributes = True


class ProgramBasic(BaseModel):
    """Basic program info"""
    id: int
    goal: str
    goal_description: Optional[str]

    class Config:
        from_attributes = True


class ProgramAssignmentResponse(BaseModel):
    """Schema for program assignment response"""
    id: int
    learner_id: int
    learner: UserBasic
    program_id: int
    program: ProgramWithContents
    assigned_by_head: Optional[int]
    assigned_by: Optional[UserBasic]
    start_date: date
    end_date: date
    duration_days: Optional[int]
    head_notes: Optional[str]
    learner_notes: Optional[str]
    completion_status: CompletionStatus
    completed_at: Optional[datetime]
    notification_sent: bool
    assigned_at: datetime
    updated_at: datetime
    is_overdue: bool = False
    is_late_submission: bool = False

    class Config:
        from_attributes = True


class ProgramAssignmentListResponse(BaseModel):
    """Simplified schema for assignment list"""
    id: int
    learner_id: int
    learner_name: str
    program_id: int
    program_name: str
    start_date: date
    end_date: date
    duration_days: Optional[int]
    completion_status: CompletionStatus
    completed_at: Optional[datetime]
    assigned_at: datetime
    is_overdue: bool = False
    is_late_submission: bool = False

    class Config:
        from_attributes = True


class CompletionStatsResponse(BaseModel):
    """Schema for learner completion statistics"""
    total_assignments: int
    completed: int
    in_progress: int
    not_started: int
    completion_percentage: float


class BulkAssignmentResult(BaseModel):
    """Schema for bulk assignment creation result"""
    success_count: int
    failed_count: int
    failed_learners: List[dict] = []  # [{"learner_id": 1, "learner_name": "...", "reason": "..."}]
    created_assignments: List[int] = []  # List of created assignment IDs


# ============= Attachment Schemas =============

class AttachmentUpload(BaseModel):
    """Schema for attachment upload metadata"""
    description: Optional[str] = None


class AttachmentResponse(BaseModel):
    """Schema for attachment response"""
    id: int
    assignment_id: int
    uploaded_by: Optional[int]
    uploader_name: Optional[str]
    file_name: str
    file_path: str
    file_type: AttachmentType
    file_size: Optional[int]
    thumbnail_url: Optional[str]
    description: Optional[str]
    uploaded_at: datetime

    class Config:
        from_attributes = True
