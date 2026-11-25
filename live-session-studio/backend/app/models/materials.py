"""Material upload metadata."""
import uuid
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, BigInteger
from sqlalchemy.sql import func
from app.db.session import Base


class Material(Base):
    __tablename__ = "materials"

    id = Column(Integer, primary_key=True, index=True)
    trainer_id = Column(Integer, ForeignKey("demo_profiles.id"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    # file type: image | video | pdf | audio | youtube
    content_type = Column(String(50), nullable=False)
    # Canonical storage key (relative path under UPLOADS_DIR/materials/)
    file_key = Column(String(500), nullable=True)
    # For YouTube: external URL
    external_url = Column(String(1000), nullable=True)
    # Original filename for display
    original_filename = Column(String(500), nullable=True)
    # MIME type
    mime_type = Column(String(100), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    # Width/height for images/videos
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<Material id={self.id} title={self.title} type={self.content_type}>"
