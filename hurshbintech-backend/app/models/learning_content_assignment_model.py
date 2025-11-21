from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.session import Base

class LearningContentAssignment(Base):
    __tablename__ = "learning_content_assignments"

    id = Column(Integer, primary_key=True, index=True)
    learner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    learning_content_id = Column(Integer, ForeignKey("learning_contents.id"), nullable=False, index=True)
    assigned_by_head = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    learner = relationship("User", foreign_keys=[learner_id])
    learning_content = relationship("LearningContent")
    assigned_by = relationship("User", foreign_keys=[assigned_by_head])
