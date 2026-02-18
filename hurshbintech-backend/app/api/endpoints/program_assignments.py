"""
Program Assignment endpoints for Head and Learner
Manages program assignments with completion tracking, notes, and attachments
"""

import logging
from datetime import date, datetime
from typing import List, Optional
import json

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select, and_
from sqlalchemy.orm import joinedload, selectinload

from app.core.deps import get_current_head, get_current_user
from app.crud import program_assignment_crud, program_assignment_attachment_crud, learner_content_assignment_crud
from app.db.session import get_db
from app.models.user_model import HeadProfile, User, UserRole
from app.models.program_assignment_model import CompletionStatus, ProgramAssignment
from app.models.program_assignment_attachment_model import AttachmentType
from app.models.learner_content_assignment_model import LearnerContentAssignment, ContentCompletionStatus
from app.models.learning_goals_model import LearningGoals
from app.schemas.program_assignment_schema import (
    ProgramAssignmentCreate,
    ProgramAssignmentUpdate,
    LearnerAssignmentUpdate,
    ProgramAssignmentResponse,
    ProgramAssignmentListResponse,
    CompletionStatsResponse,
    BulkAssignmentResult,
    AttachmentResponse,
    UserBasic,
    ProgramBasic,
    ProgramWithContents,
    LearningContentInProgram,
    LearningContentBasic,
    ContentAssignmentInProgram,
    ContentStatusUpdate,
    HeadFeedbackSubmit,
    ContentAssignmentWithFeedback,
    FinalFeedbackSubmit,
)
from app.utils.s3_utils import S3Manager
from app.core.config import settings
from pathlib import Path
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/program-assignments", tags=["Program Assignments"])

# Initialize S3 manager if S3 is enabled
s3_manager = None
if settings.USE_S3:
    try:
        s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
        logger.info("S3 manager initialized for program assignments")
    except Exception as e:
        logger.error(f"Failed to initialize S3 manager: {str(e)}")


def convert_s3_file_url(file_url: str) -> str:
    """
    Convert S3 URL (s3://bucket/key) to backend proxy URL for CORS-safe access.
    Returns local paths unchanged. Returns None/empty unchanged.
    """
    if not file_url:
        return file_url
    if file_url.startswith('http://') or file_url.startswith('https://'):
        return file_url
    if settings.USE_S3 and file_url.startswith('s3://'):
        s3_key = file_url.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
        return f"/api/content/learning-content/s3-files/{s3_key}"
    return file_url


def get_attachment_type_from_file(filename: str) -> AttachmentType:
    """Determine attachment type from filename"""
    ext = filename.lower().split('.')[-1]
    if ext in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
        return AttachmentType.IMAGE
    elif ext in ['mp4', 'avi', 'mov', 'mkv', 'webm']:
        return AttachmentType.VIDEO
    elif ext == 'pdf':
        return AttachmentType.PDF
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image, video, and PDF files are allowed"
        )


# ============= HEAD ENDPOINTS =============

