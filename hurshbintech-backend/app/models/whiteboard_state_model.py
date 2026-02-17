"""
Whiteboard State Model - For persisting whiteboard canvas state across reconnections
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class WhiteboardState(Base):
    """Stores whiteboard canvas state for session persistence across reconnections"""

    __tablename__ = "whiteboard_states"

    id = Column(Integer, primary_key=True, index=True)
    
    # Link to training session
    session_id = Column(
        String(100),
        ForeignKey("training_sessions.session_id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # State type: 'drawing' for pen strokes, 'item' for canvas items (images, text, buckets, etc.)
    state_type = Column(String(20), nullable=False)
    
    # Unique identifier for this state entry (e.g., drawing stroke ID, canvas item ID)
    item_id = Column(String(100), nullable=False, index=True)
    
    # JSONB storage for flexible data structure
    # For 'drawing': {segments: [...], strokeNorm: float, color: string, tool: string, timestamp: int}
    # For 'item': {type: string, src: string, x: float, y: float, width: float, height: float, ...}
    data = Column(JSONB, nullable=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Soft delete flag - when items are deleted or canvas is cleared, mark inactive instead of hard delete
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    
    # Relationship to training session
    training_session = relationship(
        "TrainingSession",
        foreign_keys=[session_id],
        primaryjoin="WhiteboardState.session_id == TrainingSession.session_id"
    )
    
    # Composite index for efficient queries
    __table_args__ = (
        Index('ix_whiteboard_session_active', 'session_id', 'is_active'),
        Index('ix_whiteboard_session_type', 'session_id', 'state_type', 'is_active'),
    )
    
    def __repr__(self):
        return f"<WhiteboardState(id={self.id}, session_id={self.session_id}, type={self.state_type}, item_id={self.item_id}, active={self.is_active})>"
