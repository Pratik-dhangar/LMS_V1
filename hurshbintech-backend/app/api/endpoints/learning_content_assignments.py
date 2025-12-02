from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_head, get_current_user
from app.crud import learning_content_assignment_crud
from app.db.session import get_db
from app.models.user_model import User
from app.schemas.learning_content_assignment import (
    ContentResponse,
    LearnerResponse,
    LearningContentAssignmentCreate,
    LearningContentAssignmentResponse,
)

router = APIRouter(prefix="/learning-content-assignments", tags=["Learning Content Assignments"])


# GET /learning-content-assignments/learners
@router.get("/learners", response_model=List[LearnerResponse])
async def get_learners(
    db: AsyncSession = Depends(get_db), current_head: User = Depends(get_current_head)
):
    """Get all learners for assignment dropdown"""
    learners = await learning_content_assignment_crud.get_all_learners(db)
    return [LearnerResponse(id=learner.id, name=learner.name) for learner in learners]


# GET /learning-content-assignments/contents
@router.get("/contents", response_model=List[ContentResponse])
async def get_contents(
    db: AsyncSession = Depends(get_db), current_head: User = Depends(get_current_head)
):
    """Get all learning contents for assignment dropdown"""
    contents = await learning_content_assignment_crud.get_all_contents(db)
    return [
        ContentResponse(
            id=content.id,
            title=content.title,
            content_type=content.content_type.value,
            file_url=content.file_url,
        )
        for content in contents
    ]


# POST /learning-content-assignments
@router.post(
    "/", response_model=LearningContentAssignmentResponse, status_code=status.HTTP_201_CREATED
)
async def create_assignment(
    assignment_data: LearningContentAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_head: User = Depends(get_current_head),
):
    """Assign learning content to a learner"""
    # Check if assignment already exists
    existing_assignments = await learning_content_assignment_crud.get_assignments_by_learner(
        db, assignment_data.learner_id
    )
    if any(
        a.learning_content_id == assignment_data.learning_content_id for a in existing_assignments
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This content is already assigned to the learner",
        )

    new_assignment = await learning_content_assignment_crud.create_assignment(
        db, assignment_data, current_head.id
    )

    # Fetch the complete assignment with relationships
    assignment = await learning_content_assignment_crud.get_assignment_by_id(db, new_assignment.id)

    return LearningContentAssignmentResponse(
        id=assignment.id,
        learner_id=assignment.learner_id,
        learner_name=assignment.learner.name,
        learning_content_id=assignment.learning_content_id,
        content_title=assignment.learning_content.title,
        content_type=assignment.learning_content.content_type.value,
        file_url=assignment.learning_content.file_url,
        assigned_by_head=assignment.assigned_by_head,
        assigned_by_name=assignment.assigned_by.name,
        assigned_at=assignment.assigned_at,
    )


# GET /learning-content-assignments/by-learner/{learner_id}
@router.get("/by-learner/{learner_id}", response_model=List[LearningContentAssignmentResponse])
async def get_assignments_by_learner(
    learner_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all assignments for a specific learner"""
    # Allow access if user is head or if learner is requesting their own assignments
    if current_user.role.value == "head" or current_user.id == learner_id:
        assignments = await learning_content_assignment_crud.get_assignments_by_learner(
            db, learner_id
        )
        return [
            LearningContentAssignmentResponse(
                id=assignment.id,
                learner_id=assignment.learner_id,
                learner_name=assignment.learner.name,
                learning_content_id=assignment.learning_content_id,
                content_title=assignment.learning_content.title,
                content_type=assignment.learning_content.content_type.value,
                file_url=assignment.learning_content.file_url,
                assigned_by_head=assignment.assigned_by_head,
                assigned_by_name=assignment.assigned_by.name,
                assigned_at=assignment.assigned_at,
            )
            for assignment in assignments
        ]
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view these assignments"
        )


# DELETE /learning-content-assignments/{id}
@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assignment(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: User = Depends(get_current_head),
):
    """Remove learning content assignment"""
    success = await learning_content_assignment_crud.delete_assignment(db, assignment_id)
    if not success:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return None
