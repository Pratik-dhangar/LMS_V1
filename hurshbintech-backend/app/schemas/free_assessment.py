"""Pydantic schemas for free assessment submissions."""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class FreeAssessmentCreate(BaseModel):
    child_name: str = Field(..., min_length=2, max_length=255)
    child_age: Optional[str] = Field(None, max_length=50)
    date_of_assessment: Optional[date] = None

    mother_name: Optional[str] = Field(None, max_length=255)
    mother_age: Optional[str] = Field(None, max_length=50)
    mother_education: Optional[str] = Field(None, max_length=255)
    mother_profession: Optional[str] = Field(None, max_length=255)
    mother_contact: Optional[str] = Field(None, max_length=30)
    mother_email: Optional[str] = Field(None, max_length=255)

    father_name: Optional[str] = Field(None, max_length=255)
    father_age: Optional[str] = Field(None, max_length=50)
    father_education: Optional[str] = Field(None, max_length=255)
    father_profession: Optional[str] = Field(None, max_length=255)
    father_contact: Optional[str] = Field(None, max_length=30)
    father_email: Optional[str] = Field(None, max_length=255)

    address: Optional[str] = None
    siblings: Optional[str] = Field(None, max_length=255)
    sibling_age: Optional[str] = Field(None, max_length=50)

    selected_disorders: list[str] = Field(default_factory=list)

    medical_baby_scream: Optional[str] = None
    medical_difficult_sleep: Optional[str] = None
    medical_routine_change: Optional[str] = None
    medical_food_habit_shift: Optional[str] = None
    medical_physical_milestones: Optional[str] = None
    medical_language_milestones: Optional[str] = None
    medical_major_illness: Optional[str] = None
    medical_specific_details: Optional[str] = None

    learning_school_years: Optional[str] = Field(None, max_length=100)
    learning_support: Optional[str] = None
    learning_current_grade: Optional[str] = Field(None, max_length=100)
    learning_scenario: Optional[str] = None

    intervention_history: Optional[str] = None
    skills: dict[str, str] = Field(default_factory=dict)


class FreeAssessmentResponse(FreeAssessmentCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FreeAssessmentListResponse(BaseModel):
    data: list[FreeAssessmentResponse]
    total: int
    skip: int
    limit: int
