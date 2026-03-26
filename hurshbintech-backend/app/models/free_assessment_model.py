"""SQLAlchemy model for public free assessment submissions."""

from sqlalchemy import Column, Date, DateTime, Integer, JSON, String, Text
from sqlalchemy.sql import func

from app.db.session import Base


class FreeAssessment(Base):
    __tablename__ = "free_assessments"

    id = Column(Integer, primary_key=True, index=True)

    child_name = Column(String(255), nullable=False, index=True)
    child_age = Column(String(50), nullable=True)
    date_of_assessment = Column(Date, nullable=True)

    mother_name = Column(String(255), nullable=True)
    mother_age = Column(String(50), nullable=True)
    mother_education = Column(String(255), nullable=True)
    mother_profession = Column(String(255), nullable=True)
    mother_contact = Column(String(30), nullable=True, index=True)
    mother_email = Column(String(255), nullable=True)

    father_name = Column(String(255), nullable=True)
    father_age = Column(String(50), nullable=True)
    father_education = Column(String(255), nullable=True)
    father_profession = Column(String(255), nullable=True)
    father_contact = Column(String(30), nullable=True, index=True)
    father_email = Column(String(255), nullable=True)

    address = Column(Text, nullable=True)
    siblings = Column(String(255), nullable=True)
    sibling_age = Column(String(50), nullable=True)

    selected_disorders = Column(JSON, nullable=False, default=list)

    medical_baby_scream = Column(Text, nullable=True)
    medical_difficult_sleep = Column(Text, nullable=True)
    medical_routine_change = Column(Text, nullable=True)
    medical_food_habit_shift = Column(Text, nullable=True)
    medical_physical_milestones = Column(Text, nullable=True)
    medical_language_milestones = Column(Text, nullable=True)
    medical_major_illness = Column(Text, nullable=True)
    medical_specific_details = Column(Text, nullable=True)

    learning_school_years = Column(String(100), nullable=True)
    learning_support = Column(Text, nullable=True)
    learning_current_grade = Column(String(100), nullable=True)
    learning_scenario = Column(Text, nullable=True)

    intervention_history = Column(Text, nullable=True)
    skills = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
