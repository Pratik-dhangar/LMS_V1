from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import joinedload
from typing import List, Optional

from app.models.learning_content_assignment_model import LearningContentAssignment
from app.models.learning_content_model import LearningContent
from app.models.user_model import User, UserRole
from app.schemas.learning_content_assignment import LearningContentAssignmentCreate

async def create_assignment(
    db: AsyncSession,
    assignment_data: LearningContentAssignmentCreate,
    assigned_by_head: int
) -> LearningContentAssignment:
    """Create new learning content assignment"""
    new_assignment = LearningContentAssignment(
        learner_id=assignment_data.learner_id,
        learning_content_id=assignment_data.learning_content_id,
        assigned_by_head=assigned_by_head
    )

    db.add(new_assignment)
    await db.commit()
    await db.refresh(new_assignment)
    return new_assignment

async def get_assignments_by_learner(
    db: AsyncSession,
    learner_id: int
) -> List[LearningContentAssignment]:
    """Get all assignments for a specific learner"""
    result = await db.execute(
        select(LearningContentAssignment)
        .options(
            joinedload(LearningContentAssignment.learner),
            joinedload(LearningContentAssignment.learning_content),
            joinedload(LearningContentAssignment.assigned_by)
        )
        .where(LearningContentAssignment.learner_id == learner_id)
        .order_by(LearningContentAssignment.assigned_at.desc())
    )
    return result.scalars().all()

async def get_all_assignments(db: AsyncSession) -> List[LearningContentAssignment]:
    """Get all assignments"""
    result = await db.execute(
        select(LearningContentAssignment)
        .options(
            joinedload(LearningContentAssignment.learner),
            joinedload(LearningContentAssignment.learning_content),
            joinedload(LearningContentAssignment.assigned_by)
        )
        .order_by(LearningContentAssignment.assigned_at.desc())
    )
    return result.scalars().all()

async def get_assignment_by_id(
    db: AsyncSession,
    assignment_id: int
) -> Optional[LearningContentAssignment]:
    """Get assignment by ID"""
    result = await db.execute(
        select(LearningContentAssignment)
        .options(
            joinedload(LearningContentAssignment.learner),
            joinedload(LearningContentAssignment.learning_content),
            joinedload(LearningContentAssignment.assigned_by)
        )
        .where(LearningContentAssignment.id == assignment_id)
    )
    return result.scalar_one_or_none()

async def delete_assignment(
    db: AsyncSession,
    assignment_id: int
) -> bool:
    """Delete assignment by ID"""
    assignment = await get_assignment_by_id(db, assignment_id)
    if not assignment:
        return False

    await db.delete(assignment)
    await db.commit()
    return True

async def get_all_learners(db: AsyncSession) -> List[User]:
    """Get all learners"""
    result = await db.execute(
        select(User)
        .where(User.role == UserRole.LEARNER)
        .order_by(User.name)
    )
    return result.scalars().all()

async def get_all_contents(db: AsyncSession) -> List[LearningContent]:
    """Get all learning contents"""
    result = await db.execute(
        select(LearningContent)
        .order_by(LearningContent.title)
    )
    return result.scalars().all()
