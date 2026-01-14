"""SQLAlchemy ORM Model for Assigned Training
Tracks admin-created role-targeted training assignments for Internal Training and Assigned Learning cards
"""

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, JSON, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.session import Base


class AssignedTraining(Base):
    """Tracks admin-created role-targeted training assignments
    Admin creates these to assign trainings to specific roles (Admin, Head, Coach, Trainer, Learner, or All)
    Users of matching roles will see these as "Assigned Learning" cards
    """
    __tablename__ = "assigned_trainings"

    id = Column(Integer, primary_key=True, index=True)
    
    # Training content
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    custom_content = Column(Text, nullable=True)  # HTML/rich text content for custom trainings
    
    # Featured image URL (local or S3)
    featured_image_url = Column(String(500), nullable=True)
    
    # Training files metadata
    # Stored as JSON array: [{"name": "file.pdf", "url": "/uploads/...", "size": 1024, "type": "pdf"}, ...]
    training_files = Column(JSON, nullable=True, default=list)
    
    # Folder path for training files (local or S3 prefix)
    training_folder = Column(String(255), nullable=True)
    
    # References to existing training content (optional)
    # Stored as JSON array of IDs: [id1, id2, ...]
    training_ref_ids = Column(JSON, nullable=True, default=list)
    
    # Target roles: JSON array of lowercase role strings
    # e.g., ["all"], ["admin", "head"], ["learner"], etc.
    # "all" means visible to all authenticated users
    target_roles = Column(JSON, nullable=False, default=list)
    
    # Admin who created this assignment
    assigned_by_admin = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    
    # Status
    active = Column(Boolean, default=True, nullable=False, index=True)
    
    # Optional custom metadata (for future extensions)
    custom_metadata = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    assigned_by = relationship("User", foreign_keys=[assigned_by_admin])
    user_assignments = relationship(
        "AssignedTrainingUser",
        back_populates="assigned_training",
        cascade="all, delete-orphan"
    )


class AssignedTrainingUser(Base):
    """Tracks per-user progress on assigned trainings
    Created lazily when a user first interacts with an assigned training
    """
    __tablename__ = "assigned_training_users"

    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign Keys
    assigned_training_id = Column(
        Integer,
        ForeignKey("assigned_trainings.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Status tracking
    status = Column(
        String(50),  # Store as string: "NEW", "IN_PROGRESS", "COMPLETED"
        nullable=False,
        default="NEW",
        index=True
    )
    progress = Column(JSON, nullable=True)  # e.g., {percent: 50, last_seen: timestamp}
    
    # Timestamps for user activity
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Optional evidence/notes for completion
    evidence = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    assigned_training = relationship("AssignedTraining", back_populates="user_assignments")
    user = relationship("User", backref="assigned_trainings")
    
    __table_args__ = (
        UniqueConstraint('assigned_training_id', 'user_id', name='unique_training_user'),
    )