@router.post("/head/assignments", response_model=BulkAssignmentResult, status_code=status.HTTP_201_CREATED)
async def create_program_assignments(
    assignment_data: ProgramAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Create program assignments for one or more learners with multiple programs in a single assignment"""
    
    print(f"\n{'='*60}")
    print(f"[ASSIGNMENT_CREATE] Received assignment data:")
    print(f"  - Learner IDs: {assignment_data.learner_ids}")
    print(f"  - Program IDs: {assignment_data.program_ids}")
    print(f"  - Extra Content IDs: {assignment_data.extra_content_ids}")
    print(f"  - Assignment Title: {assignment_data.assignment_title}")
    print(f"{'='*60}\n")
    
    success_count = 0
    failed_count = 0
    failed_learners = []
    created_assignments = []
    
    for learner_id in assignment_data.learner_ids:
        try:
            # Validate user is a learner
            from app.crud import user_crud
            user = await user_crud.get_user_by_id(db, learner_id)
            
            if not user:
                failed_count += 1
                failed_learners.append({
                    "learner_id": learner_id,
                    "learner_name": "Unknown",
                    "reason": "User not found"
                })
                continue
            
            if user.role != UserRole.LEARNER:
                failed_count += 1
                failed_learners.append({
                    "learner_id": learner_id,
                    "learner_name": user.name,
                    "reason": f"User is not a learner (role: {user.role.value})"
                })
                continue
            
            # Create ONE assignment with ALL program_ids
            # Create assignment with all programs at once
            new_assignment = await program_assignment_crud.create_assignment(
                db=db,
                learner_id=learner_id,
                program_ids=assignment_data.program_ids,  # Pass entire list
                assigned_by_head=current_head.user_id,
                assignment_title=assignment_data.assignment_title,
                start_date=assignment_data.start_date,
                end_date=assignment_data.end_date,
                duration_days=assignment_data.duration_days,
                head_notes=assignment_data.head_notes
            )
            
            # Assign manual learning contents if provided
            try:
                from app.crud import learner_content_assignment_crud
                
                # Assign extra/manual learning contents if provided
                if assignment_data.extra_content_ids and len(assignment_data.extra_content_ids) > 0:
                    print(f"[CONTENT_ASSIGNMENT] Creating {len(assignment_data.extra_content_ids)} content assignments for assignment ID {new_assignment.id}")
                    for i, content_id in enumerate(assignment_data.extra_content_ids, 1):
                        try:
                            print(f"[CONTENT_ASSIGNMENT] [{i}/{len(assignment_data.extra_content_ids)}] Processing content_id: {content_id}")
                            
                            # Check if already assigned
                            already_assigned = await learner_content_assignment_crud.check_duplicate_assignment(
                                db, learner_id, content_id
                            )
                            
                            if not already_assigned:
                                # Create the content assignment
                                created_ca = await learner_content_assignment_crud.create_assignment(
                                    db=db,
                                    learner_id=learner_id,
                                    content_id=content_id,
                                    assigned_by_head=current_head.user_id,
                                    program_assignment_id=new_assignment.id
                                )
                                print(f"[CONTENT_ASSIGNMENT] ✓ Created CA ID {created_ca.id} for content {content_id}")
                            else:
                                print(f"[CONTENT_ASSIGNMENT] ⊘ Content {content_id} already assigned to learner")
                        
                        except Exception as content_error:
                            print(f"[CONTENT_ASSIGNMENT] ✗ Error on content {content_id}: {str(content_error)}")
                            import traceback
                            traceback.print_exc()
                else:
                    print(f"[CONTENT_ASSIGNMENT] No extra_content_ids in request")
                        
            except Exception as content_error:
                print(f"[CONTENT_ASSIGNMENT] Block error: {str(content_error)}")
                import traceback
                traceback.print_exc()
            
            success_count += 1
            created_assignments.append(new_assignment.id)
            
        except Exception as e:
            logger.error(f"Failed to create assignments for learner {learner_id}: {str(e)}")
            failed_count += 1
            failed_learners.append({
                "learner_id": learner_id,
                "learner_name": "Unknown",
                "reason": str(e)
            })
    
    return BulkAssignmentResult(
        success_count=success_count,
        failed_count=failed_count,
        failed_learners=failed_learners,
        created_assignments=created_assignments
    )


@router.get("/head/assignments/overview")
async def get_assignments_overview(
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Get overview of all assignments grouped by learner"""
    
    try:
        logger.info(f"Fetching assignments overview for head {current_head.user_id}")
        
        assignments = await program_assignment_crud.get_assignments(
            db=db,
            assigned_by_head=current_head.user_id
        )
        
        logger.info(f"Found {len(assignments)} assignments")
        
        # Group by learner
        overview = {}
        for a in assignments:
            learner_id = a.learner_id
            if learner_id not in overview:
                overview[learner_id] = {
                    "learner_id": learner_id,
                    "learner_name": a.learner.name,
                    "learner_email": a.learner.email,
                    "total_assignments": 0,
                    "completed": 0,
                    "in_progress": 0,
                    "not_started": 0,
                    "completion_percentage": 0,
                    "assignments": []
                }
            
            overview[learner_id]["total_assignments"] += 1
            if a.completion_status == "COMPLETED":
                overview[learner_id]["completed"] += 1
            elif a.completion_status == "IN_PROGRESS":
                overview[learner_id]["in_progress"] += 1
            else:
                overview[learner_id]["not_started"] += 1
            
            overview[learner_id]["assignments"].append({
                "id": a.id,
                "program_name": a.assignment_title,
                "status": a.completion_status,
                "start_date": a.start_date.isoformat() if a.start_date else None,
                "end_date": a.end_date.isoformat() if a.end_date else None,
            })
        
        # Calculate percentages
        for learner_id in overview:
            total = overview[learner_id]["total_assignments"]
            if total > 0:
                overview[learner_id]["completion_percentage"] = round(
                    (overview[learner_id]["completed"] / total) * 100
                )
        
        logger.info(f"Returning overview for {len(overview)} learners")
        result = list(overview.values())
        for learner_overview in result:
            logger.info(f"  - Learner {learner_overview['learner_id']} ({learner_overview['learner_name']}, {learner_overview['learner_email']}): {learner_overview['total_assignments']} assignments")
        return result
    
    except Exception as e:
        logger.error(f"Error in get_assignments_overview: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch overview: {str(e)}"
        )


@router.get("/head/assignments", response_model=List[ProgramAssignmentListResponse])
async def get_program_assignments(
    learner_id: Optional[int] = None,
    status: Optional[CompletionStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Get program assignments with optional filters"""
    
    assignments = await program_assignment_crud.get_assignments(
        db=db,
        learner_id=learner_id,
        status=status,
        assigned_by_head=current_head.user_id
    )
    
    return [
        ProgramAssignmentListResponse(
            id=a.id,
            learner_id=a.learner_id,
            learner_name=a.learner.name,
            program_ids=a.program_ids,
            program_id=a.program_ids[0] if a.program_ids else None,
            program_name=a.assignment_title,
            assignment_title=a.assignment_title,
            start_date=a.start_date,
            end_date=a.end_date,
            duration_days=a.duration_days,
            completion_status=a.completion_status,
            completed_at=a.completed_at,
            assigned_at=a.assigned_at
        )
        for a in assignments
    ]


@router.get("/head/assignments/{assignment_id}", response_model=ProgramAssignmentResponse)
async def get_assignment_details(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Get assignment with ALL programs and ALL contents independent - no nesting"""
    from app.models.learning_content_model import LearningContent
    from app.models.learning_goals_model import LearningGoals
    
    assignment = await program_assignment_crud.get_assignment_by_id(db, assignment_id)
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Verify assignment belongs to current head
    if assignment.assigned_by_head != current_head.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this assignment"
        )
    
    # Get ALL assignments with same assignment_title and learner
    all_assignments_result = await db.execute(
        select(ProgramAssignment)
        .options(
            selectinload(ProgramAssignment.content_assignments).selectinload(LearnerContentAssignment.content)
        )
        .where(
            and_(
                ProgramAssignment.assignment_title == assignment.assignment_title,
                ProgramAssignment.learner_id == assignment.learner_id,
                ProgramAssignment.assigned_by_head == current_head.user_id
            )
        )
    )
    all_assignments = all_assignments_result.unique().scalars().all()
    
    # Collect ALL CONTENTS (independent - no program grouping)
    content_assignments_list = []
    seen_content_ids = set()
    
    # Get ALL content assignments for this program assignment (direct query)
    try:
        print(f"\n[FETCH_ASSIGNMENT] Querying content assignments for assignment_id: {assignment_id}")
        content_query = await db.execute(
            select(LearnerContentAssignment)
            .options(selectinload(LearnerContentAssignment.content))
            .where(LearnerContentAssignment.program_assignment_id == assignment_id)
        )
        all_content_assignments = content_query.unique().scalars().all()
        print(f"[FETCH_ASSIGNMENT] Found {len(all_content_assignments)} content assignments in DB")
        
        for ca in all_content_assignments:
            print(f"[FETCH_ASSIGNMENT] - CA ID {ca.id}: content_id={ca.content_id}, has_content={ca.content is not None}")
            if ca.content and ca.content_id not in seen_content_ids:
                seen_content_ids.add(ca.content_id)
                completion_status = ca.completion_status if hasattr(ca, 'completion_status') else ContentCompletionStatus.NEW.value
                
                content_assignments_list.append(
                    ContentAssignmentInProgram(
                        id=ca.id,
                        content_id=ca.content_id,
                        learning_content=LearningContentBasic(
                            id=ca.content.id,
                            title=ca.content.title,
                            description=ca.content.description,
                            content_type=ca.content.content_type.value,
                            file_url=convert_s3_file_url(ca.content.file_url) if hasattr(ca.content, 'file_url') else None,
                            thumbnail_url=convert_s3_file_url(ca.content.thumbnail_url) if hasattr(ca.content, 'thumbnail_url') else None,
                        ),
                        completion_status=completion_status,
                        assigned_at=ca.assigned_at,
                        started_at=ca.started_at if hasattr(ca, 'started_at') else None,
                        submitted_at=ca.submitted_at if hasattr(ca, 'submitted_at') else None,
                        reviewed_at=ca.reviewed_at if hasattr(ca, 'reviewed_at') else None,
                        reviewed_by_head=ca.reviewed_by_head if hasattr(ca, 'reviewed_by_head') else None
                    )
                )
        print(f"[FETCH_ASSIGNMENT] Total content assignments in response: {len(content_assignments_list)}\n")
    except Exception as e:
        print(f"[FETCH_ASSIGNMENT] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
    
    # Fetch program names/goals for display
    program_goals = []
    if assignment.program_ids and len(assignment.program_ids) > 0:
        try:
            programs_result = await db.execute(
                select(LearningGoals).where(LearningGoals.id.in_(assignment.program_ids))
            )
            programs = programs_result.scalars().all()
            program_goals = [p.goal for p in programs] if programs else []
        except Exception as e:
            print(f"Error fetching program goals: {e}")
            program_goals = []
    
    # Return response - program_ids contains all programs, contents are independent
    # All contents go in content_assignments (independent list)
    
    return ProgramAssignmentResponse(
        id=assignment.id,
        learner_id=assignment.learner_id,
        learner=UserBasic(
            id=assignment.learner.id,
            name=assignment.learner.name,
            email=assignment.learner.email
        ),
        program_ids=assignment.program_ids,  # List of program IDs
        program_names=program_goals,  # NEW: List of program goal names
        program=ProgramWithContents(
            id=assignment.program_ids[0] if assignment.program_ids else 0,  # Use first program ID
            goal=program_goals[0] if program_goals else "",  # First program goal
            goal_description="",
            contents=[]  # Empty - programs and contents are SEPARATE
        ),
        assignment_title=assignment.assignment_title,
        assigned_by_head=assignment.assigned_by_head,
        assigned_by=UserBasic(
            id=assignment.assigned_by.id,
            name=assignment.assigned_by.name,
            email=assignment.assigned_by.email
        ) if assignment.assigned_by else None,
        start_date=assignment.start_date,
        end_date=assignment.end_date,
        duration_days=assignment.duration_days,
        head_notes=assignment.head_notes,
        learner_notes=assignment.learner_notes,
        completion_status=assignment.completion_status,
        completed_at=assignment.completed_at,
        notification_sent=assignment.notification_sent,
        assigned_at=assignment.assigned_at,
        updated_at=assignment.updated_at,
        final_feedback_rating=assignment.final_feedback_rating if hasattr(assignment, 'final_feedback_rating') else None,
        final_feedback_remarks=assignment.final_feedback_remarks if hasattr(assignment, 'final_feedback_remarks') else None,
        final_feedback_given_at=assignment.final_feedback_given_at if hasattr(assignment, 'final_feedback_given_at') else None,
        is_overdue=False,  # Can be calculated if needed
        is_late_submission=False,  # Can be calculated if needed
        content_assignments=content_assignments_list
    )


@router.get("/head/programs/{program_id}/contents", response_model=List[LearningContentInProgram])
async def get_program_contents_for_head(
    program_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Get learning contents for a program (accessible by Head)"""
    from app.crud import program_learning_content_crud
    
    contents = await program_learning_content_crud.get_program_contents(db, program_id)
    
    return [
        LearningContentInProgram(
            id=pc.content.id,
            title=pc.content.title,
            description=pc.content.description,
            content_type=pc.content.content_type.value,
            file_url=convert_s3_file_url(pc.content.file_url),
            thumbnail_url=convert_s3_file_url(pc.content.thumbnail_url),
            sequence_order=pc.sequence_order
        )
        for pc in contents
    ]


@router.get("/head/assignments/stats/{learner_id}", response_model=CompletionStatsResponse)
async def get_learner_completion_stats(
    learner_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Get completion statistics for a specific learner"""
    
    stats = await program_assignment_crud.get_learner_completion_stats(db, learner_id)
    return CompletionStatsResponse(**stats)


@router.patch("/head/assignments/{assignment_id}", response_model=ProgramAssignmentResponse)
async def update_assignment(
    assignment_id: int,
    update_data: ProgramAssignmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Update assignment (Head can update all fields including programs and extra content)"""
    
    assignment = await program_assignment_crud.get_assignment_by_id(db, assignment_id)
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    if assignment.assigned_by_head != current_head.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this assignment"
        )
    
    # Extract extra_content_ids before converting to dict
    extra_content_ids = update_data.extra_content_ids if hasattr(update_data, 'extra_content_ids') else None
    
    # Convert to dict and remove None values
    update_dict = update_data.model_dump(exclude_unset=True)
    
    # Remove extra_content_ids from update_dict since it's not a model field
    if 'extra_content_ids' in update_dict:
        del update_dict['extra_content_ids']
    
    # Update the assignment fields
    updated_assignment = await program_assignment_crud.update_assignment(
        db, assignment_id, update_dict
    )
    
    # Handle extra_content_ids if provided
    if extra_content_ids is not None:
        # Get existing content IDs for this assignment
        existing_query = await db.execute(
            select(LearnerContentAssignment.content_id).where(
                LearnerContentAssignment.program_assignment_id == assignment_id
            )
        )
        existing_content_ids = set(existing_query.scalars().all())
        
        # Add new content assignments (append, don't delete)
        if extra_content_ids and len(extra_content_ids) > 0:
            for content_id in extra_content_ids:
                # Skip if already assigned to this program_assignment
                if content_id not in existing_content_ids:
                    try:
                        # Check if already assigned to learner (for any program_assignment)
                        already_assigned = await learner_content_assignment_crud.check_duplicate_assignment(
                            db, assignment.learner_id, content_id
                        )
                        
                        if not already_assigned:
                            await learner_content_assignment_crud.create_assignment(
                                db=db,
                                learner_id=assignment.learner_id,
                                content_id=content_id,
                                assigned_by_head=current_head.user_id,
                                program_assignment_id=assignment_id
                            )
                    except Exception as e:
                        print(f"Error creating content assignment for content {content_id}: {e}")
                        # Continue with other contents instead of failing entirely
    
    # Reload with relationships for response
    updated_assignment = await program_assignment_crud.get_assignment_by_id(db, assignment_id)
    
    # Get program names for program_names list
    program_names = []
    if updated_assignment.program_ids:
        try:
            from app.models.learning_goals_model import LearningGoals
            programs_result = await db.execute(
                select(LearningGoals).where(LearningGoals.id.in_(updated_assignment.program_ids))
            )
            programs = programs_result.scalars().all()
            program_names = [p.goal for p in programs] if programs else []
        except Exception as e:
            print(f"Error fetching program names: {e}")
            program_names = []
    
    # Fetch content assignments with proper relationships
    content_assignments_list = []
    try:
        from app.models.learning_content_model import LearningContent
        content_query = await db.execute(
            select(LearnerContentAssignment)
            .options(selectinload(LearnerContentAssignment.content))
            .where(LearnerContentAssignment.program_assignment_id == assignment_id)
        )
        all_content_assignments = content_query.unique().scalars().all()
        
        # Build content_assignments_list
        for ca in all_content_assignments:
            if ca.content:
                content_assignments_list.append(
                    ContentAssignmentInProgram(
                        id=ca.id,
                        content_id=ca.content_id,
                        content_title=ca.content.title if hasattr(ca.content, 'title') else "",
                        content_type=ca.content.content_type.value if hasattr(ca.content, 'content_type') else "unknown",
                        completion_status=ca.completion_status if hasattr(ca, 'completion_status') else ContentCompletionStatus.NEW.value,
                        file_url=convert_s3_file_url(ca.content.file_url) if hasattr(ca.content, 'file_url') else None,
                    )
                )
    except Exception as e:
        print(f"Error fetching content assignments: {e}")
        content_assignments_list = []
    
    # Extract extra_content_ids from content_assignments
    extra_content_ids_response = [ca.content_id for ca in content_assignments_list]
    
    return ProgramAssignmentResponse(
        id=updated_assignment.id,
        learner_id=updated_assignment.learner_id,
        learner=UserBasic(
            id=updated_assignment.learner.id,
            name=updated_assignment.learner.name,
            email=updated_assignment.learner.email
        ),
        program_ids=updated_assignment.program_ids,  # List of program IDs
        program_names=program_names,  # List of program names
        program=ProgramWithContents(
            id=updated_assignment.program_ids[0] if updated_assignment.program_ids else 0,
            goal="",
            goal_description="",
            contents=[]
        ),
        assignment_title=updated_assignment.assignment_title,
        assigned_by_head=updated_assignment.assigned_by_head,
        assigned_by=UserBasic(
            id=updated_assignment.assigned_by.id,
            name=updated_assignment.assigned_by.name,
            email=updated_assignment.assigned_by.email
        ) if updated_assignment.assigned_by else None,
        start_date=updated_assignment.start_date,
        end_date=updated_assignment.end_date,
        duration_days=updated_assignment.duration_days,
        head_notes=updated_assignment.head_notes,
        learner_notes=updated_assignment.learner_notes,
        completion_status=updated_assignment.completion_status,
        completed_at=updated_assignment.completed_at,
        final_feedback_rating=updated_assignment.final_feedback_rating,
        final_feedback_remarks=updated_assignment.final_feedback_remarks,
        final_feedback_given_at=updated_assignment.final_feedback_given_at,
        notification_sent=updated_assignment.notification_sent,
        assigned_at=updated_assignment.assigned_at,
        updated_at=updated_assignment.updated_at,
        is_overdue=False,
        is_late_submission=False,
        content_assignments=content_assignments_list,
        extra_content_ids=extra_content_ids_response
    )


@router.delete("/head/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assignment(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Delete an assignment and all associated content assignments"""
    
    assignment = await program_assignment_crud.get_assignment_by_id(db, assignment_id)
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    if assignment.assigned_by_head != current_head.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this assignment"
        )
    
    # Delete all associated learner content assignments (both auto and manual)
    # Delete all content assignments for this program assignment
    await db.execute(
        delete(LearnerContentAssignment).where(
            LearnerContentAssignment.program_assignment_id == assignment_id
        )
    )
    await db.commit()
    logger.info(f"Deleted all content assignments for program assignment {assignment_id}")
    
    # Now delete the program assignment itself
    await program_assignment_crud.delete_assignment(db, assignment_id)
    logger.info(f"Deleted program assignment {assignment_id}")
    
    return None


@router.post("/head/assignments/{assignment_id}/final-feedback")
async def submit_final_feedback(
    assignment_id: int,
    feedback: FinalFeedbackSubmit,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Submit final feedback (rating and remarks) for a completed program assignment"""
    from sqlalchemy import select
    
    # Get the assignment
    result = await db.execute(
        select(ProgramAssignment).where(ProgramAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    # Verify the head is authorized
    if assignment.assigned_by_head != current_head.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to provide feedback for this assignment"
        )
    
    # Update feedback fields
    assignment.final_feedback_rating = feedback.rating
    assignment.final_feedback_remarks = feedback.remarks
    assignment.final_feedback_given_at = datetime.utcnow()
    
    # Update completion status if provided
    if feedback.completion_status:
        valid_statuses = ['NEW', 'IN_PROGRESS', 'COMPLETED']
        if feedback.completion_status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid completion_status. Must be one of: {', '.join(valid_statuses)}"
            )
        assignment.completion_status = feedback.completion_status
    
    await db.commit()
    await db.refresh(assignment)
    
    logger.info(f"Final feedback submitted for assignment {assignment_id} by head {current_head.user_id}")
    
    # Simply return the basic data
    return {
        "id": assignment.id,
        "message": "Feedback submitted successfully"
    }


@router.post("/head/assignments/{assignment_id}/attachments", response_model=AttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    assignment_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Upload an attachment to an assignment (Head)"""
    
    assignment = await program_assignment_crud.get_assignment_by_id(db, assignment_id)
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    if assignment.assigned_by_head != current_head.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to upload to this assignment"
        )
    
    # Determine file type
    file_type = get_attachment_type_from_file(file.filename)
    
    # Read file content
    file_content = await file.read()
    file_size = len(file_content)
    
    # Validate file size (500MB for video, 50MB for others)
    max_size = 500 * 1024 * 1024 if file_type == AttachmentType.VIDEO else 50 * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds {max_size / (1024*1024):.0f}MB limit"
        )
    
    # Upload file to S3 or local storage
    file_path = None
    thumbnail_url = None
    
    if settings.USE_S3 and s3_manager:
        try:
            # Upload main file
            s3_key = s3_manager.upload_file(
                file_content=file_content,
                folder="program-assignments",
                filename=file.filename,
                content_type=file.content_type or "application/octet-stream"
            )
            file_path = s3_manager.get_public_url(s3_key)
            
            # Generate thumbnail for images and videos
            if file_type in [AttachmentType.IMAGE, AttachmentType.VIDEO]:
                try:
                    thumbnail_content = s3_manager.generate_thumbnail(
                        file_content,
                        file_type.value.lower()
                    )
                    if thumbnail_content:
                        thumbnail_key = s3_manager.upload_file(
                            file_content=thumbnail_content,
                            folder="program-assignments/thumbnails",
                            filename=f"thumb_{file.filename}",
                            content_type="image/jpeg"
                        )
                        thumbnail_url = s3_manager.get_public_url(thumbnail_key)
                except Exception as e:
                    logger.warning(f"Failed to generate thumbnail: {str(e)}")
        
        except Exception as e:
            logger.error(f"Failed to upload to S3: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload file"
            )
    else:
        # Local storage fallback
        try:
            upload_dir = Path("uploads/program-assignments")
            upload_dir.mkdir(parents=True, exist_ok=True)

            unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
            local_path = upload_dir / unique_filename
            with open(local_path, "wb") as f:
                f.write(file_content)

            # Public path served by static files (nginx or backend static route)
            file_path = f"/uploads/program-assignments/{unique_filename}"

            # Generate thumbnail for images/videos (Head endpoint)
            if file_type in [AttachmentType.IMAGE, AttachmentType.VIDEO]:
                try:
                    # Use PIL directly for local thumbnail generation without AWS
                    from PIL import Image
                    import io
                    
                    img = Image.open(io.BytesIO(file_content))
                    img.thumbnail((300, 300))
                    thumb_buffer = io.BytesIO()
                    img.save(thumb_buffer, format='JPEG', quality=85)
                    thumbnail_content = thumb_buffer.getvalue()
                    
                    if thumbnail_content:
                        thumb_dir = Path("uploads/program-assignments/thumbnails")
                        thumb_dir.mkdir(parents=True, exist_ok=True)
                        thumb_filename = f"thumb_{uuid.uuid4().hex}.jpg"
                        thumb_path = thumb_dir / thumb_filename
                        with open(thumb_path, "wb") as tf:
                            tf.write(thumbnail_content)
                        thumbnail_url = f"/uploads/program-assignments/thumbnails/{thumb_filename}"
                except Exception as e:
                    logger.warning(f"Failed to generate local thumbnail: {str(e)}")

        except Exception as e:
            logger.error(f"Failed to save file locally: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save file locally"
            )
    
    # Create attachment record
    attachment = await program_assignment_attachment_crud.create_attachment(
        db=db,
        assignment_id=assignment_id,
        uploaded_by=current_head.user_id,
        file_name=file.filename,
        file_path=file_path,
        file_type=file_type,
        file_size=file_size,
        thumbnail_url=thumbnail_url,
        description=description
    )
    
    return AttachmentResponse(
        id=attachment.id,
        assignment_id=attachment.assignment_id,
        uploaded_by=attachment.uploaded_by,
        uploader_name=attachment.uploader.name if attachment.uploader else None,
        file_name=attachment.file_name,
        file_path=attachment.file_path,
        file_type=attachment.file_type,
        file_size=attachment.file_size,
        thumbnail_url=attachment.thumbnail_url,
        description=attachment.description,
        uploaded_at=attachment.uploaded_at
    )


# ============= CONTENT ASSIGNMENT STATUS ENDPOINTS =============

@router.patch("/content-assignments/{content_assignment_id}/start")
async def start_content(
    content_assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark content as started by learner"""
    from sqlalchemy import select, update
    
    # Get the content assignment
    result = await db.execute(
        select(LearnerContentAssignment)
        .where(LearnerContentAssignment.id == content_assignment_id)
    )
    content_assignment = result.scalar_one_or_none()
    
    if not content_assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content assignment not found"
        )
    
    # Verify user is the learner
    if content_assignment.learner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this content"
        )
    
    # Update status to IN_PROGRESS
    await db.execute(
        update(LearnerContentAssignment)
        .where(LearnerContentAssignment.id == content_assignment_id)
        .values(
            completion_status=ContentCompletionStatus.IN_PROGRESS.value,
            started_at=datetime.utcnow()
        )
    )
    
    # Update program assignment status if this content belongs to a program
    if content_assignment.program_assignment_id:
        await program_assignment_crud.update_program_status_from_content(
            db, content_assignment.program_assignment_id
        )
    else:
        # If no program assignment, just commit the content status change
        await db.commit()
    
    return {"message": "Content started", "status": "IN_PROGRESS"}


@router.patch("/content-assignments/{content_assignment_id}/submit")
async def submit_content(
    content_assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit content assignment (checks if late)"""
    from sqlalchemy import select, update
    from sqlalchemy.orm import joinedload
    
    try:
        # Get the content assignment with program assignment
        result = await db.execute(
            select(LearnerContentAssignment)
            .options(joinedload(LearnerContentAssignment.program_assignment))
            .where(LearnerContentAssignment.id == content_assignment_id)
        )
        content_assignment = result.scalar_one_or_none()
        
        if not content_assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content assignment not found"
            )
        
        # Verify user is the learner
        if content_assignment.learner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this content"
            )
        
        # Check if submission is late
        now = datetime.utcnow()
        is_late = False
        
        if content_assignment.program_assignment and content_assignment.program_assignment.end_date:
            try:
                end_date = content_assignment.program_assignment.end_date
                # Convert date to datetime for comparison
                end_datetime = datetime.combine(end_date, datetime.max.time())
                is_late = now > end_datetime
            except Exception as date_error:
                logger.warning(f"Could not determine if submission is late: {str(date_error)}")
                is_late = False
        
        new_status = ContentCompletionStatus.LATE_SUBMITTED.value if is_late else ContentCompletionStatus.SUBMITTED.value
        
        # Update status
        await db.execute(
            update(LearnerContentAssignment)
            .where(LearnerContentAssignment.id == content_assignment_id)
            .values(
                completion_status=new_status,
                submitted_at=now
            )
        )
        
        # Update program assignment status if this content belongs to a program
        if content_assignment.program_assignment_id:
            await program_assignment_crud.update_program_status_from_content(
                db, content_assignment.program_assignment_id
            )
        else:
            # If no program assignment, just commit the content status change
            await db.commit()
        
        return {
            "message": "Content submitted",
            "status": new_status.value,
            "is_late": is_late
        }
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        import traceback
        logger.error(f"Error in submit_content: {str(e)}")
        logger.error(traceback.format_exc())
        print(f"Error in submit_content: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit content: {str(e)}"
        )


@router.patch("/head/content-assignments/{content_assignment_id}/review")


@router.patch("/head/content-assignments/{content_assignment_id}/review")
async def review_content(
    content_assignment_id: int,
    feedback_data: HeadFeedbackSubmit,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Submit feedback and rating on content assignment"""
    from sqlalchemy import select, update
    
    # Get the content assignment
    result = await db.execute(
        select(LearnerContentAssignment)
        .where(LearnerContentAssignment.id == content_assignment_id)
    )
    content_assignment = result.scalar_one_or_none()
    
    if not content_assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content assignment not found"
        )
    
    # Verify the head assigned this content or its program
    if content_assignment.assigned_by_head != current_head.user_id:
        # Check if it's from a program assignment by this head
        if content_assignment.program_assignment:
            if content_assignment.program_assignment.assigned_by_head != current_head.user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to review this content"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to review this content"
            )
    
    # Validate rating
    if not (1 <= feedback_data.rating <= 5):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rating must be between 1 and 5"
        )
    
    # Prepare feedback history entry if feedback was previously given
    feedback_history = []
    if content_assignment.feedback_history:
        try:
            feedback_history = json.loads(content_assignment.feedback_history)
        except (json.JSONDecodeError, TypeError):
            feedback_history = []
    
    # If updating existing feedback, add previous feedback to history
    if content_assignment.head_feedback_text or content_assignment.head_rating:
        feedback_history.append({
            "feedback_text": content_assignment.head_feedback_text,
            "rating": content_assignment.head_rating,
            "feedback_given_at": content_assignment.feedback_given_at.isoformat() if content_assignment.feedback_given_at else None,
            "updated_at": datetime.utcnow().isoformat()
        })
    
    # Update status to REVIEWED with new feedback
    await db.execute(
        update(LearnerContentAssignment)
        .where(LearnerContentAssignment.id == content_assignment_id)
        .values(
            completion_status=ContentCompletionStatus.REVIEWED.value,
            reviewed_at=datetime.utcnow(),
            reviewed_by_head=current_head.user_id,
            head_feedback_text=feedback_data.feedback_text,
            head_rating=feedback_data.rating,
            feedback_given_at=datetime.utcnow(),
            feedback_history=json.dumps(feedback_history)
        )
    )
    await db.commit()
    
    # Update program assignment status if this content belongs to a program
    if content_assignment.program_assignment_id:
        await program_assignment_crud.update_program_status_from_content(
            db, content_assignment.program_assignment_id
        )
    
    return {
        "message": "Feedback submitted successfully",
        "status": "REVIEWED",
        "feedback_text": feedback_data.feedback_text,
        "rating": feedback_data.rating,
        "feedback_given_at": datetime.utcnow().isoformat()
    }

@router.patch("/learner/content-assignments/{content_assignment_id}/resubmit")
async def resubmit_content(
    content_assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Learner resubmits content after RESUBMISSION_REQUIRED status"""
    from sqlalchemy import select, update
    
    # Get the content assignment
    result = await db.execute(
        select(LearnerContentAssignment)
        .where(LearnerContentAssignment.id == content_assignment_id)
    )
    content_assignment = result.scalar_one_or_none()
    
    if not content_assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content assignment not found"
        )
    
    # Verify learner ownership
    if content_assignment.learner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to resubmit this content"
        )
    
    # Verify status is RESUBMISSION_REQUIRED and resubmit is allowed
    if content_assignment.completion_status != ContentCompletionStatus.RESUBMISSION_REQUIRED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Content is not in RESUBMISSION_REQUIRED status (current: {content_assignment.completion_status})"
        )
    
    if not content_assignment.resubmit_allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Resubmission is not allowed for this assignment"
        )
    
    # Reset status to SUBMITTED (clear feedback)
    await db.execute(
        update(LearnerContentAssignment)
        .where(LearnerContentAssignment.id == content_assignment_id)
        .values(
            completion_status=ContentCompletionStatus.SUBMITTED.value,
            submitted_at=datetime.utcnow(),
            # Keep feedback history but clear current feedback
            # Note: feedback_text and head_rating remain in history
        )
    )
    await db.commit()
    
    return {
        "message": "Content resubmitted successfully",
        "status": "SUBMITTED",
        "submitted_at": datetime.utcnow().isoformat()
    }

