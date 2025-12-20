from typing import List, Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.learning_goals_model import LearningGoals
from app.schemas.learning_goals import LearningGoalsCreate, LearningGoalsUpdate


async def create_learning_goal(
    db: AsyncSession, goal_data: LearningGoalsCreate, admin_id: int
) -> LearningGoals:
    """Create new learning goal"""
    new_goal = LearningGoals(
        goal=goal_data.goal,
        goal_description=goal_data.goal_description,
        created_by_admin_id=admin_id,
    )

    db.add(new_goal)
    await db.commit()
    await db.refresh(new_goal)

    # Load relationships
    result = await db.execute(
        select(LearningGoals)
        .options(joinedload(LearningGoals.created_by), joinedload(LearningGoals.updated_by))
        .where(LearningGoals.id == new_goal.id)
    )
    return result.scalar_one()


async def get_all_learning_goals(db: AsyncSession) -> List[LearningGoals]:
    """Get all learning goals"""
    result = await db.execute(
        select(LearningGoals)
        .options(joinedload(LearningGoals.created_by), joinedload(LearningGoals.updated_by))
        .order_by(LearningGoals.created_at.desc())
    )
    return result.scalars().all()


async def get_learning_goal_by_id(db: AsyncSession, goal_id: int) -> Optional[LearningGoals]:
    """Get learning goal by ID"""
    result = await db.execute(
        select(LearningGoals)
        .options(joinedload(LearningGoals.created_by), joinedload(LearningGoals.updated_by))
        .where(LearningGoals.id == goal_id)
    )
    return result.scalar_one_or_none()


async def update_learning_goal(
    db: AsyncSession, goal_id: int, goal_data: LearningGoalsUpdate, user_id: int
) -> Optional[LearningGoals]:
    """Update learning goal"""
    goal = await get_learning_goal_by_id(db, goal_id)

    if not goal:
        return None

    if goal_data.goal is not None:
        goal.goal = goal_data.goal
    if goal_data.goal_description is not None:
        goal.goal_description = goal_data.goal_description
    if goal_data.program_type is not None:
        goal.program_type = goal_data.program_type

    goal.updated_by_id = user_id

    await db.commit()
    await db.refresh(goal)

    # Reload relationships
    result = await db.execute(
        select(LearningGoals)
        .options(joinedload(LearningGoals.created_by), joinedload(LearningGoals.updated_by))
        .where(LearningGoals.id == goal_id)
    )
    return result.scalar_one()


async def delete_learning_goal(db: AsyncSession, goal_id: int) -> bool:
    """Delete learning goal (admin only)
    
    Note: This will cascade delete any program assignments with ondelete=CASCADE
    """
    goal = await get_learning_goal_by_id(db, goal_id)

    if not goal:
        return False

    try:
        # First delete any orphaned assignments or clean up relations
        await db.execute(
            delete(LearningGoals)
            .where(LearningGoals.id == goal_id)
        )
        await db.commit()
        return True
    except Exception as e:
        await db.rollback()
        # Re-raise so endpoint can handle appropriately
        raise e
