"""SQLAlchemy model for public free appointment submissions."""

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.db.session import Base


class FreeAppointment(Base):
    __tablename__ = "free_appointments"

    id = Column(Integer, primary_key=True, index=True)

    child_name = Column(String(255), nullable=False, index=True)
    age = Column(Integer, nullable=False)
    concerns = Column(Text, nullable=True)
    diagnosis = Column(Text, nullable=True)
    address = Column(Text, nullable=True)
    contact_number = Column(String(20), nullable=False, index=True)
    reference_by = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
