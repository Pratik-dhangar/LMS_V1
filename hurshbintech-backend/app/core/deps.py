"""
Authentication dependencies for protected routes
Validates JWT tokens and returns authenticated users
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from fastapi.security.http import HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user_model import (
    HeadProfile,
    LearnerProfile,
    TrainerProfile,
    User,
    UserRole,
)

# HTTP Bearer token scheme for JWT authentication
security = HTTPBearer()


async def get_current_admin_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Get current authenticated admin from JWT token
    Used in admin-only routes - Returns User object
    """
    try:
        # Decode JWT token
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        role = payload.get("role")

        # Convert user_id to int if it's a string
        if isinstance(user_id, str):
            user_id = int(user_id)

        # Verify role is admin
        if role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized as admin"
            )

        # Get admin from users table
        result = await db.execute(
            select(User).where(User.id == user_id, User.role == UserRole.ADMIN)
        )
        admin = result.scalar_one_or_none()

        if admin is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")

        return admin

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Authentication error: {str(e)}"
        )


async def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Get current authenticated admin from JWT token
    Used in admin-only routes
    """
    try:
        # Decode JWT token
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        role = payload.get("role")

        # Convert user_id to int if it's a string
        if isinstance(user_id, str):
            user_id = int(user_id)

        # Verify role is admin
        if role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized as admin"
            )

        # Get admin from users table
        result = await db.execute(
            select(User).where(User.id == user_id, User.role == UserRole.ADMIN)
        )
        admin = result.scalar_one_or_none()

        if admin is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")

        return admin

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Authentication error: {str(e)}"
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """Get current authenticated user with profile based on role"""
    try:
        # Decode JWT token
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        role = payload.get("role")

        # Convert user_id to int if it's a string
        if isinstance(user_id, str):
            user_id = int(user_id)

        # Query based on role - load User with appropriate profile
        if role == "head":
            result = await db.execute(
                select(User)
                .options(joinedload(User.head_profile))
                .where(User.id == user_id, User.role == UserRole.HEAD)
            )
            user = result.scalar_one_or_none()
        elif role == "trainer":
            result = await db.execute(
                select(User)
                .options(joinedload(User.trainer_profile))
                .where(User.id == user_id, User.role == UserRole.TRAINER)
            )
            user = result.scalar_one_or_none()
        elif role == "consultant":
            result = await db.execute(
                select(User)
                .options(joinedload(User.consultant_profile))
                .where(User.id == user_id, User.role == UserRole.CONSULTANT)
            )
            user = result.scalar_one_or_none()
        elif role == "learner":
            result = await db.execute(
                select(User)
                .options(joinedload(User.learner_profile))
                .where(User.id == user_id, User.role == UserRole.LEARNER)
            )
            user = result.scalar_one_or_none()
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid role")

        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        return user

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials"
        )


async def get_current_head(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> HeadProfile:
    """
    Get current authenticated head profile from JWT token
    Used in head-only routes
    """
    try:
        # Decode JWT token
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        role = payload.get("role")

        # Convert user_id to int if it's a string
        if isinstance(user_id, str):
            user_id = int(user_id)

        # Verify role is head
        if role != "head":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized as head"
            )

        # Get head profile from database via User with joinedload for user data
        # Explicitly specify join condition to avoid ambiguous foreign key error
        result = await db.execute(
            select(HeadProfile)
            .options(joinedload(HeadProfile.user))
            .join(User, HeadProfile.user_id == User.id)
            .where(User.id == user_id, User.role == UserRole.HEAD)
        )
        head = result.scalar_one_or_none()

        if head is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Head profile not found"
            )

        return head

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials"
        )


async def get_current_trainer(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> TrainerProfile:
    """
    Get current authenticated trainer profile from JWT token
    Used in trainer-only routes
    """
    try:
        # Decode JWT token
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        role = payload.get("role")

        # Convert user_id to int if it's a string
        if isinstance(user_id, str):
            user_id = int(user_id)

        # Verify role is trainer
        if role != "trainer":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized as trainer"
            )

        # Get trainer profile from database
        result = await db.execute(
            select(TrainerProfile)
            .options(joinedload(TrainerProfile.user))
            .join(User, TrainerProfile.user_id == User.id)
            .where(User.id == user_id, User.role == UserRole.TRAINER)
        )
        trainer = result.scalar_one_or_none()

        if trainer is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Trainer profile not found"
            )

        return trainer

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials"
        )


async def get_current_learner(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> LearnerProfile:
    """
    Get current authenticated learner profile from JWT token
    Used in learner-only routes
    """
    try:
        # Decode JWT token
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        role = payload.get("role")

        # Convert user_id to int if it's a string
        if isinstance(user_id, str):
            user_id = int(user_id)

        # Verify role is learner
        if role != "learner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized as learner"
            )

        # Get learner profile from database
        result = await db.execute(
            select(LearnerProfile)
            .options(joinedload(LearnerProfile.user))
            .join(User, LearnerProfile.user_id == User.id)
            .where(User.id == user_id, User.role == UserRole.LEARNER)
        )
        learner = result.scalar_one_or_none()

        if learner is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Learner profile not found"
            )

        return learner

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials"
        )
