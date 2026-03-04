"""
Learner Progress Report API Endpoints
"""

import uuid
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, get_db
from app.crud import learner_progress_report_crud
from app.models.user_model import User, UserRole
from app.schemas.learner_progress_report import (
    LearnerProgressReportCreate,
    LearnerProgressReportResponse,
    LearnerProgressReportUpdate,
)

router = APIRouter()


@router.post("/", response_model=LearnerProgressReportResponse, status_code=status.HTTP_201_CREATED)
async def create_progress_report(
    report_data: LearnerProgressReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new learner progress report.
    Accessible by HEAD, TRAINER, COACH roles.
    """
    allowed_roles = {UserRole.HEAD, UserRole.TRAINER, UserRole.COACH, UserRole.ADMIN}
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Head, Trainer, Coach, or Admin can create progress reports",
        )

    report = await learner_progress_report_crud.create_report(
        db, report_data, current_user.id
    )
    return report


@router.get("/", response_model=List[LearnerProgressReportResponse])
async def get_all_progress_reports(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all progress reports created by the current user.
    - HEAD, TRAINER, COACH: see only their own reports
    - ADMIN: see all reports
    """
    allowed_roles = {UserRole.HEAD, UserRole.TRAINER, UserRole.COACH, UserRole.ADMIN}
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    
    # ADMIN can see all reports, others see only their own
    if current_user.role == UserRole.ADMIN:
        return await learner_progress_report_crud.get_all_reports(db, skip=skip, limit=limit)
    else:
        return await learner_progress_report_crud.get_reports_by_creator(db, current_user.id, skip=skip, limit=limit)


@router.get("/learner/{learner_id}", response_model=List[LearnerProgressReportResponse])
async def get_learner_progress_reports(
    learner_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all progress reports for a specific learner created by the current user.
    - HEAD, TRAINER, COACH: see only reports they created for this learner
    - ADMIN: see all reports for this learner
    """
    allowed_roles = {UserRole.HEAD, UserRole.TRAINER, UserRole.COACH, UserRole.ADMIN}
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    
    # ADMIN can see all reports, others see only their own
    if current_user.role == UserRole.ADMIN:
        return await learner_progress_report_crud.get_reports_by_learner(db, learner_id)
    else:
        return await learner_progress_report_crud.get_reports_by_learner_and_creator(db, learner_id, current_user.id)


@router.get("/{report_id}", response_model=LearnerProgressReportResponse)
async def get_progress_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single progress report by ID."""
    report = await learner_progress_report_crud.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )
    return report


@router.put("/{report_id}", response_model=LearnerProgressReportResponse)
async def update_progress_report(
    report_id: int,
    update_data: LearnerProgressReportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing progress report."""
    allowed_roles = {UserRole.HEAD, UserRole.TRAINER, UserRole.COACH, UserRole.ADMIN}
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    report = await learner_progress_report_crud.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    return await learner_progress_report_crud.update_report(db, report, update_data)


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_progress_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a progress report."""
    allowed_roles = {UserRole.HEAD, UserRole.ADMIN}
    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Head or Admin can delete progress reports",
        )

    report = await learner_progress_report_crud.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found",
        )

    await learner_progress_report_crud.delete_report(db, report)


@router.post("/{report_id}/upload-pdf", response_model=LearnerProgressReportResponse)
async def upload_report_pdf(
    report_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload the generated PDF for a progress report to S3.
    Only executes when USE_S3=true (deploy). On local dev, returns the report unchanged.
    """
    allowed_roles = {UserRole.HEAD, UserRole.TRAINER, UserRole.COACH, UserRole.ADMIN}
    if current_user.role not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    report = await learner_progress_report_crud.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    # ── Local dev: skip S3 upload ──────────────────────────────────────────────
    if not settings.USE_S3:
        return report

    # ── Deploy: upload PDF to S3 ───────────────────────────────────────────────
    try:
        from app.utils.s3_utils import S3Manager

        file_content = await file.read()
        filename = f"progress_report_{report_id}_{uuid.uuid4().hex[:8]}.pdf"
        s3 = S3Manager(settings.S3_BUCKET_NAME)
        s3_key = s3.upload_file(
            file_content=file_content,
            folder="reports/progress",
            filename=filename,
            content_type="application/pdf",
        )
        public_url = s3.get_public_url(s3_key)
        return await learner_progress_report_crud.update_report_pdf_url(db, report, public_url)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload PDF to S3: {str(e)}",
        )
