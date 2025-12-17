"""
Authentication API Endpoints
Handles user authentication for all roles (admin, head, trainer, consultant)
Validates credentials and issues JWT tokens for authenticated users
"""

import logging
import os
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.metrics import metrics_collector
from app.core.security import create_access_token
from app.crud import user_crud
from app.db.session import get_db
from app.schemas.auth import Token, UserLogin

# Get logger for this module
logger = logging.getLogger(__name__)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# Conditionally apply rate limiting
def apply_rate_limit():
    def decorator(func):
        if os.getenv("TESTING"):
            return func
        return limiter.limit("5/minute")(func)

    return decorator


@router.post("/user/login", response_model=Token)
@apply_rate_limit()
async def user_login(request: Request, credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    logger.debug(f"Login attempt - Role: {credentials.role}")

    role_lower = credentials.role.lower()

    # Validate role
    valid_roles = ["admin", "head", "trainer", "coach", "learner"]
    if role_lower not in valid_roles:
        logger.warning(f"Invalid role in login attempt: {role_lower}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be 'admin', 'head', 'trainer', 'coach' or 'learner'",
        )

    # Query User table by passcode and role
    # All authentication now goes through the centralized User table
    logger.debug(f"Attempting {role_lower} login via User table")
    user = await user_crud.get_user_by_passcode_and_role(db, credentials.passcode, role_lower)

    # Verify user exists (password verification done in CRUD function)
    if not user:
        logger.warning(f"Failed login attempt for role: {role_lower}")
        metrics_collector.record_auth_attempt(success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect role or passcode"
        )

    # Verify user is active
    if not user.is_active:
        logger.warning(f"Inactive user login attempt: {user.id}")
        metrics_collector.record_auth_attempt(success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User account is inactive"
        )

    # Create access token
    user_id = user.id
    user_name = user.name

    logger.debug(f"Creating token for user ID: {user_id}, role: {credentials.role}")
    access_token = create_access_token(
        data={"sub": str(user_id), "role": credentials.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    logger.info(f"Successful login - User: {user_name}, Role: {credentials.role}")
    metrics_collector.record_auth_attempt(success=True)

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=credentials.role,
        user_id=user_id,
        name=user_name,
    )
