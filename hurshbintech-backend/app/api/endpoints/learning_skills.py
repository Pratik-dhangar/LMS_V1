from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_current_head
from app.crud import learning_skill_crud
from app.db.session import get_db
from app.models.user_model import HeadProfile, User
from app.schemas.learning_skill import (
    LearningSkillCreate,
    LearningSkillResponse,
    LearningSkillUpdate,
)

router = APIRouter(prefix="/learning-skills", tags=["Learning Skills"])


@router.post("/admin", response_model=LearningSkillResponse, status_code=status.HTTP_201_CREATED)
async def create_learning_skill(
    skill_data: LearningSkillCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    existing_skill = await learning_skill_crud.get_skill_by_name(db, skill_data.skill_name)
    if existing_skill:
        raise HTTPException(status_code=400, detail="Learning skill already exists")

    skill = await learning_skill_crud.create_learning_skill(db, skill_data, current_admin.id)
    return LearningSkillResponse.from_orm_with_user(skill)


@router.get("/admin", response_model=List[LearningSkillResponse])
async def get_all_skills_admin(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    skills = await learning_skill_crud.get_all_learning_skills(db)
    return [LearningSkillResponse.from_orm_with_user(skill) for skill in skills]


@router.patch("/admin/{skill_id}", response_model=LearningSkillResponse)
async def update_learning_skill_admin(
    skill_id: int,
    skill_data: LearningSkillUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    existing_skill = await learning_skill_crud.get_skill_by_name(db, skill_data.skill_name)
    if existing_skill and existing_skill.id != skill_id:
        raise HTTPException(status_code=400, detail="Learning skill already exists")

    updated_skill = await learning_skill_crud.update_learning_skill(db, skill_id, skill_data)
    if not updated_skill:
        raise HTTPException(status_code=404, detail="Learning skill not found")

    return LearningSkillResponse.from_orm_with_user(updated_skill)


@router.delete("/admin/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_learning_skill_admin(
    skill_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    success = await learning_skill_crud.delete_learning_skill(db, skill_id)
    if not success:
        raise HTTPException(status_code=404, detail="Learning skill not found")

    return None


@router.get("/head", response_model=List[LearningSkillResponse])
async def get_all_skills_head(
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    skills = await learning_skill_crud.get_all_learning_skills(db)
    return [LearningSkillResponse.from_orm_with_user(skill) for skill in skills]
