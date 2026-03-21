"""Public submit and admin preview APIs for free assessments."""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_admin, get_db
from app.crud.free_assessment_crud import free_assessment_crud
from app.models.user_model import User
from app.schemas.free_assessment import (
    FreeAssessmentCreate,
    FreeAssessmentListResponse,
    FreeAssessmentResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/free-assessments",
    response_model=FreeAssessmentResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Free Assessment"],
)
async def submit_free_assessment(
    payload: FreeAssessmentCreate,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await free_assessment_crud.create_assessment(db, payload)
    except Exception as exc:
        logger.error("Error saving free assessment: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit free assessment form",
        )


@router.get(
    "/admin/free-assessments",
    response_model=FreeAssessmentListResponse,
    tags=["Admin - Free Assessment"],
)
async def list_free_assessments(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    try:
        items, total = await free_assessment_crud.get_assessments(
            db,
            skip=skip,
            limit=limit,
            search=search,
        )
        return FreeAssessmentListResponse(data=items, total=total, skip=skip, limit=limit)
    except Exception as exc:
        logger.error("Error listing free assessments by admin %s: %s", current_admin.id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch free assessments",
        )


@router.get(
    "/admin/free-assessments/{assessment_id}",
    response_model=FreeAssessmentResponse,
    tags=["Admin - Free Assessment"],
)
async def get_free_assessment_detail(
    assessment_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    try:
        item = await free_assessment_crud.get_assessment(db, assessment_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Free assessment with ID {assessment_id} not found",
            )
        return item
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error fetching free assessment %s by admin %s: %s", assessment_id, current_admin.id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch free assessment details",
        )
