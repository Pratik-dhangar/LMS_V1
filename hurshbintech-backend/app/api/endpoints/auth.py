"""
Authentication API Endpoints
Handles user authentication for all roles (admin, head, trainer, consultant)
Validates credentials and issues JWT tokens for authenticated users
"""

import logging
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.auth import UserLogin, Token
from app.core.security import create_access_token, verify_password
from app.core.config import settings
from app.crud import user_crud

# Get logger for this module
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/user/login", response_model=Token)
async def user_login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):

    logger.debug(f"Login attempt - Role: {credentials.role}")

    role_lower = credentials.role.lower()

    # Validate role
    valid_roles = ["admin", "head", "trainer", "consultant", "learner"]
    if role_lower not in valid_roles:
        logger.warning(f"Invalid role in login attempt: {role_lower}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be 'admin', 'head', 'trainer', 'consultant' or 'learner'"
        )

    # Query User table by passcode and role
    # All authentication now goes through the centralized User table
    logger.debug(f"Attempting {role_lower} login via User table")
    user = await user_crud.get_user_by_passcode_and_role(db, credentials.passcode, role_lower)
    
    # Verify user exists and passcode matches
    if not user or not verify_password(credentials.passcode, user.passcode):
        logger.warning(f"Failed login attempt for role: {role_lower}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect role or passcode"
        )

    # Verify user is active
    if not user.is_active:
        logger.warning(f"Inactive user login attempt: {user.id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive"
        )

    # Create access token
    user_id = user.id
    user_name = user.name
    
    logger.debug(f"Creating token for user ID: {user_id}, role: {credentials.role}")
    access_token = create_access_token(
        data={"sub": str(user_id), "role": credentials.role},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    logger.info(f"Successful login - User: {user_name}, Role: {credentials.role}")
    return Token(
        access_token=access_token,
        token_type="bearer",
        role=credentials.role,
        user_id=user_id,
        name=user_name
    )
