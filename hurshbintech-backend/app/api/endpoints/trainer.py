"""
Trainer-specific endpoints needed for trainer UI (permission checks and learner lists).
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.deps import get_current_trainer
from app.db.session import get_db
from app.models.user_model import TrainerProfile, HeadProfile
from app.crud import subscription_crud, user_crud

router = APIRouter(prefix="/trainer", tags=["Trainer Operations"])


@router.get("/settings")
async def get_trainer_view_settings(
    db: AsyncSession = Depends(get_db),
    current_trainer: TrainerProfile = Depends(get_current_trainer),
):
    """Return settings relevant to the trainer (e.g., whether their Head allows scheduling)."""
    # Find trainer record (should be current_trainer already)
    trainer = current_trainer
    head_id = getattr(trainer, "created_by_head_id", None)
    if not head_id:
        return {"can_trainers_schedule_ilp": False}
    head_result = await db.execute(select(HeadProfile).where(HeadProfile.id == head_id))
    head = head_result.scalar_one_or_none()
    effective_permission = (
        trainer.can_schedule_ilp
        if getattr(trainer, "can_schedule_ilp", None) is not None
        else bool(getattr(head, "can_trainers_schedule_ilp", False))
    )
    return {"can_trainers_schedule_ilp": effective_permission}


@router.get("/learners/for-session-scheduling", response_model=List[dict])
async def get_learners_for_trainer_session_scheduling(
    db: AsyncSession = Depends(get_db),
    current_trainer: TrainerProfile = Depends(get_current_trainer),
):
    """Return learners belonging to the trainer's Head for scheduling dropdown (same shape as Head endpoint)."""
    head_id = getattr(current_trainer, "created_by_head_id", None)
    if not head_id:
        return []

    learners = await user_crud.get_learners_by_head(db, head_id)
    responses = []
    for learner in learners:
        active_subscription = await subscription_crud.get_active_subscription_for_learner(db, learner.user_id)
        remaining_sessions = active_subscription.sessions_remaining if active_subscription else 0
        can_schedule = learner.user.is_active and remaining_sessions > 0
        status_text = "Active" if can_schedule else "Inactive (Expired)"
        responses.append({
            "id": learner.user_id,
            "name": learner.user.name,
            "remaining_sessions": remaining_sessions,
            "is_active": learner.user.is_active,
            "can_schedule": can_schedule,
            "status_text": status_text,
        })
    return responses
