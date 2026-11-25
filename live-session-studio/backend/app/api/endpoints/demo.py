"""
Demo login and profile endpoints.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.demo_profiles import DemoProfile

router = APIRouter()
logger = logging.getLogger(__name__)


class LoginRequest(BaseModel):
    role: str
    profile_id: int


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


def _create_token(user_id: int, role: str, name: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "role": role,
        "name": name,
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


@router.get("/profiles")
async def list_profiles(role: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """List demo profiles, optionally filtered by role. Public endpoint."""
    stmt = select(DemoProfile).order_by(DemoProfile.id)
    if role:
        stmt = stmt.where(DemoProfile.role == role)
    result = await db.execute(stmt)
    profiles = result.scalars().all()
    return [{"id": p.id, "role": p.role, "name": p.name} for p in profiles]


@router.post("/login", response_model=LoginResponse)
async def demo_login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Passwordless demo login. Validates profile ID matches the claimed role."""
    result = await db.execute(
        select(DemoProfile).where(DemoProfile.id == body.profile_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown profile")
    if profile.role != body.role:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Role mismatch")

    token = _create_token(profile.id, profile.role, profile.name)
    return LoginResponse(
        access_token=token,
        user={"id": profile.id, "role": profile.role, "name": profile.name},
    )
