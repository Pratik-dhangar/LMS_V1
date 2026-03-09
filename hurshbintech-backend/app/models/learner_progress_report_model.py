"""
Learner Progress Report Model - Comprehensive developmental assessment report
"""

from datetime import date, datetime, timezone

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import relationship

from app.db.session import Base


class LearnerProgressReport(Base):
    """
    Stores comprehensive developmental progress reports for learners.
    Covers 9 areas of development + metadata fields (Head).
    Coach uses dynamic Q&A pairs stored in coach_qna_data.
    """

    __tablename__ = "learner_progress_reports"

    id = Column(Integer, primary_key=True, index=True)

    # Learner reference (optional - report can exist independently)
    learner_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Report type: "head" (9 fixed fields) or "coach" (dynamic Q&A)
    report_type = Column(String(50), default="head", nullable=False)

    # Basic info
    name = Column(String(255), nullable=False)
    referred_by = Column(String(255), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    date_of_report = Column(Date, nullable=False)
    birth_history = Column(Text, nullable=True)
    development_history = Column(Text, nullable=True)
    learning_history = Column(Text, nullable=True)

    # Functional Development Overview through overall development (HEAD only)
    attention_cooperation = Column(Text, nullable=True)
    sensory_integration_motor = Column(Text, nullable=True)
    speech_language_communication = Column(Text, nullable=True)
    play_leisure = Column(Text, nullable=True)
    social_interaction_group = Column(Text, nullable=True)
    emotional_regulation = Column(Text, nullable=True)
    independent_living = Column(Text, nullable=True)
    academic_readiness = Column(Text, nullable=True)
    professional_development = Column(Text, nullable=True)

    # Summary fields
    intervention_plan = Column(Text, nullable=True)
    recommendation = Column(Text, nullable=True)
    conclusion = Column(Text, nullable=True)
    report_created_by = Column(String(255), nullable=True)
    digital_signature = Column(String(1024), nullable=True)

    # Coach-specific: Dynamic Q&A pairs stored as JSON
    # Format: [{"number": "1", "answer": "..."}, {"number": "2", "answer": "..."}, ...]
    coach_qna_data = Column(JSON, nullable=True, default=list)

    # S3 PDF storage (populated on deploy when USE_S3=true)
    pdf_url = Column(String(1024), nullable=True)

    # Created by user (coach/head)
    created_by_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Timestamps
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )

    # Relationships
    learner = relationship("User", foreign_keys=[learner_id], backref="progress_reports")
    created_by = relationship("User", foreign_keys=[created_by_id])
