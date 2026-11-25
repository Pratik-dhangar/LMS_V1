"""Room membership / invitation model."""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.db.session import Base


class RoomMembership(Base):
    """Tracks invitation and admission lifecycle for a learner in a room."""
    __tablename__ = "room_memberships"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    learner_id = Column(Integer, ForeignKey("demo_profiles.id"), nullable=False, index=True)
    # invited | join_requested | admitted | rejected | left | closed
    state = Column(String(30), nullable=False, default="invited", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Only one active membership record per room/learner pair
    __table_args__ = (
        UniqueConstraint("room_id", "learner_id", name="uq_room_learner"),
    )

    def __repr__(self):
        return f"<RoomMembership room={self.room_id} learner={self.learner_id} state={self.state}>"
