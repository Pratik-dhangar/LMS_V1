"""
Profile endpoints for all user types
"""

import hashlib
import json
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user_model import (
    Admin,
    CoachProfile,
    HeadProfile,
    LearnerProfile,
    TrainerProfile,
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
        result = current_user
    
    # Cache for 15 minutes
    await cache_service.set(cache_key, result.model_dump() if hasattr(result, 'model_dump') else result, ttl=cache_service.TTL_USER_PROFILE_ME)
    
    return result


@router.get("/me/subscriptions", response_model=List[LearnerSubscriptionResponse])
async def get_my_subscriptions(
    db: AsyncSession = Depends(get_db),
    current_user: (
        Admin | HeadProfile | TrainerProfile | CoachProfile | LearnerProfile
    ) = Depends(get_current_user),
):
    """Get all subscriptions for the current learner"""
    import logging
    from sqlalchemy import select
    from app.models.user_model import User

    logger = logging.getLogger(__name__)
    logger.info(f"User accessing subscriptions - Type: {type(current_user).__name__}, ID: {current_user.id if hasattr(current_user, 'id') else 'N/A'}")

    # If current_user is base User type, fetch the LearnerProfile
    if isinstance(current_user, User) and not isinstance(current_user, LearnerProfile):
        # Fetch learner profile
        result = await db.execute(
            select(LearnerProfile).where(LearnerProfile.user_id == current_user.id)
        )
        learner_profile = result.scalar_one_or_none()

        if not learner_profile:
            from fastapi import HTTPException, status
            logger.warning(f"User {current_user.id} is not a learner")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only learners can access this endpoint")

        current_user = learner_profile

    if not isinstance(current_user, LearnerProfile):
        from fastapi import HTTPException, status
        logger.warning(f"Non-learner tried to access endpoint: {type(current_user).__name__}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Only learners can access this endpoint. Your role: {type(current_user).__name__}")

    # Try cache first
    cache_key = f"subscription:user:{current_user.user_id}"

    cached_data = await cache_service.get(cache_key)
    if cached_data:
        logger.debug(f"Cache HIT: {cache_key}")
        # Validate cached data format - ensure it's a list of dicts, not strings
        if isinstance(cached_data, list) and len(cached_data) > 0:
            # Check if first item is a dict (valid format)
            if isinstance(cached_data[0], dict):
                return [LearnerSubscriptionResponse(**item) for item in cached_data]
            else:
                # Invalid cache format (old data), clear it
                logger.warning(f"Invalid cache format for {cache_key}, clearing and fetching fresh data")
                await cache_service.delete(cache_key)
        elif isinstance(cached_data, list) and len(cached_data) == 0:
            # Empty list is valid
            return []

    logger.debug(f"Cache MISS: {cache_key}")
    # Use user_id instead of profile id for subscription lookup
    subscriptions = await crud.subscription_crud.get_subscriptions_by_learner(db, current_user.user_id)
    logger.info(f"Found {len(subscriptions)} subscriptions for learner {current_user.user_id}")

    # Cache for 15 minutes - serialize to dictionaries
    await cache_service.set(cache_key, [s.model_dump() if hasattr(s, 'model_dump') else s for s in subscriptions], ttl=cache_service.TTL_USER_SUBSCRIPTIONS)

    return subscriptions
