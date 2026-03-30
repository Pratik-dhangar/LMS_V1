from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.learning_skill_model import LearningSkill
from app.schemas.learning_skill import LearningSkillCreate


async def get_skill_by_name(db: AsyncSession, skill_name: str) -> Optional[LearningSkill]:
    normalized = skill_name.strip().lower()
    result = await db.execute(
        select(LearningSkill)
        .options(joinedload(LearningSkill.created_by))
        .where(func.lower(LearningSkill.skill_name) == normalized)
    )
    return result.scalar_one_or_none()


async def create_learning_skill(
    db: AsyncSession, skill_data: LearningSkillCreate, admin_id: int
) -> LearningSkill:
    new_skill = LearningSkill(
        skill_name=skill_data.skill_name.strip(),
        created_by_admin_id=admin_id,
    )
    db.add(new_skill)
    await db.commit()
    await db.refresh(new_skill)

    result = await db.execute(
        select(LearningSkill)
        .options(joinedload(LearningSkill.created_by))
        .where(LearningSkill.id == new_skill.id)
    )
    return result.scalar_one()


async def get_all_learning_skills(db: AsyncSession) -> List[LearningSkill]:
    result = await db.execute(
        select(LearningSkill)
        .options(joinedload(LearningSkill.created_by))
        .order_by(LearningSkill.skill_name.asc())
    )
    return result.scalars().all()
