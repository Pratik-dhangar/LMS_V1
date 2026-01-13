"""
Authentication API Endpoints
Handles user authentication for all roles (admin, head, trainer, consultant)
Validates credentials and issues JWT tokens for authenticated users
"""

import logging
import os
import time
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
    login_start_time = time.time()
    logger.info(f"[LOGIN_START] Login attempt initiated - Role: {credentials.role}, Passcode: {credentials.passcode[:3]}***")

    try:
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
        logger.info(f"[DB_QUERY_START] Querying User table for role={role_lower}")
        db_query_start = time.time()
        
        # All authentication now goes through the centralized User table
        user = await user_crud.get_user_by_passcode_and_role(db, credentials.passcode, role_lower)
        
        db_query_duration = time.time() - db_query_start
        logger.info(f"[DB_QUERY_END] Database query completed in {db_query_duration:.3f}s. User found: {user is not None}")

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

        logger.info(f"[TOKEN_CREATE_START] Creating token for user ID: {user_id}, role: {credentials.role}")
        token_start = time.time()
        
        access_token = create_access_token(
            data={"sub": str(user_id), "role": credentials.role},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        
        token_duration = time.time() - token_start
        logger.info(f"[TOKEN_CREATE_END] Token created in {token_duration:.3f}s")

        total_duration = time.time() - login_start_time
        logger.info(f"[LOGIN_SUCCESS] Successful login - User: {user_name}, Role: {credentials.role}, Total time: {total_duration:.3f}s")
        metrics_collector.record_auth_attempt(success=True)

        return Token(
            access_token=access_token,
            token_type="bearer",
            role=credentials.role,
            user_id=user_id,
            name=user_name,
        )
    except HTTPException:
        raise
    except Exception as e:
        total_duration = time.time() - login_start_time
        logger.error(f"[LOGIN_ERROR] Unexpected error during login: {str(e)}, Duration: {total_duration:.3f}s", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during login. Please try again."
        )
