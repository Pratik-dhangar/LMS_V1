"""
Session Report Schemas - Pydantic models for validation
"""

from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class SessionReportCreate(BaseModel):
    """Schema for creating a new session report"""

    session_id: int
    learner_id: int
    program_id: Optional[int] = None
    program_name: str = Field(..., min_length=1, max_length=500)
    prompt_meter: Literal["I", "10", "20", "30", "40", "50", "60", "70", "80", "90"]
    reinforcement_meter: Literal["Full", "90", "80", "70", "60", "50", "40", "30", "20", "10"]


class SessionReportResponse(BaseModel):
    """Schema for session report response"""

    id: int
    session_id: int
    learner_id: int
    program_id: Optional[int]
    program_name: str
    prompt_meter: str
    reinforcement_meter: str
    created_at: datetime
    session_started_at: Optional[datetime] = None
    session_goals: List[str] = []

    class Config:
        from_attributes = True


class SessionReportGrouped(BaseModel):
    """Schema for grouped session reports by program"""

    program_name: str
    program_id: Optional[int]
    reports: List[SessionReportResponse]
    total_records: int


class LearnerReportSummary(BaseModel):
    """Schema for learner report summary"""

    learner_id: int
    learner_name: str
    iip_id: Optional[str]
    total_sessions: int
    total_reports: int
    last_session_date: Optional[datetime]
    programs_covered: List[str]


class SessionReportStatistics(BaseModel):
    """Schema for session report statistics (for charts)"""

    prompt_distribution: Dict[str, int]  # {'I': 5, '10': 3, '20': 8, ...}
    reinforcement_distribution: Dict[str, int]  # {'Full': 2, '90': 5, ...}
    total_reports: int
    program_breakdown: Dict[str, int]  # {'Program A': 10, 'Program B': 5, ...}