@router.get("/head/assignments/{assignment_id}/attachments", response_model=List[AttachmentResponse])
async def get_attachments(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Get all attachments for an assignment"""
    
    assignment = await program_assignment_crud.get_assignment_by_id(db, assignment_id)
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    if assignment.assigned_by_head != current_head.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this assignment"
        )
    
    attachments = await program_assignment_attachment_crud.get_attachments_by_assignment(
        db, assignment_id
    )
    
    return [
        AttachmentResponse(
            id=att.id,
            assignment_id=att.assignment_id,
            uploaded_by=att.uploaded_by,
            uploader_name=att.uploader.name if att.uploader else None,
            file_name=att.file_name,
            file_path=att.file_path,
            file_type=att.file_type,
            file_size=att.file_size,
            thumbnail_url=att.thumbnail_url,
            description=att.description,
            uploaded_at=att.uploaded_at
        )
        for att in attachments
    ]


@router.delete("/head/assignments/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Delete an attachment"""
    
    attachment = await program_assignment_attachment_crud.get_attachment_by_id(db, attachment_id)
    
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attachment not found"
        )
    
    # Get assignment to verify ownership
    assignment = await program_assignment_crud.get_assignment_by_id(db, attachment.assignment_id)
    
    if not assignment or assignment.assigned_by_head != current_head.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this attachment"
        )
    
    await program_assignment_attachment_crud.delete_attachment(db, attachment_id)
    return None


