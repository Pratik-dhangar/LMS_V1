"""CRUD operations for Program Assignment"""

from datetime import datetime, date
from typing import List, Optional

from sqlalchemy import select, func, and_, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.program_assignment_model import ProgramAssignment, CompletionStatus
from app.models.program_learning_content_model import ProgramLearningContent
from app.models.learning_goals_model import LearningGoals
from app.models.user_model import User
from app.models.learner_content_assignment_model import LearnerContentAssignment, ContentCompletionStatus


async def check_duplicate_active_assignment(
    db: AsyncSession,
    learner_id: int,
    program_id: int
) -> Optional[ProgramAssignment]:
    """Check if learner already has an active assignment containing this program"""
    from sqlalchemy import and_, or_, func
    
    result = await db.execute(
        select(ProgramAssignment)
        .where(
            and_(
                ProgramAssignment.learner_id == learner_id,
                # Check if program_id is in the program_ids JSON array
                func.cast(program_id, type_=str).isin(
                    func.json_array_elements_text(ProgramAssignment.program_ids)
                ),
                or_(
                    ProgramAssignment.completion_status == CompletionStatus.NOT_STARTED,
                    ProgramAssignment.completion_status == CompletionStatus.IN_PROGRESS
                )
            )
        )
    )
    return result.scalar_one_or_none()


async def create_assignment(
    db: AsyncSession,
    learner_id: int,
    program_ids: list,  # Changed from program_id: int
    assigned_by_head: int,
    assignment_title: str,
    start_date: date,
    end_date: date,
    duration_days: Optional[int] = None,
    head_notes: Optional[str] = None
) -> ProgramAssignment:
    """Create a new program assignment with multiple programs"""
    
    # Calculate duration if not provided
    if duration_days is None:
        duration_days = (end_date - start_date).days
    
    new_assignment = ProgramAssignment(
        learner_id=learner_id,
        program_ids=program_ids if isinstance(program_ids, list) else [program_ids],  # Ensure it's a list
        assigned_by_head=assigned_by_head,
        assignment_title=assignment_title,
        start_date=start_date,
        end_date=end_date,
        duration_days=duration_days,
        head_notes=head_notes,
        completion_status=CompletionStatus.NOT_STARTED,
        notification_sent=False
    )
    
    db.add(new_assignment)
    await db.commit()
    await db.refresh(new_assignment)
    return new_assignment


async def get_assignments(
    db: AsyncSession,
    learner_id: Optional[int] = None,
    status: Optional[CompletionStatus] = None,
    assigned_by_head: Optional[int] = None
) -> List[ProgramAssignment]:
    """Get program assignments with optional filters"""
    
    query = select(ProgramAssignment).options(
        joinedload(ProgramAssignment.learner),
        joinedload(ProgramAssignment.assigned_by),
        selectinload(ProgramAssignment.content_assignments).selectinload(LearnerContentAssignment.content)
    )
    
    filters = []
    if learner_id:
        filters.append(ProgramAssignment.learner_id == learner_id)
    if status:
        filters.append(ProgramAssignment.completion_status == status)
    if assigned_by_head:
        filters.append(ProgramAssignment.assigned_by_head == assigned_by_head)
    
    if filters:
        query = query.where(and_(*filters))
    
    query = query.order_by(ProgramAssignment.assigned_at.desc())
    
    result = await db.execute(query)
    return result.unique().scalars().all()

async def get_assignment_by_id(
    db: AsyncSession,
    assignment_id: int
) -> Optional[ProgramAssignment]:
    """Get assignment by ID with all relationships loaded"""
    from app.models.learner_content_assignment_model import LearnerContentAssignment
    from app.models.learning_content_model import LearningContent
    
    result = await db.execute(
        select(ProgramAssignment)
        .options(
            joinedload(ProgramAssignment.learner),
            joinedload(ProgramAssignment.assigned_by),
            joinedload(ProgramAssignment.attachments),
            joinedload(ProgramAssignment.content_assignments).joinedload(LearnerContentAssignment.content)
        )
        .where(ProgramAssignment.id == assignment_id)
    )
    return result.unique().scalar_one_or_none()


async def update_assignment(
    db: AsyncSession,
    assignment_id: int,
    update_data: dict
) -> Optional[ProgramAssignment]:
    """Update assignment fields"""
    assignment = await get_assignment_by_id(db, assignment_id)
    if not assignment:
        return None
    
    for key, value in update_data.items():
        if hasattr(assignment, key):
            setattr(assignment, key, value)
    
    assignment.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(assignment)
    return assignment


