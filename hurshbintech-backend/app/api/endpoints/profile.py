"""
Profile endpoints for all user types
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
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
    UserRole,
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
        Admin | HeadProfile | TrainerProfile | CoachProfile | LearnerProfile | User
    ) = Depends(get_current_user),
):
    """Get current user profile - Cached for 15 minutes (user-specific)"""
    # Get user_id for cache key (handle different profile types)
    if isinstance(current_user, Admin):
        user_id = current_user.id
    elif isinstance(current_user, User):
        # Base User object - need to get profile based on role
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

    # If current_user is base User type, fetch or extract the appropriate profile
    if isinstance(current_user, User) and not isinstance(current_user, (Admin, HeadProfile, TrainerProfile, CoachProfile, LearnerProfile)):
        logger.info(f"Base User object received for role: {current_user.role}")

        # Fetch the appropriate profile based on role
        # First check if profile is already loaded via relationship
        if current_user.role == UserRole.HEAD:
            if hasattr(current_user, 'head_profile') and current_user.head_profile:
                current_user = current_user.head_profile
            else:
                result = await db.execute(
                    select(HeadProfile)
                    .options(joinedload(HeadProfile.user))
                    .where(HeadProfile.user_id == current_user.id)
                )
                profile = result.scalar_one_or_none()
                if profile:
                    current_user = profile
        elif current_user.role == UserRole.TRAINER:
            if hasattr(current_user, 'trainer_profile') and current_user.trainer_profile:
                current_user = current_user.trainer_profile
            else:
                result = await db.execute(
                    select(TrainerProfile)
                    .options(joinedload(TrainerProfile.user))
                    .where(TrainerProfile.user_id == current_user.id)
                )
                profile = result.scalar_one_or_none()
                if profile:
                    current_user = profile
        elif current_user.role == UserRole.COACH:
            if hasattr(current_user, 'coach_profile') and current_user.coach_profile:
                current_user = current_user.coach_profile
            else:
                result = await db.execute(
                    select(CoachProfile)
                    .options(joinedload(CoachProfile.user))
                    .where(CoachProfile.user_id == current_user.id)
                )
                profile = result.scalar_one_or_none()
                if profile:
                    current_user = profile
        elif current_user.role == UserRole.LEARNER:
            if hasattr(current_user, 'learner_profile') and current_user.learner_profile:
                current_user = current_user.learner_profile
            else:
                result = await db.execute(
                    select(LearnerProfile)
                    .options(joinedload(LearnerProfile.user))
                    .where(LearnerProfile.user_id == current_user.id)
                )
                profile = result.scalar_one_or_none()
                if profile:
                    current_user = profile

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

    # Cache for 15 minutes - convert SQLAlchemy models to dicts
    subscription_data = []
    for sub in subscriptions:
        # Extract learner name from relationship
        learner_name = None
        if sub.learner and hasattr(sub.learner, 'name'):
            learner_name = sub.learner.name
        
        # Extract head name from relationship
        head_name = None
        if sub.current_head and hasattr(sub.current_head, 'name'):
            head_name = sub.current_head.name
        
        # Create dict with all fields including relationship data
        sub_dict = {
            "id": sub.id,
            "learner_id": sub.learner_id,
            "learner_name": learner_name,
            "package_id": sub.package_id,
            "created_by_head_id": sub.created_by_head_id,
            "current_head_id": sub.current_head_id,
            "head_name": head_name,
            "package_name": sub.package_name,
            "package_sessions": sub.package_sessions,
            "package_validity_days": sub.package_validity_days,
            "package_original_price": float(sub.package_original_price),
            "start_date": sub.start_date,
            "expiry_date": sub.expiry_date,
            "status": sub.status.value if hasattr(sub.status, 'value') else sub.status,
            "sessions_total": sub.sessions_total,
            "sessions_completed": sub.sessions_completed,
            "sessions_remaining": sub.sessions_remaining,
            "discount_applied": float(sub.discount_applied),
            "discount_code_id": sub.discount_code_id,
            "applied_by_head_id": sub.applied_by_head_id,
            "net_price_paid": float(sub.net_price_paid),
            "paused_at": sub.paused_at,
            "paused_duration_days": sub.paused_duration_days,
            "frozen_at": sub.frozen_at,
            "frozen_duration_days": sub.frozen_duration_days,
            "renewed_from_subscription_id": sub.renewed_from_subscription_id,
            "renewed_to_subscription_id": sub.renewed_to_subscription_id,
            "refund_amount": float(sub.refund_amount) if sub.refund_amount else None,
            "refund_type": sub.refund_type.value if sub.refund_type and hasattr(sub.refund_type, 'value') else sub.refund_type,
            "refund_date": sub.refund_date,
            "refund_reason": sub.refund_reason,
            "created_at": sub.created_at,
            "updated_at": sub.updated_at,
        }
        subscription_data.append(sub_dict)
    
    await cache_service.set(cache_key, subscription_data, ttl=cache_service.TTL_USER_SUBSCRIPTIONS)

    return subscriptions
