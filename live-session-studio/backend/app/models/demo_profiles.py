"""Demo profiles - seeded identities for the standalone studio."""
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.db.session import Base


class DemoProfile(Base):
    __tablename__ = "demo_profiles"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(20), nullable=False, index=True)   # "trainer" | "learner"
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<DemoProfile id={self.id} role={self.role} name={self.name}>"
