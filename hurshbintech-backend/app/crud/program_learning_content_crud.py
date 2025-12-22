"""CRUD operations for Program Learning Content junction table"""

from typing import List, Optional

from sqlalchemy import select, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.program_learning_content_model import ProgramLearningContent
from app.models.learning_content_model import LearningContent


async def add_content_to_program(
    db: AsyncSession,
    program_id: int,
    content_id: int,
    sequence_order: Optional[int] = None
) -> ProgramLearningContent:
    """Add a learning content to a program with sequence order"""
    
    # If sequence_order not provided, get the next order number
    if sequence_order is None:
        result = await db.execute(
            select(ProgramLearningContent)
            .where(ProgramLearningContent.program_id == program_id)
            .order_by(ProgramLearningContent.sequence_order.desc())
        )
        last_item = result.scalars().first()
        sequence_order = (last_item.sequence_order + 1) if last_item else 0
    
    new_link = ProgramLearningContent(
        program_id=program_id,
        content_id=content_id,
        sequence_order=sequence_order
    )
    
    db.add(new_link)
    await db.commit()
    await db.refresh(new_link)
    return new_link


async def get_program_contents(
    db: AsyncSession,
    program_id: int
) -> List[ProgramLearningContent]:
    """Get all learning contents for a program, ordered by sequence"""
    result = await db.execute(
        select(ProgramLearningContent)
        .options(joinedload(ProgramLearningContent.content))
        .where(ProgramLearningContent.program_id == program_id)
        .order_by(ProgramLearningContent.sequence_order)
    )
    return result.scalars().all()


async def reorder_program_contents(
    db: AsyncSession,
    program_id: int,
    content_orders: List[dict]  # [{"content_id": 1, "sequence_order": 0}, ...]
) -> bool:
    """Update sequence order for multiple contents in a program"""
    
    for item in content_orders:
        result = await db.execute(
            select(ProgramLearningContent)
            .where(
                ProgramLearningContent.program_id == program_id,
                ProgramLearningContent.content_id == item["content_id"]
            )
        )
        link = result.scalar_one_or_none()
        if link:
            link.sequence_order = item["sequence_order"]
    
    await db.commit()
    return True


async def remove_content_from_program(
    db: AsyncSession,
    program_id: int,
    content_id: int
) -> bool:
    """Remove a learning content from a program"""
    result = await db.execute(
        select(ProgramLearningContent)
        .where(
            ProgramLearningContent.program_id == program_id,
            ProgramLearningContent.content_id == content_id
        )
    )
    link = result.scalar_one_or_none()
    
    if not link:
        return False
    
    await db.delete(link)
    await db.commit()
    return True


async def check_content_in_program(
    db: AsyncSession,
    program_id: int,
    content_id: int
) -> bool:
    """Check if a content is already linked to a program"""
    result = await db.execute(
        select(ProgramLearningContent)
        .where(
            ProgramLearningContent.program_id == program_id,
            ProgramLearningContent.content_id == content_id
        )
    )
    return result.scalar_one_or_none() is not None
