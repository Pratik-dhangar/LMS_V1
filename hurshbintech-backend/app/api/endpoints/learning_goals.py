from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_current_head, get_current_coach
from app.crud import learning_goals_crud
from app.db.session import get_db
from app.models.user_model import HeadProfile, CoachProfile, User
from app.schemas.learning_goals import (
    LearningGoalsCreate,
    LearningGoalsResponse,
    LearningGoalsUpdate,
)

router = APIRouter(prefix="/learning-goals", tags=["Learning Goals"])

# ============ ADMIN ENDPOINTS ============#


@router.post("/admin", response_model=LearningGoalsResponse, status_code=status.HTTP_201_CREATED)
async def create_learning_goal(
    goal_data: LearningGoalsCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin creates new learning goal"""
    new_goal = await learning_goals_crud.create_learning_goal(db, goal_data, current_admin.id)
    return LearningGoalsResponse.from_orm_with_users(new_goal)


@router.get("/admin", response_model=List[LearningGoalsResponse])
async def get_all_goals_admin(
    db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)
):
    """Admin gets all learning goals"""
    goals = await learning_goals_crud.get_all_learning_goals(db)
    return [LearningGoalsResponse.from_orm_with_users(g) for g in goals]


@router.get("/admin/{goal_id}", response_model=LearningGoalsResponse)
async def get_goal_by_id_admin(
    goal_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin gets specific learning goal"""
    goal = await learning_goals_crud.get_learning_goal_by_id(db, goal_id)

    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    return LearningGoalsResponse.from_orm_with_users(goal)


@router.patch("/admin/{goal_id}", response_model=LearningGoalsResponse)
async def update_goal_admin(
    goal_id: int,
    goal_data: LearningGoalsUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin updates learning goal"""
    updated_goal = await learning_goals_crud.update_learning_goal(
        db, goal_id, goal_data, current_admin.id
    )

    if not updated_goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    return LearningGoalsResponse.from_orm_with_users(updated_goal)


@router.delete("/admin/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal_admin(
    goal_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Admin deletes learning goal"""
    try:
        success = await learning_goals_crud.delete_learning_goal(db, goal_id)

        if not success:
            raise HTTPException(status_code=404, detail="Goal not found")

        return None
    except Exception as e:
        # Log the error for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error deleting goal {goal_id}: {str(e)}")
        
        # If it's a foreign key constraint error, provide helpful message
        if "foreign key" in str(e).lower() or "constraint" in str(e).lower():
            raise HTTPException(
                status_code=400,
                detail="Cannot delete this program because it has active assignments. Please delete all assignments first."
            )
        raise HTTPException(status_code=500, detail="Failed to delete goal")


# ============ HEAD ENDPOINTS ============#


@router.get("/head", response_model=List[LearningGoalsResponse])
async def get_all_goals_head(
    db: AsyncSession = Depends(get_db), current_head: HeadProfile = Depends(get_current_head)
):
    """Head gets all learning goals (read-only list)"""
    goals = await learning_goals_crud.get_all_learning_goals(db)
    return [LearningGoalsResponse.from_orm_with_users(g) for g in goals]


@router.get("/head/{goal_id}", response_model=LearningGoalsResponse)
async def get_goal_by_id_head(
    goal_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Head gets specific learning goal"""
    goal = await learning_goals_crud.get_learning_goal_by_id(db, goal_id)

    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    return LearningGoalsResponse.from_orm_with_users(goal)

# ============ COACH ENDPOINTS ============#


@router.get("/coach", response_model=List[LearningGoalsResponse])
async def get_all_goals_coach(
    db: AsyncSession = Depends(get_db), 
    current_coach: CoachProfile = Depends(get_current_coach)
):
    """Coach gets all learning goals (read-only list)"""
    goals = await learning_goals_crud.get_all_learning_goals(db)
    return [LearningGoalsResponse.from_orm_with_users(g) for g in goals]


@router.get("/coach/{goal_id}", response_model=LearningGoalsResponse)
async def get_goal_by_id_coach(
    goal_id: int,
    db: AsyncSession = Depends(get_db),
    current_coach: CoachProfile = Depends(get_current_coach),
):
    """Coach gets specific learning goal"""
    goal = await learning_goals_crud.get_learning_goal_by_id(db, goal_id)

    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    return LearningGoalsResponse.from_orm_with_users(goal)