# ============= LEARNER ENDPOINTS =============

@router.get("/learner/assignments", response_model=List[ProgramAssignmentListResponse])
async def get_my_assignments(
    status: Optional[CompletionStatus] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get my program assignments"""
    
    if current_user.role != UserRole.LEARNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only learners can access this endpoint"
        )
    
    logger.info(f"Fetching assignments for learner {current_user.id} (name: {current_user.name}, email: {current_user.email})")
    
    assignments = await program_assignment_crud.get_assignments(
        db=db,
        learner_id=current_user.id,
        status=status
    )
    
    logger.info(f"Found {len(assignments)} assignments for learner {current_user.id} ({current_user.name})")
    
    if len(assignments) == 0:
        logger.warning(f"Learner {current_user.id} ({current_user.name}) has no assignments - check if assignments exist in database for this learner")
    
    today = date.today()
    result = []
    for a in assignments:
        # Calculate if assignment is overdue
        is_overdue = today > a.end_date
        
        # Check if submission is late
        is_late_submission = False
        if a.completed_at:
            completion_date = a.completed_at.date() if isinstance(a.completed_at, datetime) else a.completed_at
            is_late_submission = completion_date > a.end_date
        
        # Calculate completion percentage based on content assignments
        total_contents = len(a.content_assignments) if a.content_assignments else 0
        completed_contents = 0
        
        if total_contents > 0:
            for ca in a.content_assignments:
                if ca.completion_status in [ContentCompletionStatus.SUBMITTED.value, ContentCompletionStatus.REVIEWED.value]:
                    completed_contents += 1
        
        completion_percentage = (completed_contents / total_contents * 100) if total_contents > 0 else 0.0
        
        # Build content assignments list
        content_assignments_list = []
        if a.content_assignments:
            for ca in a.content_assignments:
                try:
                    # Convert content_type enum to string value
                    content_type_str = ca.content.content_type.value if hasattr(ca.content.content_type, 'value') else str(ca.content.content_type)
                    
                    content_assignments_list.append(
                        ContentAssignmentInProgram(
                            id=ca.id,
                            content_id=ca.content_id,
                            learning_content=LearningContentBasic(
                                id=ca.content.id,
                                title=ca.content.title,
                                description=ca.content.description,
                                content_type=content_type_str,
                                file_url=ca.content.file_url,
                                thumbnail_url=ca.content.thumbnail_url,
                            ),
                            completion_status=ca.completion_status,
                            assigned_at=ca.assigned_at,
                            started_at=ca.started_at,
                            submitted_at=ca.submitted_at,
                            reviewed_at=ca.reviewed_at,
                            reviewed_by_head=ca.reviewed_by_head,
                        )
                    )
                except Exception as e:
                    logger.error(f"Error building content assignment {ca.id}: {str(e)}")
                    continue
        
        # Get first program name for display (from program_ids list)
        program_name = "Unknown Program"
        program_names = []
        if a.program_ids and len(a.program_ids) > 0:
            # Fetch program names from LearningGoals
            try:
                programs_result = await db.execute(
                    select(LearningGoals.goal)
                    .where(LearningGoals.id.in_(a.program_ids))
                    .order_by(LearningGoals.id)
                )
                program_names = [name[0] for name in programs_result.fetchall()]
                program_name = program_names[0] if program_names else (a.assignment_title or "Program Assignment")
            except Exception as e:
                logger.error(f"Error fetching program names for assignment {a.id}: {str(e)}")
                program_name = a.assignment_title or "Program Assignment"
        
        result.append(
            ProgramAssignmentListResponse(
                id=a.id,
                learner_id=a.learner_id,
                learner_name=a.learner.name if a.learner else "Unknown",
                program_ids=a.program_ids,  # List of program IDs
                program_id=a.program_ids[0] if a.program_ids else None,  # First program ID for backward compatibility
                program_name=program_name,
                program_names=program_names,  # NEW: List of program names
                assignment_title=a.assignment_title,
                start_date=a.start_date,
                end_date=a.end_date,
                duration_days=a.duration_days,
                completion_status=a.completion_status,
                completed_at=a.completed_at,
                assigned_at=a.assigned_at,
                is_overdue=is_overdue,
                is_late_submission=is_late_submission,
                completion_percentage=round(completion_percentage, 1),
                final_feedback_rating=a.final_feedback_rating,
                final_feedback_remarks=a.final_feedback_remarks,
                final_feedback_given_at=a.final_feedback_given_at,
                content_assignments=content_assignments_list,
            )
        )
    
    return result


@router.get("/learner/my-learning-contents")
async def get_my_learning_contents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all learning contents assigned to the current learner"""
    
    if current_user.role != UserRole.LEARNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only learners can access this endpoint"
        )
    
    from app.crud import learner_content_assignment_crud
    
    try:
        # Get all content assignments for this learner
        assignments = await learner_content_assignment_crud.get_assignments_by_learner(db, current_user.id)
        logger.info(f"Found {len(assignments)} content assignments for learner {current_user.id}")
        
        # Convert S3 URLs to public URLs (no expiration, accessible to all users)
        result = []
        for assignment in assignments:
            try:
                content = assignment.content
                file_url = content.file_url
                thumbnail_url = content.thumbnail_url
                
                # Convert S3 URLs to public HTTP URLs (permanent access)
                if settings.USE_S3 and s3_manager:
                    if file_url and file_url.startswith("s3://"):
                        s3_key = file_url.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
                        try:
                            file_url = s3_manager.get_public_url(s3_key)
                        except Exception as e:
                            logger.warning(f"Failed to get public URL for {s3_key}: {str(e)}")
                    
                    if thumbnail_url and thumbnail_url.startswith("s3://"):
                        s3_key = thumbnail_url.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
                        try:
                            thumbnail_url = s3_manager.get_public_url(s3_key)
                        except Exception as e:
                            logger.warning(f"Failed to get public URL for thumbnail {s3_key}: {str(e)}")
                
                content_type_str = content.content_type.value if hasattr(content.content_type, 'value') else str(content.content_type)
                
                completion_status_str = assignment.completion_status if isinstance(assignment.completion_status, str) else str(assignment.completion_status)
                
                # Get program title if this content is part of a program
                program_title = None
                try:
                    if assignment.program_assignment and assignment.program_assignment.program:
                        program_title = assignment.program_assignment.program.title
                except Exception:
                    pass  # If we can't access the program, just leave it as None
                
                result.append({
                    "id": content.id,
                    "content_assignment_id": assignment.id,  # ID of the LearnerContentAssignment
                    "title": content.title,
                    "description": content.description,
                    "content_type": content_type_str,
                    "file_url": file_url,
                    "thumbnail_url": thumbnail_url,
                    "completion_status": completion_status_str,
                    "started_at": assignment.started_at.isoformat() if assignment.started_at and hasattr(assignment.started_at, 'isoformat') else None,
                    "submitted_at": assignment.submitted_at.isoformat() if assignment.submitted_at and hasattr(assignment.submitted_at, 'isoformat') else None,
                    "assigned_at": assignment.assigned_at.isoformat() if hasattr(assignment.assigned_at, 'isoformat') else str(assignment.assigned_at),
                    "assigned_by": assignment.assigned_by.name if assignment.assigned_by else None,
                    "from_program": assignment.program_assignment_id is not None,
                    "program_assignment_id": assignment.program_assignment_id,
                    "program_title": program_title
                })
            except Exception as e:
                logger.error(f"Error processing content assignment {assignment.id}: {str(e)}")
                continue
        
        logger.info(f"Returning {len(result)} learning contents for learner {current_user.id}")
        return result
    
    except Exception as e:
        logger.error(f"Error fetching learning contents for learner {current_user.id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch learning contents: {str(e)}"
        )


