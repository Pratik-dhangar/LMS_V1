from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from typing import List, Optional

from app.models.learning_content_model import LearningContent
from app.models.user_model import User
from app.schemas.learning_content import LearningContentCreate, LearningContentUpdate

async def create_learning_content(
    db: AsyncSession,
    content_data: LearningContentCreate,
    admin_id: int
) -> LearningContent:
    """Create new learning content"""
    new_content = LearningContent(
        title=content_data.title,
        description=content_data.description,
        content_type=content_data.content_type,
        file_url=content_data.file_url,
        file_size=content_data.file_size,
        thumbnail_url=content_data.thumbnail_url,
        created_by_admin_id=admin_id
    )

    db.add(new_content)
    await db.commit()
    await db.refresh(new_content)

    # Load relationships
    result = await db.execute(
        select(LearningContent)
        .options(
            joinedload(LearningContent.created_by),
            joinedload(LearningContent.updated_by)
        )
        .where(LearningContent.id == new_content.id)
    )
    return result.scalar_one()

async def get_all_learning_contents(db: AsyncSession) -> List[LearningContent]:
    """Get all learning contents"""
    result = await db.execute(
        select(LearningContent)
        .options(
            joinedload(LearningContent.created_by),
            joinedload(LearningContent.updated_by)
        )
        .order_by(LearningContent.created_at.desc())
    )
    return result.scalars().all()

async def get_learning_content_by_id(
    db: AsyncSession,
    content_id: int
) -> Optional[LearningContent]:
    """Get learning content by ID"""
    result = await db.execute(
        select(LearningContent)
        .options(
            joinedload(LearningContent.created_by),
            joinedload(LearningContent.updated_by)
        )
        .where(LearningContent.id == content_id)
    )
    return result.scalar_one_or_none()

async def update_learning_content(
    db: AsyncSession,
    content_id: int,
    content_data: LearningContentUpdate,
    user_id: int
) -> Optional[LearningContent]:
    """Update learning content (title, description, thumbnail only)"""
    content = await get_learning_content_by_id(db, content_id)

    if not content:
        return None

    # Update only allowed fields
    if content_data.title is not None:
        content.title = content_data.title
    if content_data.description is not None:
        content.description = content_data.description
    if content_data.thumbnail_url is not None:
        content.thumbnail_url = content_data.thumbnail_url

    content.updated_by_id = user_id

    await db.commit()
    await db.refresh(content)

    # Reload relationships
    result = await db.execute(
        select(LearningContent)
        .options(
            joinedload(LearningContent.created_by),
            joinedload(LearningContent.updated_by)
        )
        .where(LearningContent.id == content_id)
    )
    return result.scalar_one()

async def delete_learning_content(
    db: AsyncSession,
    content_id: int
) -> bool:
    """Delete learning content (admin only)"""
    content = await get_learning_content_by_id(db, content_id)

    if not content:
        return False

    await db.delete(content)
    await db.commit()
    return True
