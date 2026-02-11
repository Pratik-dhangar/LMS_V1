"""
Profile endpoints for all user types
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user_model import (
    Admin,
    CoachProfile,
    HeadProfile,
    LearnerProfile,
    TrainerProfile,
    User,
)
from app.schemas.user import (
    AdminResponse,
    CoachResponse,
    HeadResponse,
    LearnerResponse,
    TrainerResponse,
)
from app.schemas.subscription import LearnerSubscriptionResponse
from app.services.cache_service import cache_service
from app import crud

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/profile", tags=["Profile"])


# Get current user profile
@router.get("/me/user")
async def get_user_profile(
    db: AsyncSession = Depends(get_db),
    current_user: (
        Admin | HeadProfile | TrainerProfile | CoachProfile | LearnerProfile
    ) = Depends(get_current_user),
):
    """Get current user profile - Cached for 15 minutes (user-specific)"""
    # Get user_id for cache key (handle different profile types)
    if isinstance(current_user, Admin):
        user_id = current_user.id
    else:
        user_id = current_user.user_id if hasattr(current_user, 'user_id') else current_user.id
    
    cache_key = cache_service.key_user_profile_me(user_id)
    
    # Try cache first
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        logger.debug(f"Cache HIT: {cache_key}")
        # Return appropriate response type based on cached role
        role = cached_data.get('role')
        if role == 'head':
            return HeadResponse(**cached_data)
        elif role == 'admin':
            return AdminResponse(**cached_data)
        elif role == 'trainer':
            return TrainerResponse(**cached_data)
        elif role == 'coach':
            return CoachResponse(**cached_data)
        elif role == 'learner':
            return LearnerResponse(**cached_data)
        return cached_data
    
    logger.debug(f"Cache MISS: {cache_key}")
    
    # Generate response based on user type
    if isinstance(current_user, HeadProfile):
        result = HeadResponse.from_orm_with_user(current_user)
    elif isinstance(current_user, Admin):
        result = AdminResponse.model_validate(current_user)
    elif isinstance(current_user, TrainerProfile):
        result = TrainerResponse.from_orm_with_user(current_user)
    elif isinstance(current_user, CoachProfile):
        result = CoachResponse.from_orm_with_user(current_user)
    elif isinstance(current_user, LearnerProfile):
        result = LearnerResponse.from_orm_with_user(current_user)
    else:
        logger.error(f"Unhandled case - Type: {type(current_user).__name__}")
        raise HTTPException(status_code=500, detail="Unable to determine profile type")
    
    # Cache for 15 minutes
    await cache_service.set(cache_key, result.model_dump(), ttl=cache_service.TTL_USER_PROFILE_ME)
    
    return result


@router.get("/me/subscriptions", response_model=List[LearnerSubscriptionResponse])
async def get_my_subscriptions(
    db: AsyncSession = Depends(get_db),
    current_user: (
        Admin | HeadProfile | TrainerProfile | CoachProfile | LearnerProfile
    ) = Depends(get_current_user),
):
    """Get all subscriptions for the current learner"""
    logger.info(f"User accessing subscriptions - Type: {type(current_user).__name__}, ID: {current_user.id if hasattr(current_user, 'id') else 'N/A'}")

    # If current_user is base User type, fetch the LearnerProfile
    if isinstance(current_user, User) and not isinstance(current_user, LearnerProfile):
        # Fetch learner profile
        result = await db.execute(
            select(LearnerProfile).where(LearnerProfile.user_id == current_user.id)
        )
        learner_profile = result.scalar_one_or_none()

        if not learner_profile:
            logger.warning(f"User {current_user.id} is not a learner")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only learners can access this endpoint")

        current_user = learner_profile

    if not isinstance(current_user, LearnerProfile):
        logger.warning(f"Non-learner tried to access endpoint: {type(current_user).__name__}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Only learners can access this endpoint. Your role: {type(current_user).__name__}")

    # Try cache first
    cache_key = f"subscription:user:{current_user.user_id}"
    cached_data = await cache_service.get(cache_key)
    
    if cached_data:
        logger.debug(f"Cache HIT: {cache_key}")
        return [LearnerSubscriptionResponse(**item) for item in cached_data]

    logger.debug(f"Cache MISS: {cache_key}")
    
    # Use user_id instead of profile id for subscription lookup
    subscriptions = await crud.subscription_crud.get_subscriptions_by_learner(db, current_user.user_id)
    logger.info(f"Found {len(subscriptions)} subscriptions for learner {current_user.user_id}")

    # Cache for 15 minutes - serialize to dictionaries
    subscription_data = [s.model_dump() for s in subscriptions]
    await cache_service.set(cache_key, subscription_data, ttl=cache_service.TTL_USER_SUBSCRIPTIONS)

    return subscriptions
