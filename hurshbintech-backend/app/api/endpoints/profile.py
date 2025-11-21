"""
Profile endpoints for all user types
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user_model import Admin, HeadProfile, TrainerProfile, ConsultantProfile, LearnerProfile
from app.schemas.user import AdminResponse, HeadResponse, TrainerResponse, ConsultantResponse, LearnerResponse
from app.core.deps import get_current_admin, get_current_user

router = APIRouter(prefix="/profile", tags=["Profile"])


# Get current user profile
@router.get("/me/user")
async def get_user_profile(
    db: AsyncSession = Depends(get_db),
    current_user: Admin | HeadProfile | TrainerProfile | ConsultantProfile | LearnerProfile = Depends(get_current_user)
):

    if isinstance(current_user, HeadProfile):
        return HeadResponse.from_orm_with_user(current_user)
    elif isinstance(current_user, Admin):
        return AdminResponse.model_validate(current_user)    
    elif isinstance(current_user, TrainerProfile):
        return TrainerResponse.from_orm_with_user(current_user)
    elif isinstance(current_user, ConsultantProfile):
        return ConsultantResponse.from_orm_with_user(current_user)
    elif isinstance(current_user, LearnerProfile):
        return LearnerResponse.from_orm_with_user(current_user)
