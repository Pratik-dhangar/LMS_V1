from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.session import Base


class LearningGoals(Base):
    __tablename__ = "learning_goals"

    id = Column(Integer, primary_key=True, index=True)
    goal = Column(String(255), nullable=False, index=True)
    goal_description = Column(Text, nullable=True)
    delivery_instruction = Column(Text, nullable=True)

    # Metadata
    created_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_admin_id])
    updated_by = relationship("User", foreign_keys=[updated_by_id])
