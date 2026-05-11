import enum
from sqlalchemy import Column, DateTime, Enum as SAEnum, Float, Integer, String, Text
from sqlalchemy.sql import func

from app.db.session import Base


class GalleryPhotoStatus(enum.Enum):
    draft = "draft"
    published = "published"


class Gallery(Base):
    __tablename__ = "gallery"

    id = Column(Integer, primary_key=True, index=True)
    # Title and description removed per new requirements (only image stored)
    photo_url = Column(String(255), nullable=False)
    photo_size = Column(Float, nullable=False)  # Size in MB
    thumbnail_url = Column(String(255), nullable=True)
    status = Column(
        SAEnum(
            GalleryPhotoStatus,
            name="galleryphoto_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=GalleryPhotoStatus.draft,
        nullable=False,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
