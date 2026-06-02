"""Public submit and admin preview APIs for free appointments."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_db
from app.crud.free_appointment_crud import free_appointment_crud
from app.models.user_model import User
from app.schemas.free_appointment import (
    FreeAppointmentCreate,
    FreeAppointmentListResponse,
    FreeAppointmentResponse,
)
from app.services.email_service import EmailService
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# Fixed recipient email for free appointment notifications (change later as needed)
FREE_APPOINTMENT_NOTIFICATION_EMAIL = settings.FREE_APPOINTMENT_NOTIFICATION_EMAIL
FREE_APPOINTMENT_NOTIFICATION_NAME = "Admin"


@router.post(
    "/free-appointments-form",
    response_model=FreeAppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Free Appointment"],
)
async def submit_free_appointment(
    payload: FreeAppointmentCreate,
    db: AsyncSession = Depends(get_db),
):
    try:
        # Create the appointment in database
        appointment = await free_appointment_crud.create_appointment(db, payload)

        # Send notification email to the fixed recipient
        try:
            await EmailService.send_free_appointment_notification(
                recipient_email=FREE_APPOINTMENT_NOTIFICATION_EMAIL,
                recipient_name=FREE_APPOINTMENT_NOTIFICATION_NAME,
                child_name=payload.child_name,
                age=payload.age,
                concerns=payload.concerns,
                diagnosis=payload.diagnosis,
                address=payload.address,
                contact_number=payload.contact_number,
                reference_by=payload.reference_by,
                appointment_id=appointment.id,
            )
            logger.info(
                f"✓ Free appointment notification email sent to {FREE_APPOINTMENT_NOTIFICATION_EMAIL}"
            )
        except Exception as email_error:
            logger.error(
                f"✗ Failed to send free appointment notification email: {str(email_error)}"
            )

        return appointment

    except Exception as exc:
        logger.error("Error saving free appointment: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit free appointment form",
        )


@router.get(
    "/admin/free-appointments-list",
    response_model=FreeAppointmentListResponse,
    tags=["Admin - Free Appointment"],
)
async def list_free_appointments(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    try:
        items, total = await free_appointment_crud.get_appointments(
            db,
            skip=skip,
            limit=limit,
            search=search,
        )
        return FreeAppointmentListResponse(data=items, total=total, skip=skip, limit=limit)
    except Exception as exc:
        logger.error("Error listing free appointments by admin %s: %s", current_admin.id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch free appointments",
        )


@router.get(
    "/admin/free-appointments-list/{appointment_id}",
    response_model=FreeAppointmentResponse,
    tags=["Admin - Free Appointment"],
)
async def get_free_appointment_detail(
    appointment_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    try:
        item = await free_appointment_crud.get_appointment(db, appointment_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Free appointment with ID {appointment_id} not found",
            )
        return item
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "Error fetching free appointment %s by admin %s: %s",
            appointment_id,
            current_admin.id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch free appointment details",
        )