@router.get("/learner/assignments/stats", response_model=CompletionStatsResponse)
async def get_my_completion_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get my completion statistics"""
    
    if current_user.role != UserRole.LEARNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only learners can access this endpoint"
        )
    
    stats = await program_assignment_crud.get_learner_completion_stats(db, current_user.id)
    return CompletionStatsResponse(**stats)


@router.get("/learner/assignments/{assignment_id}", response_model=ProgramAssignmentResponse)
async def get_my_assignment_details(
    assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed assignment information with all contents from all programs under the same assignment_title"""
    
    if current_user.role != UserRole.LEARNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only learners can access this endpoint"
        )
    
    assignment = await program_assignment_crud.get_assignment_by_id(db, assignment_id)
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    if assignment.learner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this assignment"
        )
    
    # Calculate if assignment is overdue (today is after end_date)
    today = date.today()
    is_overdue = today > assignment.end_date
    
    # Check if submission is late (submitted after end_date)
    is_late_submission = False
    if assignment.completed_at:
        completion_date = assignment.completed_at.date() if isinstance(assignment.completed_at, datetime) else assignment.completed_at
        is_late_submission = completion_date > assignment.end_date
    
    # learning_contents not needed for this endpoint - we'll return content_assignments instead
    learning_contents = []
    
    # Get ALL assignments with the same assignment_title and learner_id
    # This collects all content_assignments from all programs under this assignment title
    all_assignments_result = await db.execute(
        select(ProgramAssignment)
        .options(
            joinedload(ProgramAssignment.content_assignments).joinedload(LearnerContentAssignment.content)
        )
        .where(
            and_(
                ProgramAssignment.assignment_title == assignment.assignment_title,
                ProgramAssignment.learner_id == current_user.id
            )
        )
    )
    all_assignments = all_assignments_result.unique().scalars().all()
    
    # Collect all content_assignments from all programs under this title
    content_assignments_list = []
    seen_content_ids = set()  # Avoid duplicates
    
    for assign in all_assignments:
        if hasattr(assign, 'content_assignments'):
            for lca in assign.content_assignments:
                if lca.content and lca.content_id not in seen_content_ids:
                    seen_content_ids.add(lca.content_id)
                    content_assignments_list.append(
                        ContentAssignmentInProgram(
                            id=lca.id,
                            content_id=lca.content_id,
                            learning_content=LearningContentBasic(
                                id=lca.content.id,
                                title=lca.content.title,
                                description=lca.content.description,
                                content_type=lca.content.content_type.value,
                                file_url=getattr(lca.content, 'file_url', None),
                                thumbnail_url=getattr(lca.content, 'thumbnail_url', None)
                            ),
                            completion_status=lca.completion_status,
                            assigned_at=lca.assigned_at,
                            started_at=lca.started_at,
                            submitted_at=lca.submitted_at,
                            reviewed_at=lca.reviewed_at,
                            reviewed_by_head=lca.reviewed_by_head
                        )
                    )
    
    # Fetch program names from program_ids
    program_names = []
    if assignment.program_ids:
        programs_result = await db.execute(
            select(LearningGoals.goal)
            .where(LearningGoals.id.in_(assignment.program_ids))
            .order_by(LearningGoals.id)
        )
        program_names = [name[0] for name in programs_result.fetchall()]
    
    return ProgramAssignmentResponse(
        id=assignment.id,
        learner_id=assignment.learner_id,
        learner=UserBasic(
            id=assignment.learner.id,
            name=assignment.learner.name,
            email=assignment.learner.email
        ),
        program_ids=assignment.program_ids,
        program_names=program_names,
        program=ProgramWithContents(
            id=assignment.program_ids[0] if assignment.program_ids else 0,
            goal="",
            goal_description="",
            contents=[]  # Empty - programs and contents are SEPARATE
        ),
        assignment_title=assignment.assignment_title,
        assigned_by_head=assignment.assigned_by_head,
        assigned_by=UserBasic(
            id=assignment.assigned_by.id,
            name=assignment.assigned_by.name,
            email=assignment.assigned_by.email
        ) if assignment.assigned_by else None,
        start_date=assignment.start_date,
        end_date=assignment.end_date,
        duration_days=assignment.duration_days,
        head_notes=assignment.head_notes,
        learner_notes=assignment.learner_notes,
        completion_status=assignment.completion_status,
        completed_at=assignment.completed_at,
        notification_sent=assignment.notification_sent,
        assigned_at=assignment.assigned_at,
        updated_at=assignment.updated_at,
        is_overdue=is_overdue,
        is_late_submission=is_late_submission,
        content_assignments=content_assignments_list
    )


