from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel

from app.db.session import get_db
from app.models.learning_goals_model import LearningGoals
from app.models.learning_goal_assignment_model import LearningGoalAssignment
from app.core.deps import get_current_user


# ROUTERS
head_router = APIRouter(prefix="/head", tags=["Learning Programs"])
learner_router = APIRouter(prefix="/learner", tags=["Learning Programs"])


class AssignProgramRequest(BaseModel):
    learner_id: int
    program_ids: list[int]


# ------------------------------------------------------------------------------
# ✅ HEAD APIs
# ------------------------------------------------------------------------------

@head_router.get("/learning-programs")
async def get_learning_programs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(LearningGoals))
    return result.scalars().all()


@head_router.post("/assign-learning-programs")
async def assign_learning_programs(
    request: AssignProgramRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    for program_id in request.program_ids:
        db.add(
            LearningGoalAssignment(
                learner_id=request.learner_id,
                learning_goal_id=program_id,
                assigned_by_head=current_user.id
            )
        )
    await db.commit()
    return {"message": "Programs assigned successfully"}


@head_router.get("/assigned-learning-programs/{learner_id}")
async def get_assigned_learning_programs(
    learner_id: int,
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(
            LearningGoalAssignment.id,
            LearningGoals.goal,
            LearningGoals.goal_description,
        )
        .join(LearningGoals, LearningGoals.id == LearningGoalAssignment.learning_goal_id)
        .where(LearningGoalAssignment.learner_id == learner_id)
    )
    result = await db.execute(stmt)
    programs = result.all()

    return [
        {
            "id": p.id,
            "program_title": p.goal,
            "program_description": p.goal_description,
        }
        for p in programs
    ]


@head_router.get("/assigned-learning-program/details/{assigned_id}")
async def get_learning_program_details(
    assigned_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    stmt = (
        select(
            LearningGoalAssignment.id,
            LearningGoals.goal,
            LearningGoals.goal_description,
            LearningGoalAssignment.assigned_at,
        )
        .join(LearningGoals, LearningGoals.id == LearningGoalAssignment.learning_goal_id)
        .where(LearningGoalAssignment.id == assigned_id)
    )
    result = await db.execute(stmt)
    row = result.first()

    if not row:
        return {"error": "Program not found"}

    return {
        "id": row.id,
        "program_title": row.goal,
        "program_description": row.goal_description,
        "assigned_at": row.assigned_at,
    }


@head_router.delete("/assigned-learning-program/{assigned_id}")
async def remove_assigned_program(
    assigned_id: int,
    db: AsyncSession = Depends(get_db)
):
    await db.execute(
        delete(LearningGoalAssignment).where(LearningGoalAssignment.id == assigned_id)
    )
    await db.commit()
    return {"message": "Program unassigned"}


# ------------------------------------------------------------------------------
# ✅ LEARNER APIs
# ------------------------------------------------------------------------------

@learner_router.get("/my-learning-programs")
async def learner_my_programs(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    # print(f"DEBUG: current_user.id = {current_user.id}")  # Debug log

    stmt = (
        select(
            LearningGoalAssignment.id,
            LearningGoals.goal,
            LearningGoals.goal_description,
        )
        .join(LearningGoals, LearningGoals.id == LearningGoalAssignment.learning_goal_id)
        .where(LearningGoalAssignment.learner_id == current_user.id)
    )

    result = await db.execute(stmt)
    rows = result.all()

    # print(f"DEBUG: Query returned {len(rows)} rows")  # Debug log
    for row in rows:
        # print(f"DEBUG: Row - id: {row.id}, goal: {row.goal}")  # Debug log
        pass

    return [
        {
            "id": row.id,
            "program_title": row.goal,
            "program_description": row.goal_description,
        }
        for row in rows
    ]


@learner_router.get("/my-learning-program/details/{assigned_id}")
async def learner_program_details(
    assigned_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    stmt = (
        select(
            LearningGoalAssignment.id,
            LearningGoals.goal,
            LearningGoals.goal_description,
            LearningGoalAssignment.assigned_at,
        )
        .join(LearningGoals, LearningGoals.id == LearningGoalAssignment.learning_goal_id)
        .where(
            LearningGoalAssignment.id == assigned_id,
            LearningGoalAssignment.learner_id == current_user.id,
        )
    )

    result = await db.execute(stmt)
    row = result.first()

    if not row:
        return {"error": "Program not found"}

    return {
        "id": row.id,
        "program_title": row.goal,
        "program_description": row.goal_description,
        "assigned_at": row.assigned_at,
    }
