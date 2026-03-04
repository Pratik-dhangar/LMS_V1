"""
Learner Progress Report Schemas - Pydantic models for validation
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class LearnerProgressReportCreate(BaseModel):
    """Schema for creating a new learner progress report"""

    learner_id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=255)
    date_of_birth: Optional[date] = None
    date_of_report: date
    birth_history: Optional[str] = None
    development_history: Optional[str] = None
    learning_history: Optional[str] = None

    # Functional Development Overview through overall development
    attention_cooperation: Optional[str] = None
    sensory_integration_motor: Optional[str] = None
    speech_language_communication: Optional[str] = None
    play_leisure: Optional[str] = None
    social_interaction_group: Optional[str] = None
    emotional_regulation: Optional[str] = None
    independent_living: Optional[str] = None
    academic_readiness: Optional[str] = None
    professional_development: Optional[str] = None

    # Summary
    intervention_plan: Optional[str] = None
    recommendation: Optional[str] = None
    conclusion: Optional[str] = None
    report_created_by: Optional[str] = None
    digital_signature: Optional[str] = None


class LearnerProgressReportUpdate(BaseModel):
    """Schema for updating an existing report"""

    name: Optional[str] = None
    date_of_birth: Optional[date] = None
    date_of_report: Optional[date] = None
    birth_history: Optional[str] = None
    development_history: Optional[str] = None
    learning_history: Optional[str] = None

    attention_cooperation: Optional[str] = None
    sensory_integration_motor: Optional[str] = None
    speech_language_communication: Optional[str] = None
    play_leisure: Optional[str] = None
    social_interaction_group: Optional[str] = None
    emotional_regulation: Optional[str] = None
    independent_living: Optional[str] = None
    academic_readiness: Optional[str] = None
    professional_development: Optional[str] = None

    intervention_plan: Optional[str] = None
    recommendation: Optional[str] = None
    conclusion: Optional[str] = None
    report_created_by: Optional[str] = None
    digital_signature: Optional[str] = None


class LearnerProgressReportResponse(BaseModel):
    """Schema for report response"""

    id: int
    learner_id: Optional[int]
    name: str
    date_of_birth: Optional[date]
    date_of_report: date
    birth_history: Optional[str]
    development_history: Optional[str]
    learning_history: Optional[str]

    attention_cooperation: Optional[str]
    sensory_integration_motor: Optional[str]
    speech_language_communication: Optional[str]
    play_leisure: Optional[str]
    social_interaction_group: Optional[str]
    emotional_regulation: Optional[str]
    independent_living: Optional[str]
    academic_readiness: Optional[str]
    professional_development: Optional[str]

    intervention_plan: Optional[str]
    recommendation: Optional[str]
    conclusion: Optional[str]
    report_created_by: Optional[str]
    digital_signature: Optional[str]

    # S3 PDF URL (None on local dev, populated on deploy)
    pdf_url: Optional[str] = None

    created_by_id: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
