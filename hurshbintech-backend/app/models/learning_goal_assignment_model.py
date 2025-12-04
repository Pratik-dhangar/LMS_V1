from sqlalchemy import Column, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import relationship

from app.db.session import Base


class LearningGoalAssignment(Base):
    __tablename__ = "learning_goal_assignments"

    id = Column(Integer, primary_key=True, index=True)
    learner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    learning_goal_id = Column(Integer, ForeignKey("learning_goals.id"))
    assigned_by_head = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    goal = relationship("LearningGoals")
    # relationships to users rely on DB cascades
