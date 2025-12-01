"""
Session Reports API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict

from app.core.deps import get_db, get_current_user
from app.models.user_model import User, UserRole
from app.schemas.session_report import (
    SessionReportCreate,
    SessionReportResponse,
    SessionReportStatistics,
    LearnerReportSummary
)
from app.crud import session_report_crud

router = APIRouter()


@router.post("/", response_model=SessionReportResponse, status_code=status.HTTP_201_CREATED)
async def create_session_report(
    report_data: SessionReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new session report (Trainer only)
    """
    print(f"[create_session_report] Current user: id={current_user.id}, role={current_user.role}, role_type={type(current_user.role)}")
    
    if current_user.role != UserRole.TRAINER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only trainers can create session reports"
        )
    
    try:
        report = await session_report_crud.create_session_report(db, report_data)
        return report
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create session report: {str(e)}"
        )


@router.get("/session/{session_id}", response_model=List[SessionReportResponse])
async def get_session_reports(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all reports for a specific session
    """
    reports = await session_report_crud.get_session_reports_by_session(db, session_id)
    return reports


@router.get("/learner/{learner_id}", response_model=List[SessionReportResponse])
async def get_learner_reports(
    learner_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all reports for a specific learner
    """
    reports = await session_report_crud.get_session_reports_by_learner(db, learner_id)
    return reports


@router.get("/learner/{learner_id}/grouped")
async def get_learner_reports_grouped(
    learner_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all reports for a learner grouped by program name
    """
    grouped_reports = await session_report_crud.get_session_reports_by_learner_grouped(db, learner_id)
    
    # Convert to response format
    result = []
    for program_name, reports in grouped_reports.items():
        result.append({
            "program_name": program_name,
            "program_id": reports[0].program_id if reports else None,
            "reports": reports,
            "total_records": len(reports)
        })
    
    return result


@router.get("/learner/{learner_id}/statistics", response_model=SessionReportStatistics)
async def get_learner_statistics(
    learner_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics for learner reports (for charts)
    """
    stats = await session_report_crud.get_learner_report_statistics(db, learner_id)
    return stats


@router.get("/learners/summary", response_model=List[LearnerReportSummary])
async def get_learners_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all learners with report summaries (Head only)
    """
    if current_user.role != UserRole.HEAD:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only heads can access learner summaries"
        )
    
    learners_data = await session_report_crud.get_all_learners_with_reports(db)
    return learners_data


@router.get("/overall/statistics")
async def get_overall_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get overall statistics across all learners (Head only)
    """
    if current_user.role != UserRole.HEAD:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only heads can access overall statistics"
        )
    
    stats = await session_report_crud.get_overall_statistics(db)
    return stats


@router.get("/learner/{learner_id}/program/{program_name}/statistics")
async def get_program_statistics(
    learner_id: int,
    program_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics for a specific program of a learner
    """
    stats = await session_report_crud.get_program_statistics(db, learner_id, program_name)
    return stats


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a session report (Head or Trainer who created it)
    """
    if current_user.role not in ["head", "trainer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only heads or trainers can delete reports"
        )
    
    success = await session_report_crud.delete_session_report(db, report_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
