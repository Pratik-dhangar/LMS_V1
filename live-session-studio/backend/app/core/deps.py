"""
Demo token / current-profile / room-ownership dependencies.
No LMS roles, subscriptions, or business models.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db

bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    """Validate demo JWT and return user payload."""
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise exc
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        user_id: int = payload.get("sub")
        role: str = payload.get("role")
        if user_id is None or role is None:
            raise exc
        return {"id": int(user_id), "role": role, "name": payload.get("name", "")}
    except JWTError:
        raise exc


async def require_trainer(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "trainer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Trainer role required")
    return user


async def require_learner(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] != "learner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Learner role required")
    return user
