from datetime import datetime

from pydantic import BaseModel


class LearningContentAssignmentCreate(BaseModel):
    learner_id: int
    learning_content_id: int


class LearningContentAssignmentResponse(BaseModel):
    id: int
    learner_id: int
    learner_name: str
    learning_content_id: int
    content_title: str
    content_type: str
    file_url: str
    assigned_by_head: int
    assigned_by_name: str
    assigned_at: datetime

    class Config:
        from_attributes = True


class LearnerResponse(BaseModel):
    id: int
    name: str


class ContentResponse(BaseModel):
    id: int
    title: str
    content_type: str
    file_url: str