@router.patch("/learner/assignments/{assignment_id}", response_model=ProgramAssignmentResponse)
async def update_my_assignment(
    assignment_id: int,
    update_data: LearnerAssignmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update assignment (Learner can only update learner_notes and completion_status)"""
    
    if current_user.role != UserRole.LEARNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only learners can access this endpoint"
        )
    
    assignment = await program_assignment_crud.get_assignment_by_id(db, assignment_id)
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    if assignment.learner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this assignment"
        )
    
    # Convert to dict and remove None values
    update_dict = update_data.model_dump(exclude_unset=True)
    
    # If marking as completed, set completed_at
    if update_dict.get('completion_status') == CompletionStatus.COMPLETED.value:
        update_dict['completed_at'] = datetime.utcnow()
    
    updated_assignment = await program_assignment_crud.update_assignment(
        db, assignment_id, update_dict
    )
    
    # Reload with relationships for response
    updated_assignment = await program_assignment_crud.get_assignment_by_id(db, assignment_id)
    
    # Build response - fetch program names from program_ids
    program_names = []
    if updated_assignment.program_ids:
        programs_result = await db.execute(
            select(LearningGoals.goal)
            .where(LearningGoals.id.in_(updated_assignment.program_ids))
            .order_by(LearningGoals.id)
        )
        program_names = [name[0] for name in programs_result.fetchall()]
    
    # Build content assignments list
    content_assignments_list = []
    if updated_assignment.content_assignments:
        for ca in updated_assignment.content_assignments:
            try:
                # Convert content_type enum to string value
                content_type_str = ca.content.content_type.value if hasattr(ca.content.content_type, 'value') else str(ca.content.content_type)
                
                content_assignments_list.append(
                    ContentAssignmentInProgram(
                        id=ca.id,
                        content_id=ca.content_id,
                        learning_content=LearningContentBasic(
                            id=ca.content.id,
                            title=ca.content.title,
                            description=ca.content.description,
                            content_type=content_type_str,
                            file_url=ca.content.file_url,
                            thumbnail_url=ca.content.thumbnail_url,
                        ),
                        completion_status=ca.completion_status,
                        assigned_at=ca.assigned_at,
                        started_at=ca.started_at,
                        submitted_at=ca.submitted_at,
                        reviewed_at=ca.reviewed_at,
                        reviewed_by_head=ca.reviewed_by_head,
                    )
                )
            except Exception as e:
                logger.error(f"Error building content assignment {ca.id}: {str(e)}")
                continue
    
    return ProgramAssignmentResponse(
        id=updated_assignment.id,
        learner_id=updated_assignment.learner_id,
        learner=UserBasic(
            id=updated_assignment.learner.id,
            name=updated_assignment.learner.name,
            email=updated_assignment.learner.email
        ),
        program_ids=updated_assignment.program_ids,
        program_names=program_names,
        program=ProgramWithContents(
            id=updated_assignment.program_ids[0] if updated_assignment.program_ids else 0,
            goal="",
            goal_description="",
            contents=[]  # Empty - programs and contents are SEPARATE
        ),
        assignment_title=updated_assignment.assignment_title,
        assigned_by_head=updated_assignment.assigned_by_head,
        assigned_by=UserBasic(
            id=updated_assignment.assigned_by.id,
            name=updated_assignment.assigned_by.name,
            email=updated_assignment.assigned_by.email
        ) if updated_assignment.assigned_by else None,
        start_date=updated_assignment.start_date,
        end_date=updated_assignment.end_date,
        duration_days=updated_assignment.duration_days,
        head_notes=updated_assignment.head_notes,
        learner_notes=updated_assignment.learner_notes,
        completion_status=updated_assignment.completion_status,
        completed_at=updated_assignment.completed_at,
        notification_sent=updated_assignment.notification_sent,
        assigned_at=updated_assignment.assigned_at,
        updated_at=updated_assignment.updated_at,
        content_assignments=[
            ContentAssignmentInProgram(
                id=lca.id,
                content_id=lca.content_id,
                learning_content=LearningContentBasic(
                    id=lca.content.id,
                    title=lca.content.title,
                    description=lca.content.description,
                    content_type=lca.content.content_type.value
                ),
                completion_status=lca.completion_status,
                assigned_at=lca.assigned_at,
                started_at=lca.started_at,
                submitted_at=lca.submitted_at,
                reviewed_at=lca.reviewed_at,
                reviewed_by_head=lca.reviewed_by_head
            )
            for lca in (updated_assignment.content_assignments or [])
            if lca.content
        ]
    )


@router.post("/learner/assignments/{assignment_id}/attachments", response_model=AttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_my_attachment(
    assignment_id: int,
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload an attachment to my assignment (Learner)"""
    
    if current_user.role != UserRole.LEARNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only learners can access this endpoint"
        )
    
    assignment = await program_assignment_crud.get_assignment_by_id(db, assignment_id)
    
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found"
        )
    
    if assignment.learner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to upload to this assignment"
        )
    
    # Determine file type
    file_type = get_attachment_type_from_file(file.filename)
    
    # Read file content
    file_content = await file.read()
    file_size = len(file_content)
    
    # Validate file size (500MB for video, 50MB for others)
    max_size = 500 * 1024 * 1024 if file_type == AttachmentType.VIDEO else 50 * 1024 * 1024
    if file_size > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds {max_size / (1024*1024):.0f}MB limit"
        )
    
    # Upload file to S3 or local storage
    file_path = None
    thumbnail_url = None
    
    if settings.USE_S3 and s3_manager:
        try:
            # Upload main file
            s3_key = s3_manager.upload_file(
                file_content=file_content,
                folder="program-assignments",
                filename=file.filename,
                content_type=file.content_type or "application/octet-stream"
            )
            file_path = s3_manager.get_public_url(s3_key)
            
            # Generate thumbnail for images and videos
            if file_type in [AttachmentType.IMAGE, AttachmentType.VIDEO]:
                try:
                    thumbnail_content = s3_manager.generate_thumbnail(
                        file_content,
                        file_type.value.lower()
                    )
                    if thumbnail_content:
                        thumbnail_key = s3_manager.upload_file(
                            file_content=thumbnail_content,
                            folder="program-assignments/thumbnails",
                            filename=f"thumb_{file.filename}",
                            content_type="image/jpeg"
                        )
                        thumbnail_url = s3_manager.get_public_url(thumbnail_key)
                except Exception as e:
                    logger.warning(f"Failed to generate thumbnail: {str(e)}")
        
        except Exception as e:
            logger.error(f"Failed to upload to S3: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload file"
            )
    else:
        # Local storage fallback
        try:
            upload_dir = Path("uploads/program-assignments")
            upload_dir.mkdir(parents=True, exist_ok=True)

            unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
            local_path = upload_dir / unique_filename
            with open(local_path, "wb") as f:
                f.write(file_content)

            # Public path served by static files (nginx or backend static route)
            file_path = f"/uploads/program-assignments/{unique_filename}"

            # Generate thumbnail for images/videos (Learner endpoint)
            if file_type in [AttachmentType.IMAGE, AttachmentType.VIDEO]:
                try:
                    # Use PIL directly for local thumbnail generation without AWS
                    from PIL import Image
                    import io
                    
                    img = Image.open(io.BytesIO(file_content))
                    img.thumbnail((300, 300))
                    thumb_buffer = io.BytesIO()
                    img.save(thumb_buffer, format='JPEG', quality=85)
                    thumbnail_content = thumb_buffer.getvalue()
                    
                    if thumbnail_content:
                        thumb_dir = Path("uploads/program-assignments/thumbnails")
                        thumb_dir.mkdir(parents=True, exist_ok=True)
                        thumb_filename = f"thumb_{uuid.uuid4().hex}.jpg"
                        thumb_path = thumb_dir / thumb_filename
                        with open(thumb_path, "wb") as tf:
                            tf.write(thumbnail_content)
                        thumbnail_url = f"/uploads/program-assignments/thumbnails/{thumb_filename}"
                except Exception as e:
                    logger.warning(f"Failed to generate local thumbnail: {str(e)}")

        except Exception as e:
            logger.error(f"Failed to save file locally: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save file locally"
            )
    
    # Create attachment record
    attachment = await program_assignment_attachment_crud.create_attachment(
        db=db,
        assignment_id=assignment_id,
        uploaded_by=current_user.id,
        file_name=file.filename,
        file_path=file_path,
        file_type=file_type,
        file_size=file_size,
        thumbnail_url=thumbnail_url,
        description=description
    )
    
    return AttachmentResponse(
        id=attachment.id,
        assignment_id=attachment.assignment_id,
        uploaded_by=attachment.uploaded_by,
        uploader_name=attachment.uploader.name if attachment.uploader else None,
        file_name=attachment.file_name,
        file_path=attachment.file_path,
        file_type=attachment.file_type,
        file_size=attachment.file_size,
        thumbnail_url=attachment.thumbnail_url,
        description=attachment.description,
        uploaded_at=attachment.uploaded_at
    )

