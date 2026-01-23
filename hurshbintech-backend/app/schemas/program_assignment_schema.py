"""Pydantic schemas for Program Assignment"""

from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models.program_assignment_model import CompletionStatus
from app.models.program_assignment_attachment_model import AttachmentType
from app.models.learner_content_assignment_model import ContentCompletionStatus


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


class LearningContentBasic(BaseModel):
    """Basic learning content info"""
    id: int
    title: str
    description: Optional[str]
    content_type: str
    file_url: Optional[str] = None
    thumbnail_url: Optional[str] = None

    class Config:
        from_attributes = True


class ContentAssignmentInProgram(BaseModel):
    """Schema for content assignment within a program assignment"""
    id: int
    content_id: int
    learning_content: LearningContentBasic
    completion_status: ContentCompletionStatus
    assigned_at: datetime
    started_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by_head: Optional[int] = None

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
    program_ids: List[int] = Field(..., min_length=1, description="List of program IDs to assign under this title")
    assignment_title: str = Field(..., min_length=1, description="Title for this program assignment")
    start_date: date
    end_date: date
    duration_days: Optional[int] = None
    head_notes: Optional[str] = None
    extra_content_ids: Optional[List[int]] = Field(default=None, description="Additional learning content IDs to assign")


class ProgramAssignmentUpdate(BaseModel):
    """Schema for updating a program assignment (Head)"""
    assignment_title: Optional[str] = None
    program_ids: Optional[List[int]] = None
    extra_content_ids: Optional[List[int]] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    duration_days: Optional[int] = None
    head_notes: Optional[str] = None
    completion_status: Optional[CompletionStatus] = None


class LearnerAssignmentUpdate(BaseModel):
    """Schema for updating assignment (Learner - restricted)"""
    learner_notes: Optional[str] = None
    completion_status: Optional[CompletionStatus] = None


class FinalFeedbackSubmit(BaseModel):
    """Schema for Head to submit final feedback on program assignment"""
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5 stars")
    remarks: Optional[str] = Field(None, description="Optional feedback remarks")
    completion_status: Optional[str] = Field(None, description="Update program assignment status: NOT_STARTED, IN_PROGRESS, or COMPLETED")


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
    program_ids: List[int]  # Changed from program_id to program_ids
    program_names: List[str] = []  # NEW: List of program goal names
    program: ProgramWithContents  # Keep for backward compatibility - contains first program
    assignment_title: str
    assigned_by_head: Optional[int]
    assigned_by: Optional[UserBasic]
    start_date: date
    end_date: date
    duration_days: Optional[int]
    head_notes: Optional[str]
    learner_notes: Optional[str]
    completion_status: CompletionStatus
    completed_at: Optional[datetime]
    final_feedback_rating: Optional[int] = None
    final_feedback_remarks: Optional[str] = None
    final_feedback_given_at: Optional[datetime] = None
    notification_sent: bool
    assigned_at: datetime
    updated_at: datetime
    is_overdue: bool = False
    is_late_submission: bool = False
    content_assignments: List[ContentAssignmentInProgram] = []  # All content assignments
    extra_content_ids: List[int] = []  # NEW: Extract content IDs from content_assignments

    class Config:
        from_attributes = True


class ProgramAssignmentListResponse(BaseModel):
    """Simplified schema for assignment list"""
    id: int
    learner_id: int
    learner_name: str
    program_ids: List[int]  # Changed from program_id to program_ids
    program_id: Optional[int] = None  # Keep for backward compatibility
    program_name: str
    program_names: List[str] = []  # NEW: List of program goal names
    assignment_title: str
    start_date: date
    end_date: date
    duration_days: Optional[int]
    completion_status: CompletionStatus
    completed_at: Optional[datetime]
    assigned_at: datetime
    is_overdue: bool = False
    is_late_submission: bool = False
    completion_percentage: float = 0.0
    final_feedback_rating: Optional[int] = None
    final_feedback_remarks: Optional[str] = None
    final_feedback_given_at: Optional[datetime] = None
    content_assignments: Optional[List[ContentAssignmentInProgram]] = []

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


# ============= Content Assignment Status Schemas =============

class ContentStatusUpdate(BaseModel):
    """Schema for updating content assignment status"""
    status: ContentCompletionStatus


class HeadFeedbackSubmit(BaseModel):
    """Schema for head to submit feedback on content assignment"""
    feedback_text: Optional[str] = None
    rating: int = Field(..., ge=1, le=5, description="Star rating from 1 to 5")


class FeedbackHistoryItem(BaseModel):
    """Schema for a single feedback history entry"""
    feedback_text: Optional[str] = None
    rating: int
    feedback_given_at: datetime
    updated_at: datetime


class ContentAssignmentWithFeedback(BaseModel):
    """Schema for content assignment with feedback details"""
    id: int
    content_id: int
    learning_content: Optional[LearningContentBasic]
    completion_status: ContentCompletionStatus
    assigned_at: datetime
    started_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by_head: Optional[int] = None
    head_feedback_text: Optional[str] = None
    head_rating: Optional[int] = None
    feedback_given_at: Optional[datetime] = None
    feedback_history: Optional[List[FeedbackHistoryItem]] = []
    resubmit_allowed: bool = True

    class Config:
        from_attributes = True


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
