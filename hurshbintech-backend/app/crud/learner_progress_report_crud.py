"""
CRUD operations for Learner Progress Reports
"""

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.learner_progress_report_model import LearnerProgressReport
from app.schemas.learner_progress_report import (
    LearnerProgressReportCreate,
    LearnerProgressReportUpdate,
)


async def create_report(
    db: AsyncSession,
    report_data: LearnerProgressReportCreate,
    created_by_id: int,
) -> LearnerProgressReport:
    """Create a new learner progress report."""
    report = LearnerProgressReport(
        **report_data.model_dump(),
        created_by_id=created_by_id,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return report


async def get_report_by_id(
    db: AsyncSession, report_id: int
) -> Optional[LearnerProgressReport]:
    """Fetch a single report by ID."""
    result = await db.execute(
        select(LearnerProgressReport).where(LearnerProgressReport.id == report_id)
    )
    return result.scalar_one_or_none()


async def get_reports_by_learner(
    db: AsyncSession, learner_id: int
) -> List[LearnerProgressReport]:
    """Fetch all reports for a specific learner."""
    result = await db.execute(
        select(LearnerProgressReport)
        .where(LearnerProgressReport.learner_id == learner_id)
        .order_by(LearnerProgressReport.created_at.desc())
    )
    return list(result.scalars().all())


async def get_all_reports(
    db: AsyncSession, skip: int = 0, limit: int = 100
) -> List[LearnerProgressReport]:
    """Fetch all reports (paginated)."""
    result = await db.execute(
        select(LearnerProgressReport)
        .order_by(LearnerProgressReport.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def update_report(
    db: AsyncSession,
    report: LearnerProgressReport,
    update_data: LearnerProgressReportUpdate,
) -> LearnerProgressReport:
    """Update an existing report."""
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(report, field, value)
    await db.commit()
    await db.refresh(report)
    return report


async def update_report_pdf_url(
    db: AsyncSession,
    report: LearnerProgressReport,
    pdf_url: str,
) -> LearnerProgressReport:
    """Store the S3 PDF URL on an existing report."""
    report.pdf_url = pdf_url
    await db.commit()
    await db.refresh(report)
    return report


async def delete_report(db: AsyncSession, report: LearnerProgressReport) -> None:
    """Delete a report."""
    await db.delete(report)
    await db.commit()
