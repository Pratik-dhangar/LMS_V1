"""CRUD operations for free assessment submissions."""

from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.free_assessment_model import FreeAssessment
from app.schemas.free_assessment import FreeAssessmentCreate


class FreeAssessmentCRUD:
    async def create_assessment(
        self,
        db: AsyncSession,
        assessment: FreeAssessmentCreate,
    ) -> FreeAssessment:
        db_assessment = FreeAssessment(**assessment.model_dump())
        db.add(db_assessment)
        await db.commit()
        await db.refresh(db_assessment)
        return db_assessment

    async def get_assessments(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 10,
        search: Optional[str] = None,
    ) -> tuple[list[FreeAssessment], int]:
        query = select(FreeAssessment)

        if search:
            term = f"%{search}%"
            query = query.where(
                or_(
                    FreeAssessment.child_name.ilike(term),
                    FreeAssessment.mother_name.ilike(term),
                    FreeAssessment.father_name.ilike(term),
                    FreeAssessment.mother_contact.ilike(term),
                    FreeAssessment.father_contact.ilike(term),
                )
            )

        total_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(total_query)
        total = total_result.scalar() or 0

        result = await db.execute(
            query.order_by(FreeAssessment.created_at.desc()).offset(skip).limit(limit)
        )
        return result.scalars().all(), total

    async def get_assessment(
        self,
        db: AsyncSession,
        assessment_id: int,
    ) -> Optional[FreeAssessment]:
        result = await db.execute(
            select(FreeAssessment).where(FreeAssessment.id == assessment_id)
        )
        return result.scalar_one_or_none()


free_assessment_crud = FreeAssessmentCRUD()
