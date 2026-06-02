"""CRUD operations for free appointment submissions."""

from typing import Optional

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.free_appointment_model import FreeAppointment
from app.schemas.free_appointment import FreeAppointmentCreate


class FreeAppointmentCRUD:
    async def create_appointment(
        self,
        db: AsyncSession,
        appointment: FreeAppointmentCreate,
    ) -> FreeAppointment:
        db_appointment = FreeAppointment(**appointment.model_dump())
        db.add(db_appointment)
        await db.commit()
        await db.refresh(db_appointment)
        return db_appointment

    async def get_appointments(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 10,
        search: Optional[str] = None,
    ) -> tuple[list[FreeAppointment], int]:
        query = select(FreeAppointment)

        if search:
            term = f"%{search}%"
            query = query.where(
                or_(
                    FreeAppointment.child_name.ilike(term),
                    FreeAppointment.contact_number.ilike(term),
                    FreeAppointment.reference_by.ilike(term),
                )
            )

        total_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(total_query)
        total = total_result.scalar() or 0

        result = await db.execute(
            query.order_by(FreeAppointment.created_at.desc()).offset(skip).limit(limit)
        )
        return result.scalars().all(), total

    async def get_appointment(
        self,
        db: AsyncSession,
        appointment_id: int,
    ) -> Optional[FreeAppointment]:
        result = await db.execute(
            select(FreeAppointment).where(FreeAppointment.id == appointment_id)
        )
        return result.scalar_one_or_none()


free_appointment_crud = FreeAppointmentCRUD()
