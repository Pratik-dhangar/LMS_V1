"""
Profile endpoints for all user types
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload
from typing import List

from app.core.deps import get_current_user, get_current_admin
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
    AdminUpdate,
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
    
    # Get user_id and user object for cache key and data extraction
    if isinstance(current_user, Admin):
        user_id = current_user.id
        user_obj = None  # Admin model doesn't have a corresponding User
    elif isinstance(current_user, User):
        # This is a User object (possibly with profile loaded via relationship)
        user_id = current_user.id
        user_obj = current_user
    else:
        # This is a profile object
        user_id = current_user.user_id
        user_obj = current_user.user if hasattr(current_user, 'user') else None

    cache_key = cache_service.key_user_profile_me(user_id)

    # TEMPORARILY DISABLED CACHE - FOR DEBUGGING
    # Try cache first
    # cached_data = await cache_service.get(cache_key)
    # if cached_data:
    #     logger.debug(f"Cache HIT: {cache_key}")
    #     # Return appropriate response type based on cached role (case-insensitive)
    #     role = cached_data.get('role', '').lower()
    #     if role == 'head':
    #         return HeadResponse(**cached_data)
    #     elif role == 'admin':
    #         return AdminResponse(**cached_data)
    #     elif role == 'trainer':
    #         return TrainerResponse(**cached_data)
    #     elif role == 'coach':
    #         return CoachResponse(**cached_data)
    #     elif role == 'learner':
    #         return LearnerResponse(**cached_data)
    #     return cached_data

    logger.debug(f"Cache DISABLED - Fetching fresh data for: {cache_key}")

    # Extract profile if we have a User object
    profile_obj = None
    if isinstance(current_user, User) and not isinstance(current_user, (Admin, HeadProfile, TrainerProfile, CoachProfile, LearnerProfile)):
        logger.info(f"User object received for role: {current_user.role}")
        
        if current_user.role == UserRole.ADMIN:
            logger.info(f"Admin user - email: {current_user.email}")
        elif current_user.role == UserRole.HEAD:
            profile_obj = current_user.head_profile if hasattr(current_user, 'head_profile') else None
        elif current_user.role == UserRole.TRAINER:
            profile_obj = current_user.trainer_profile if hasattr(current_user, 'trainer_profile') else None
        elif current_user.role == UserRole.COACH:
            profile_obj = current_user.coach_profile if hasattr(current_user, 'coach_profile') else None
        elif current_user.role == UserRole.LEARNER:
            profile_obj = current_user.learner_profile if hasattr(current_user, 'learner_profile') else None
    else:
        # Already a profile object
        profile_obj = current_user if isinstance(current_user, (HeadProfile, TrainerProfile, CoachProfile, LearnerProfile)) else None

    # If profile not loaded via relationship, fetch it
    if profile_obj is None and isinstance(current_user, User) and current_user.role in [UserRole.HEAD, UserRole.TRAINER, UserRole.COACH, UserRole.LEARNER]:
        logger.info(f"Profile not loaded via relationship, fetching from DB for user {current_user.id}")
        if current_user.role == UserRole.HEAD:
            result = await db.execute(
                select(HeadProfile).where(HeadProfile.user_id == current_user.id).options(selectinload(HeadProfile.user), selectinload(HeadProfile.reference_data))
            )
            profile_obj = result.scalar_one_or_none()
        elif current_user.role == UserRole.TRAINER:
            result = await db.execute(
                select(TrainerProfile).where(TrainerProfile.user_id == current_user.id).options(selectinload(TrainerProfile.user), selectinload(TrainerProfile.reference_data))
            )
            profile_obj = result.scalar_one_or_none()
        elif current_user.role == UserRole.COACH:
            result = await db.execute(
                select(CoachProfile).where(CoachProfile.user_id == current_user.id).options(selectinload(CoachProfile.user), selectinload(CoachProfile.reference_data))
            )
            profile_obj = result.scalar_one_or_none()
        elif current_user.role == UserRole.LEARNER:
            result = await db.execute(
                select(LearnerProfile).where(LearnerProfile.user_id == current_user.id).options(selectinload(LearnerProfile.user), selectinload(LearnerProfile.reference_data))
            )
            profile_obj = result.scalar_one_or_none()

    # Ensure user_obj is available for response generation
    if user_obj is None and profile_obj is not None:
        result = await db.execute(
            select(User).where(User.id == profile_obj.user_id)
        )
        user_obj = result.scalar_one()
    elif user_obj is None and isinstance(current_user, (HeadProfile, TrainerProfile, CoachProfile, LearnerProfile)):
        # current_user is a profile object, fetch its user
        result = await db.execute(
            select(User).where(User.id == current_user.user_id)
        )
        user_obj = result.scalar_one()

    # Generate response based on user type
    if isinstance(current_user, HeadProfile):
        result = HeadResponse.from_orm_with_user(current_user, user_obj)
    elif isinstance(current_user, Admin):
        result = AdminResponse.from_orm(current_user)
    elif isinstance(current_user, User) and current_user.role == UserRole.ADMIN:
        # Admin users are User objects with ADMIN role (not Admin model instances)
        result = AdminResponse.from_orm(current_user)
    elif isinstance(current_user, TrainerProfile):
        result = TrainerResponse.from_orm_with_user(current_user, user_obj)
    elif isinstance(current_user, CoachProfile):
        result = CoachResponse.from_orm_with_user(current_user, user_obj)
    elif isinstance(current_user, LearnerProfile):
        result = LearnerResponse.from_orm_with_user(current_user, user_obj)
    elif isinstance(current_user, User) and current_user.role == UserRole.HEAD:
        # Handle User objects with HEAD role - use fetched profile_obj
        if profile_obj and isinstance(profile_obj, HeadProfile):
            result = HeadResponse.from_orm_with_user(profile_obj, user_obj)
        else:
            logger.error(f"HEAD profile not found for user {current_user.id}")
            raise HTTPException(status_code=500, detail="HEAD profile not found")
    elif isinstance(current_user, User) and current_user.role == UserRole.TRAINER:
        # Handle User objects with TRAINER role - use fetched profile_obj
        if profile_obj and isinstance(profile_obj, TrainerProfile):
            result = TrainerResponse.from_orm_with_user(profile_obj, user_obj)
        else:
            logger.error(f"TRAINER profile not found for user {current_user.id}")
            raise HTTPException(status_code=500, detail="TRAINER profile not found")
    elif isinstance(current_user, User) and current_user.role == UserRole.COACH:
        # Handle User objects with COACH role - use fetched profile_obj
        if profile_obj and isinstance(profile_obj, CoachProfile):
            result = CoachResponse.from_orm_with_user(profile_obj, user_obj)
        else:
            logger.error(f"COACH profile not found for user {current_user.id}")
            raise HTTPException(status_code=500, detail="COACH profile not found")
    elif isinstance(current_user, User) and current_user.role == UserRole.LEARNER:
        # Handle User objects with LEARNER role - use fetched profile_obj
        if profile_obj and isinstance(profile_obj, LearnerProfile):
            result = LearnerResponse.from_orm_with_user(profile_obj, user_obj)
        else:
            logger.error(f"LEARNER profile not found for user {current_user.id}")
            raise HTTPException(status_code=500, detail="LEARNER profile not found")
    else:
        logger.error(f"Unhandled case - Type: {type(current_user).__name__}, Role: {getattr(current_user, 'role', 'N/A')}")
        raise HTTPException(status_code=500, detail="Unable to determine profile type")

    # Log the response for debugging - including email and contact_number
    logger.info(f"Profile endpoint returning - ID: {result.id}, Email: {result.email}, Contact: {getattr(result, 'contact_number', 'N/A')}, Name: {result.name}")
    
    # TEMPORARILY DISABLED CACHE - FOR DEBUGGING
    # Cache for 15 minutes
    # await cache_service.set(cache_key, result.model_dump(), ttl=cache_service.TTL_USER_PROFILE_ME)

    return result


@router.get("/me/subscriptions", response_model=List[LearnerSubscriptionResponse])
async def get_my_subscriptions(
    db: AsyncSession = Depends(get_db),
    current_user: (
        User | HeadProfile | TrainerProfile | CoachProfile | LearnerProfile
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


# Update admin profile
@router.put("/admin/update", response_model=AdminResponse)
async def update_admin_profile(
    admin_update: AdminUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin = Depends(get_current_admin),
):
    """Update admin profile information"""
    
    from app.models.user_model import User
    
    logger = logging.getLogger(__name__)
    
    try:
        # Ensure we're working with a User object
        if not isinstance(current_admin, User):
            raise HTTPException(status_code=500, detail="Invalid admin user object")
        
        updated_admin = await crud.user_crud.update_admin_profile(
            db, current_admin.id, admin_update
        )
        if not updated_admin:
            raise HTTPException(status_code=404, detail="Admin not found")
        
        # Invalidate cached profile
        cache_key = cache_service.key_user_profile_me(current_admin.id)
        await cache_service.delete(cache_key)
        
        logger.info(f"Admin profile updated: {updated_admin.id}")
        return AdminResponse.from_orm(updated_admin)
    except ValueError as e:
        logger.warning(f"Validation error updating admin: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating admin profile: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update admin profile")