@router.get("/learner/content-assignments/{content_assignment_id}/feedback", response_model=ContentAssignmentWithFeedback)
async def get_content_assignment_feedback(
    content_assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get content assignment with feedback details (for learner)"""
    from sqlalchemy import select
    from app.models.learning_content_model import LearningContent
    
    result = await db.execute(
        select(LearnerContentAssignment)
        .where(LearnerContentAssignment.id == content_assignment_id)
    )
    content_assignment = result.scalar_one_or_none()
    
    if not content_assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content assignment not found"
        )
    
    # Verify learner owns this assignment
    if content_assignment.learner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this feedback"
        )
    
    # Parse feedback history
    feedback_history = []
    if content_assignment.feedback_history:
        try:
            feedback_history = json.loads(content_assignment.feedback_history)
        except (json.JSONDecodeError, TypeError):
            feedback_history = []
    
    # Build response with learning content details
    learning_content = None
    if content_assignment.content:
        learning_content = LearningContentBasic(
            id=content_assignment.content.id,
            title=content_assignment.content.title,
            description=content_assignment.content.description,
            content_type=content_assignment.content.content_type.value if hasattr(content_assignment.content.content_type, 'value') else str(content_assignment.content.content_type),
            file_url=content_assignment.content.file_url,
            thumbnail_url=content_assignment.content.thumbnail_url
        )
    
    return ContentAssignmentWithFeedback(
        id=content_assignment.id,
        content_id=content_assignment.content_id,
        learning_content=learning_content,
        completion_status=content_assignment.completion_status,
        assigned_at=content_assignment.assigned_at,
        started_at=content_assignment.started_at,
        submitted_at=content_assignment.submitted_at,
        reviewed_at=content_assignment.reviewed_at,
        reviewed_by_head=content_assignment.reviewed_by_head,
        head_feedback_text=content_assignment.head_feedback_text,
        head_rating=content_assignment.head_rating,
        feedback_given_at=content_assignment.feedback_given_at,
        feedback_history=feedback_history,
        resubmit_allowed=content_assignment.resubmit_allowed
    )

