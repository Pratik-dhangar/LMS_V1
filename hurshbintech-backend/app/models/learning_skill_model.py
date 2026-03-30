from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.session import Base


class LearningSkill(Base):
    __tablename__ = "learning_skills"

    id = Column(Integer, primary_key=True, index=True)
    skill_name = Column(String(255), nullable=False, unique=True, index=True)

    created_by_admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    created_by = relationship("User", foreign_keys=[created_by_admin_id])
