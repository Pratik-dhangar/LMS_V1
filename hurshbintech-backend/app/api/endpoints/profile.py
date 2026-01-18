"""
Profile endpoints for all user types
"""

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
from app import crud

router = APIRouter(prefix="/profile", tags=["Profile"])


# Get current user profile
@router.get("/me/user")
async def get_user_profile(
    db: AsyncSession = Depends(get_db),
    current_user: (
        Admin | HeadProfile | TrainerProfile | CoachProfile | LearnerProfile
    ) = Depends(get_current_user),
):

    if isinstance(current_user, HeadProfile):
        return HeadResponse.from_orm_with_user(current_user)
    elif isinstance(current_user, Admin):
        return AdminResponse.model_validate(current_user)
    elif isinstance(current_user, TrainerProfile):
        return TrainerResponse.from_orm_with_user(current_user)
    elif isinstance(current_user, CoachProfile):
        return CoachResponse.from_orm_with_user(current_user)
    elif isinstance(current_user, LearnerProfile):
        return LearnerResponse.from_orm_with_user(current_user)


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
    
    subscriptions = await crud.subscription_crud.get_subscriptions_by_learner(db, current_user.id)
    logger.info(f"Found {len(subscriptions)} subscriptions for learner {current_user.id}")
    return subscriptions
