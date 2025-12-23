"""
Program Assignment endpoints for Head and Learner
Manages program assignments with completion tracking, notes, and attachments
"""

import logging
from datetime import date, datetime
from typing import List, Optional

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
from sqlalchemy import delete

from app.core.deps import get_current_head, get_current_user
from app.crud import program_assignment_crud, program_assignment_attachment_crud
from app.db.session import get_db
from app.models.user_model import HeadProfile, User, UserRole
from app.models.program_assignment_model import CompletionStatus
from app.models.program_assignment_attachment_model import AttachmentType
from app.models.learner_content_assignment_model import LearnerContentAssignment, ContentCompletionStatus
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
    """Create program assignments for one or more learners (bulk)"""
    
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
            
            # Check for duplicate active assignment
            existing = await program_assignment_crud.check_duplicate_active_assignment(
                db, learner_id, assignment_data.program_id
            )
            
            if existing:
                learner = user  # Already fetched above
                failed_count += 1
                failed_learners.append({
                    "learner_id": learner_id,
                    "learner_name": learner.name if learner else "Unknown",
                    "reason": "Active assignment already exists for this program"
                })
                continue
            
            # Create assignment
            new_assignment = await program_assignment_crud.create_assignment(
                db=db,
                learner_id=learner_id,
                program_id=assignment_data.program_id,
                assigned_by_head=current_head.user_id,
                start_date=assignment_data.start_date,
                end_date=assignment_data.end_date,
                duration_days=assignment_data.duration_days,
                head_notes=assignment_data.head_notes
            )
            
            # Auto-assign learning contents associated with this program
            try:
                from app.crud import program_learning_content_crud, learner_content_assignment_crud
                
                # Get all contents associated with this program
                program_contents = await program_learning_content_crud.get_program_contents(db, assignment_data.program_id)
                
                # Create learner content assignments for each content in the program
                for program_content in program_contents:
                    try:
                        # Check if already assigned
                        already_assigned = await learner_content_assignment_crud.check_duplicate_assignment(
                            db, learner_id, program_content.content_id
                        )
                        
                        if not already_assigned:
                            await learner_content_assignment_crud.create_assignment(
                                db=db,
                                learner_id=learner_id,
                                content_id=program_content.content_id,
                                assigned_by_head=current_head.user_id,
                                program_assignment_id=new_assignment.id
                            )
                            logger.info(f"Auto-assigned content {program_content.content_id} to learner {learner_id}")
                        
                    except Exception as content_error:
                        logger.warning(f"Failed to auto-assign content {program_content.content_id} to learner {learner_id}: {str(content_error)}")
                
                # Assign extra/manual learning contents if provided
                if assignment_data.extra_content_ids and len(assignment_data.extra_content_ids) > 0:
                    for content_id in assignment_data.extra_content_ids:
                        try:
                            # Check if already assigned
                            already_assigned = await learner_content_assignment_crud.check_duplicate_assignment(
                                db, learner_id, content_id
                            )
                            
                            if not already_assigned:
                                await learner_content_assignment_crud.create_assignment(
                                    db=db,
                                    learner_id=learner_id,
                                    content_id=content_id,
                                    assigned_by_head=current_head.user_id,
                                    program_assignment_id=new_assignment.id
                                )
                                logger.info(f"Manually assigned extra content {content_id} to learner {learner_id}")
                        
                        except Exception as content_error:
                            logger.warning(f"Failed to assign extra content {content_id} to learner {learner_id}: {str(content_error)}")
                        
            except Exception as content_error:
                logger.warning(f"Failed to assign contents for program {assignment_data.program_id} to learner {learner_id}: {str(content_error)}")
            
            success_count += 1
            created_assignments.append(new_assignment.id)
            
        except Exception as e:
            logger.error(f"Failed to create assignment for learner {learner_id}: {str(e)}")
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
            if a.completion_status.value == "COMPLETED":
                overview[learner_id]["completed"] += 1
            elif a.completion_status.value == "IN_PROGRESS":
                overview[learner_id]["in_progress"] += 1
            else:
                overview[learner_id]["not_started"] += 1
            
            overview[learner_id]["assignments"].append({
                "id": a.id,
                "program_name": a.program.goal,
                "status": a.completion_status.value,
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
            program_id=a.program_id,
            program_name=a.program.goal,
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
    """Get detailed assignment information with learning contents"""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.learning_content_model import LearningContent
    
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
    
    # Build response with learning contents from program
    learning_contents = []
    if hasattr(assignment.program, 'program_contents'):
        for pc in sorted(assignment.program.program_contents, key=lambda x: x.sequence_order):
            learning_contents.append(
                LearningContentInProgram(
                    id=pc.content.id,
                    title=pc.content.title,
                    description=pc.content.description,
                    content_type=pc.content.content_type.value,
                    file_url=pc.content.file_url,
                    thumbnail_url=pc.content.thumbnail_url,
                    sequence_order=pc.sequence_order
                )
            )
    
    # Fetch all content assignments for this program assignment
    content_assignments_list = []
    if hasattr(assignment, 'content_assignments'):
        # Get program content IDs for checking if content is from program
        program_content_ids = {pc.content_id for pc in assignment.program.program_contents} if hasattr(assignment.program, 'program_contents') else set()
        
        for ca in assignment.content_assignments:
            # Get actual completion status from the assignment
            completion_status = ca.completion_status if hasattr(ca, 'completion_status') else ContentCompletionStatus.NOT_STARTED
            
            # Check if this content is from the program or manually assigned
            is_from_program = ca.content_id in program_content_ids
            
            content_assignments_list.append(
                ContentAssignmentInProgram(
                    id=ca.id,
                    content_id=ca.content_id,
                    learning_content=LearningContentBasic(
                        id=ca.content.id,
                        title=ca.content.title,
                        description=ca.content.description,
                        content_type=ca.content.content_type.value,
                        file_url=ca.content.file_url,
                        thumbnail_url=ca.content.thumbnail_url,
                    ),
                    is_from_program=is_from_program,
                    completion_status=completion_status,
                    assigned_at=ca.assigned_at,
                    started_at=ca.started_at if hasattr(ca, 'started_at') else None,
                    submitted_at=ca.submitted_at if hasattr(ca, 'submitted_at') else None,
                    reviewed_at=ca.reviewed_at if hasattr(ca, 'reviewed_at') else None,
                    reviewed_by_head=ca.reviewed_by_head if hasattr(ca, 'reviewed_by_head') else None
                )
            )
    
    return ProgramAssignmentResponse(
        id=assignment.id,
        learner_id=assignment.learner_id,
        learner=UserBasic(
            id=assignment.learner.id,
            name=assignment.learner.name,
            email=assignment.learner.email
        ),
        program_id=assignment.program_id,
        program=ProgramWithContents(
            id=assignment.program.id,
            goal=assignment.program.goal,
            goal_description=assignment.program.goal_description,
            contents=learning_contents
        ),
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
            file_url=pc.content.file_url,
            thumbnail_url=pc.content.thumbnail_url,
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
    """Update assignment (Head can update all fields except learner_notes)"""
    
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
    
    # Convert to dict and remove None values
    update_dict = update_data.model_dump(exclude_unset=True)
    
    updated_assignment = await program_assignment_crud.update_assignment(
        db, assignment_id, update_dict
    )
    
    # Reload with relationships for response
    updated_assignment = await program_assignment_crud.get_assignment_by_id(db, assignment_id)
    
    # Build response (same as get_assignment_details)
    learning_contents = []
    if hasattr(updated_assignment.program, 'program_contents'):
        for pc in sorted(updated_assignment.program.program_contents, key=lambda x: x.sequence_order):
            learning_contents.append(
                LearningContentInProgram(
                    id=pc.content.id,
                    title=pc.content.title,
                    description=pc.content.description,
                    content_type=pc.content.content_type.value,
                    file_url=pc.content.file_url,
                    thumbnail_url=pc.content.thumbnail_url,
                    sequence_order=pc.sequence_order
                )
            )
    
    return ProgramAssignmentResponse(
        id=updated_assignment.id,
        learner_id=updated_assignment.learner_id,
        learner=UserBasic(
            id=updated_assignment.learner.id,
            name=updated_assignment.learner.name,
            email=updated_assignment.learner.email
        ),
        program_id=updated_assignment.program_id,
        program=ProgramWithContents(
            id=updated_assignment.program.id,
            goal=updated_assignment.program.goal,
            goal_description=updated_assignment.program.goal_description,
            contents=learning_contents
        ),
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
        updated_at=updated_assignment.updated_at
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

            # Generate thumbnail for images/videos
            if file_type in [AttachmentType.IMAGE, AttachmentType.VIDEO]:
                try:
                    s3_util = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
                    thumbnail_content = s3_util.generate_thumbnail(file_content, file_type.value.lower())
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
            completion_status=ContentCompletionStatus.IN_PROGRESS,
            started_at=datetime.utcnow()
        )
    )
    await db.commit()
    
    # Update program assignment status if this content belongs to a program
    if content_assignment.program_assignment_id:
        await program_assignment_crud.update_program_status_from_content(
            db, content_assignment.program_assignment_id
        )
    
    return {"message": "Content started", "status": "IN_PROGRESS"}


@router.patch("/content-assignments/{content_assignment_id}/submit")
async def submit_content(
    content_assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit content assignment (checks if late)"""
    from sqlalchemy import select, update
    
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
    
    if content_assignment.program_assignment:
        end_date = content_assignment.program_assignment.end_date
        # Convert date to datetime for comparison
        end_datetime = datetime.combine(end_date, datetime.max.time())
        is_late = now > end_datetime
    
    new_status = ContentCompletionStatus.LATE_SUBMITTED if is_late else ContentCompletionStatus.SUBMITTED
    
    # Update status
    await db.execute(
        update(LearnerContentAssignment)
        .where(LearnerContentAssignment.id == content_assignment_id)
        .values(
            completion_status=new_status,
            submitted_at=now
        )
    )
    await db.commit()
    
    # Update program assignment status if this content belongs to a program
    if content_assignment.program_assignment_id:
        await program_assignment_crud.update_program_status_from_content(
            db, content_assignment.program_assignment_id
        )
    
    return {
        "message": "Content submitted",
        "status": new_status.value,
        "is_late": is_late
    }


@router.patch("/head/content-assignments/{content_assignment_id}/review")
async def review_content(
    content_assignment_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Mark content as reviewed by head"""
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
    
    # Update status to REVIEWED
    await db.execute(
        update(LearnerContentAssignment)
        .where(LearnerContentAssignment.id == content_assignment_id)
        .values(
            completion_status=ContentCompletionStatus.REVIEWED,
            reviewed_at=datetime.utcnow(),
            reviewed_by_head=current_head.user_id
        )
    )
    await db.commit()
    
    # Update program assignment status if this content belongs to a program
    if content_assignment.program_assignment_id:
        await program_assignment_crud.update_program_status_from_content(
            db, content_assignment.program_assignment_id
        )
    
    return {"message": "Content reviewed", "status": "REVIEWED"}

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
        
        result.append(
            ProgramAssignmentListResponse(
                id=a.id,
                learner_id=a.learner_id,
                learner_name=a.learner.name,
                program_id=a.program_id,
                program_name=a.program.goal,
                start_date=a.start_date,
                end_date=a.end_date,
                duration_days=a.duration_days,
                completion_status=a.completion_status,
                completed_at=a.completed_at,
                assigned_at=a.assigned_at,
                is_overdue=is_overdue,
                is_late_submission=is_late_submission
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
        
        # Convert S3 URLs to public URLs if using S3
        result = []
        for assignment in assignments:
            try:
                content = assignment.content
                file_url = content.file_url
                thumbnail_url = content.thumbnail_url
                
                # Convert S3 URLs to public HTTP URLs
                if settings.USE_S3 and s3_manager:
                    if file_url and file_url.startswith("s3://"):
                        s3_key = file_url.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
                        file_url = s3_manager.get_public_url(s3_key)
                    
                    if thumbnail_url and thumbnail_url.startswith("s3://"):
                        s3_key = thumbnail_url.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
                        thumbnail_url = s3_manager.get_public_url(s3_key)
                
                content_type_str = content.content_type.value if hasattr(content.content_type, 'value') else str(content.content_type)
                
                result.append({
                    "id": content.id,
                    "title": content.title,
                    "description": content.description,
                    "content_type": content_type_str,
                    "file_url": file_url,
                    "thumbnail_url": thumbnail_url,
                    "assigned_at": assignment.assigned_at.isoformat() if hasattr(assignment.assigned_at, 'isoformat') else str(assignment.assigned_at),
                    "assigned_by": assignment.assigned_by.name if assignment.assigned_by else None,
                    "from_program": assignment.program_assignment_id is not None
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
    """Get detailed assignment information"""
    
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
    
    # Build response with learning contents
    learning_contents = []
    if hasattr(assignment.program, 'program_contents'):
        for pc in sorted(assignment.program.program_contents, key=lambda x: x.sequence_order):
            learning_contents.append(
                LearningContentInProgram(
                    id=pc.content.id,
                    title=pc.content.title,
                    description=pc.content.description,
                    content_type=pc.content.content_type.value,
                    file_url=pc.content.file_url,
                    thumbnail_url=pc.content.thumbnail_url,
                    sequence_order=pc.sequence_order
                )
            )
    
    return ProgramAssignmentResponse(
        id=assignment.id,
        learner_id=assignment.learner_id,
        learner=UserBasic(
            id=assignment.learner.id,
            name=assignment.learner.name,
            email=assignment.learner.email
        ),
        program_id=assignment.program_id,
        program=ProgramWithContents(
            id=assignment.program.id,
            goal=assignment.program.goal,
            goal_description=assignment.program.goal_description,
            contents=learning_contents
        ),
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
        is_late_submission=is_late_submission
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
    if update_dict.get('completion_status') == CompletionStatus.COMPLETED:
        update_dict['completed_at'] = datetime.utcnow()
    
    updated_assignment = await program_assignment_crud.update_assignment(
        db, assignment_id, update_dict
    )
    
    # Reload with relationships for response
    updated_assignment = await program_assignment_crud.get_assignment_by_id(db, assignment_id)
    
    # Build response
    learning_contents = []
    if hasattr(updated_assignment.program, 'program_contents'):
        for pc in sorted(updated_assignment.program.program_contents, key=lambda x: x.sequence_order):
            learning_contents.append(
                LearningContentInProgram(
                    id=pc.content.id,
                    title=pc.content.title,
                    description=pc.content.description,
                    content_type=pc.content.content_type.value,
                    file_url=pc.content.file_url,
                    thumbnail_url=pc.content.thumbnail_url,
                    sequence_order=pc.sequence_order
                )
            )
    
    return ProgramAssignmentResponse(
        id=updated_assignment.id,
        learner_id=updated_assignment.learner_id,
        learner=UserBasic(
            id=updated_assignment.learner.id,
            name=updated_assignment.learner.name,
            email=updated_assignment.learner.email
        ),
        program_id=updated_assignment.program_id,
        program=ProgramWithContents(
            id=updated_assignment.program.id,
            goal=updated_assignment.program.goal,
            goal_description=updated_assignment.program.goal_description,
            contents=learning_contents
        ),
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
        updated_at=updated_assignment.updated_at
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

            # Generate thumbnail for images/videos
            if file_type in [AttachmentType.IMAGE, AttachmentType.VIDEO]:
                try:
                    s3_util = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
                    thumbnail_content = s3_util.generate_thumbnail(file_content, file_type.value.lower())
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
