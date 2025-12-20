"""SQLAlchemy ORM Model for Program-Learning Content Junction Table
Links learning programs (goals) to learning contents with ordering
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.db.session import Base


class ProgramLearningContent(Base):
    """Junction table linking Learning Programs (Goals) to Learning Contents"""
    __tablename__ = "program_learning_contents"

    id = Column(Integer, primary_key=True, index=True)
    program_id = Column(
        Integer,
        ForeignKey("learning_goals.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    content_id = Column(
        Integer,
        ForeignKey("learning_contents.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    sequence_order = Column(Integer, nullable=False, default=0)  # For ordering contents
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    program = relationship("LearningGoals", backref="program_contents")
    content = relationship("LearningContent", backref="content_programs")
