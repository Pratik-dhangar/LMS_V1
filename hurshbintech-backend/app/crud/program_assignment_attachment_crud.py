"""CRUD operations for Program Assignment Attachments"""

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.program_assignment_attachment_model import (
    ProgramAssignmentAttachment,
    AttachmentType
)


async def create_attachment(
    db: AsyncSession,
    assignment_id: int,
    uploaded_by: int,
    file_name: str,
    file_path: str,
    file_type: AttachmentType,
    file_size: Optional[int] = None,
    thumbnail_url: Optional[str] = None,
    description: Optional[str] = None
) -> ProgramAssignmentAttachment:
    """Create a new attachment for an assignment"""
    
    new_attachment = ProgramAssignmentAttachment(
        assignment_id=assignment_id,
        uploaded_by=uploaded_by,
        file_name=file_name,
        file_path=file_path,
        file_type=file_type,
        file_size=file_size,
        thumbnail_url=thumbnail_url,
        description=description
    )
    
    db.add(new_attachment)
    await db.commit()
    await db.refresh(new_attachment)
    return new_attachment


async def get_attachments_by_assignment(
    db: AsyncSession,
    assignment_id: int
) -> List[ProgramAssignmentAttachment]:
    """Get all attachments for an assignment"""
    result = await db.execute(
        select(ProgramAssignmentAttachment)
        .options(joinedload(ProgramAssignmentAttachment.uploader))
        .where(ProgramAssignmentAttachment.assignment_id == assignment_id)
        .order_by(ProgramAssignmentAttachment.uploaded_at.desc())
    )
    return result.scalars().all()


async def get_attachment_by_id(
    db: AsyncSession,
    attachment_id: int
) -> Optional[ProgramAssignmentAttachment]:
    """Get attachment by ID"""
    result = await db.execute(
        select(ProgramAssignmentAttachment)
        .options(joinedload(ProgramAssignmentAttachment.uploader))
        .where(ProgramAssignmentAttachment.id == attachment_id)
    )
    return result.scalar_one_or_none()


async def delete_attachment(
    db: AsyncSession,
    attachment_id: int
) -> bool:
    """Delete an attachment"""
    attachment = await get_attachment_by_id(db, attachment_id)
    if not attachment:
        return False
    
    await db.delete(attachment)
    await db.commit()
    return True