async def mark_assignment_complete(
    db: AsyncSession,
    assignment_id: int
) -> Optional[ProgramAssignment]:
    """Mark an assignment as completed"""
    assignment = await get_assignment_by_id(db, assignment_id)
    if not assignment:
        return None
    
    assignment.completion_status = CompletionStatus.COMPLETED
    assignment.completed_at = datetime.utcnow()
    assignment.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(assignment)
    return assignment


async def delete_assignment(
    db: AsyncSession,
    assignment_id: int
) -> bool:
    """Delete an assignment"""
    assignment = await get_assignment_by_id(db, assignment_id)
    if not assignment:
        return False
    
    await db.delete(assignment)
    await db.commit()
    return True


async def get_learner_completion_stats(
    db: AsyncSession,
    learner_id: int
) -> dict:
    """Get completion statistics for a learner"""
    
    # Total assignments
    total_result = await db.execute(
        select(func.count(ProgramAssignment.id))
        .where(ProgramAssignment.learner_id == learner_id)
    )
    total_count = total_result.scalar()
    
    # Completed assignments
    completed_result = await db.execute(
        select(func.count(ProgramAssignment.id))
        .where(
            ProgramAssignment.learner_id == learner_id,
            ProgramAssignment.completion_status == CompletionStatus.COMPLETED
        )
    )
    completed_count = completed_result.scalar()
    
    # In progress assignments
    in_progress_result = await db.execute(
        select(func.count(ProgramAssignment.id))
        .where(
            ProgramAssignment.learner_id == learner_id,
            ProgramAssignment.completion_status == CompletionStatus.IN_PROGRESS
        )
    )
    in_progress_count = in_progress_result.scalar()
    
    # Not started assignments
    not_started_result = await db.execute(
        select(func.count(ProgramAssignment.id))
        .where(
            ProgramAssignment.learner_id == learner_id,
            ProgramAssignment.completion_status == CompletionStatus.NOT_STARTED
        )
    )
    not_started_count = not_started_result.scalar()
    
    # Calculate completion percentage
    completion_percentage = (completed_count / total_count * 100) if total_count > 0 else 0
    
    return {
        "total_assignments": total_count,
        "completed": completed_count,
        "in_progress": in_progress_count,
        "not_started": not_started_count,
        "completion_percentage": round(completion_percentage, 2)
    }


async def update_program_status_from_content(
    db: AsyncSession,
    program_assignment_id: int
) -> None:
    """
    Update program assignment status based on its content assignments
    - If any content is IN_PROGRESS, SUBMITTED, or LATE_SUBMITTED -> Program is IN_PROGRESS
    - If all content is REVIEWED -> Program is COMPLETED
    - Otherwise -> Program is NOT_STARTED
    """
    # Flush pending changes to ensure we see the latest content assignment statuses
    await db.flush()
    
    # Get all content assignments for this program
    result = await db.execute(
        select(LearnerContentAssignment.completion_status)
        .where(LearnerContentAssignment.program_assignment_id == program_assignment_id)
    )
    content_statuses = [row[0] for row in result.all()]
    
    if not content_statuses:
        # No content assignments, keep as is
        return
    
    # Determine program status based on content statuses
    new_program_status = None
    
    # Check if all reviewed
    if all(status == ContentCompletionStatus.REVIEWED for status in content_statuses):
        new_program_status = CompletionStatus.COMPLETED
    # Check if any content is in progress or submitted
    elif any(status in [
        ContentCompletionStatus.IN_PROGRESS,
        ContentCompletionStatus.SUBMITTED,
        ContentCompletionStatus.LATE_SUBMITTED
    ] for status in content_statuses):
        new_program_status = CompletionStatus.IN_PROGRESS
    # All not started
    elif all(status == ContentCompletionStatus.NOT_STARTED for status in content_statuses):
        new_program_status = CompletionStatus.NOT_STARTED
    else:
        # Mixed states, default to IN_PROGRESS
        new_program_status = CompletionStatus.IN_PROGRESS
    
    # Update program assignment status
    if new_program_status:
        await db.execute(
            update(ProgramAssignment)
            .where(ProgramAssignment.id == program_assignment_id)
            .values(
                completion_status=new_program_status,
                completed_at=datetime.utcnow() if new_program_status == CompletionStatus.COMPLETED else None
            )
        )
        await db.commit()
