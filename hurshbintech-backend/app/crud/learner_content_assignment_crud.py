"""CRUD operations for Learner Content Assignments"""

from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.learner_content_assignment_model import LearnerContentAssignment


async def create_assignment(
    db: AsyncSession,
    learner_id: int,
    content_id: int,
    assigned_by_head: int,
    program_assignment_id: Optional[int] = None
) -> LearnerContentAssignment:
    """Create a new learner content assignment"""
    assignment = LearnerContentAssignment(
        learner_id=learner_id,
        content_id=content_id,
        assigned_by_head=assigned_by_head,
        program_assignment_id=program_assignment_id
    )
    
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return assignment


async def get_assignments_by_learner(
    db: AsyncSession,
    learner_id: int
) -> List[LearnerContentAssignment]:
    """Get all content assignments for a learner"""
    result = await db.execute(
        select(LearnerContentAssignment)
        .options(
            joinedload(LearnerContentAssignment.content),
            joinedload(LearnerContentAssignment.assigned_by)
        )
        .where(LearnerContentAssignment.learner_id == learner_id)
        .order_by(LearnerContentAssignment.assigned_at.desc())
    )
    return result.scalars().unique().all()


async def check_duplicate_assignment(
    db: AsyncSession,
    learner_id: int,
    content_id: int
) -> bool:
    """Check if content is already assigned to learner"""
    result = await db.execute(
        select(LearnerContentAssignment)
        .where(
            LearnerContentAssignment.learner_id == learner_id,
            LearnerContentAssignment.content_id == content_id
        )
    )
    return result.scalar_one_or_none() is not None


async def delete_assignment(
    db: AsyncSession,
    assignment_id: int
) -> bool:
    """Delete a learner content assignment"""
    result = await db.execute(
        select(LearnerContentAssignment)
        .where(LearnerContentAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    
    if not assignment:
        return False
    
    await db.delete(assignment)
    await db.commit()
    return True


async def get_assignments_by_program_assignment(
    db: AsyncSession,
    program_assignment_id: int
) -> List[LearnerContentAssignment]:
    """Get all content assignments for a specific program assignment"""
    result = await db.execute(
        select(LearnerContentAssignment)
        .options(joinedload(LearnerContentAssignment.content))
        .where(LearnerContentAssignment.program_assignment_id == program_assignment_id)
    )
    return result.scalars().unique().all()
