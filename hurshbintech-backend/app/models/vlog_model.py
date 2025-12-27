import enum
from sqlalchemy import Column, DateTime, Enum as SAEnum, Float, Integer, String
from sqlalchemy.sql import func

from app.db.session import Base


class VlogStatus(enum.Enum):
    draft = "draft"
    published = "published"


class Vlog(Base):
    __tablename__ = "vlogs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=True)
    file_url = Column(String(255), nullable=False)
    file_size = Column(Float, nullable=False)  # Size in MB
    thumbnail_url = Column(String(255), nullable=True)
    status = Column(SAEnum(VlogStatus, values_callable=lambda obj: [e.value for e in obj]), default=VlogStatus.draft, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
