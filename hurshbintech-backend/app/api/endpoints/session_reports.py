"""
Manage Learning Progress API Endpoints
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.deps import get_current_user, get_db, get_current_head
from app.crud import session_report_crud
from app.models.user_model import User, UserRole, HeadProfile
from app.schemas.session_report import (
    LearnerReportSummary,
    SessionReportCreate,
    SessionReportResponse,
    SessionReportStatistics,
)
from app.services.email_service import EmailService
from pydantic import BaseModel

router = APIRouter()


@router.post("/", response_model=SessionReportResponse, status_code=status.HTTP_201_CREATED)
async def create_session_report(
    report_data: SessionReportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new session report (Trainer only)
    """
    print(
        f"[create_session_report] Current user: id={current_user.id}, role={current_user.role}, role_type={type(current_user.role)}"
    )

    if current_user.role != UserRole.TRAINER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only trainers can create session reports"
        )

    try:
        report = await session_report_crud.create_session_report(db, report_data)
        return report
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create session report: {str(e)}",
        )


@router.get("/session/{session_id}", response_model=List[SessionReportResponse])
async def get_session_reports(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
):
    """
    Get all reports for a learner grouped by program name
    """
    grouped_reports = await session_report_crud.get_session_reports_by_learner_grouped_with_details(
        db, learner_id
    )

    # Convert to response format
    result = []
    for program_name, reports in grouped_reports.items():
        result.append(
            {
                "program_name": program_name,
                "program_id": reports[0]["program_id"] if reports else None,
                "reports": reports,
                "total_records": len(reports),
            }
        )

    return result


@router.get("/learner/{learner_id}/statistics", response_model=SessionReportStatistics)
async def get_learner_statistics(
    learner_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get statistics for learner reports (for charts)
    """
    stats = await session_report_crud.get_learner_report_statistics(db, learner_id)
    return stats


@router.get("/learners/summary", response_model=List[LearnerReportSummary])
async def get_learners_summary(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """
    Get all learners with report summaries (Head and Admin)
    """
    if current_user.role not in [UserRole.HEAD, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only heads and admins can access learner summaries"
        )

    learners_data = await session_report_crud.get_all_learners_with_reports(db)
    return learners_data


@router.get("/overall/statistics")
async def get_overall_statistics(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """
    Get overall statistics across all learners (Head and Admin)
    """
    if current_user.role not in [UserRole.HEAD, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only heads and admins can access overall statistics"
        )

    stats = await session_report_crud.get_overall_statistics(db)
    return stats


@router.get("/unique-learners")
async def get_unique_learners(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all unique learners from session reports (Head and Admin)
    - HEAD: sees only their own learners
    - ADMIN: sees all learners
    """
    if current_user.role not in [UserRole.HEAD, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only heads and admins can access this endpoint",
        )

    # If HEAD, only show learners created by this head
    if current_user.role == UserRole.HEAD:
        result = await db.execute(
            select(HeadProfile).where(HeadProfile.user_id == current_user.id)
        )
        head_profile = result.scalar_one_or_none()
        if not head_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Head profile not found",
            )
        learners = await session_report_crud.get_unique_learners_from_session_reports(db, head_id=head_profile.id)
    else:
        # ADMIN sees all learners
        learners = await session_report_crud.get_unique_learners_from_session_reports(db)
    
    return learners


class SendGoalsReportRequest(BaseModel):
    sent_by_name: Optional[str] = "Your Training Head"


@router.post("/send-goals-report/{learner_id}")
async def send_learner_goals_report(
    learner_id: int,
    body: SendGoalsReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Send the Skill Development Graph  summary to the learner's registered email.
    Only heads and admins can send this.
    """
    if current_user.role not in [UserRole.HEAD, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only heads and admins can send this report",
        )

    # Fetch learner user record to get email
    result = await db.execute(select(User).where(User.id == learner_id))
    learner = result.scalar_one_or_none()
    if not learner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learner not found")

    if not learner.email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Learner does not have a registered email address",
        )

    # Fetch programs / goals covered by this learner
    learner_data_list = await session_report_crud.get_unique_learners_from_session_reports(db)
    learner_data = next((ld for ld in learner_data_list if ld["learner_id"] == learner_id), None)

    programs_covered: list = learner_data["programs_covered"] if learner_data else []
    total_sessions: int = learner_data["total_sessions"] if learner_data else 0
    last_session_date = None
    if learner_data and learner_data.get("last_session_date"):
        try:
            last_session_date = learner_data["last_session_date"].strftime("%d %b %Y")
        except Exception:
            last_session_date = str(learner_data["last_session_date"])

    sent_by_name = body.sent_by_name or current_user.name or "Your Training Head"

    success = await EmailService.send_learner_goals_report(
        recipient_email=learner.email,
        recipient_name=learner.name or learner.email,
        programs_covered=programs_covered,
        total_sessions=total_sessions,
        last_session_date=last_session_date,
        sent_by_name=sent_by_name,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send email. Please check email configuration.",
        )

    return {"success": True, "message": f"Goals report sent to {learner.email}"}


@router.get("/learner/{learner_id}/programs")
async def get_learner_programs(
    learner_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all unique programs/goals for a specific learner (Head, Admin, or the learner themselves)
    """
    if current_user.role == UserRole.LEARNER:
        if current_user.id != learner_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Learners can only access their own programs",
            )
    elif current_user.role not in [UserRole.HEAD, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only heads, admins, or the learner themselves can access this endpoint",
        )

    programs = await session_report_crud.get_programs_by_learner(db, learner_id)
    return programs


@router.get("/learner/{learner_id}/program-sessions")
async def get_program_session_data(
    learner_id: int,
    program_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all session data for a specific program/goal for graph visualization.
    Use query parameter for program_name to handle special characters like /
    """
    print(f"[get_program_session_data] learner_id={learner_id}, program_name={program_name}")
    
    if current_user.role == UserRole.LEARNER:
        if current_user.id != learner_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Learners can only access their own program data",
            )
    elif current_user.role not in [UserRole.HEAD, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only heads, admins, or the learner themselves can access this endpoint",
        )

    session_data = await session_report_crud.get_session_data_by_program(
        db, learner_id, program_name
    )
    print(f"[get_program_session_data] Returning {len(session_data)} sessions")
    return session_data


@router.get("/learner/{learner_id}/program/{program_name}/statistics")
async def get_program_statistics(
    learner_id: int,
    program_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
):
    """
    Delete a session report (Head or Trainer who created it)
    """
    if current_user.role not in ["head", "trainer"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only heads or trainers can delete reports",
        )

    success = await session_report_crud.delete_session_report(db, report_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")


@router.get("/learner/{learner_id}/pdf-data")
async def get_learner_pdf_data(
    learner_id: int,
    program_name: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get comprehensive data for PDF generation
    Supports both single program and all programs report
    HEAD: can only access learners they created
    """
    try:
        # Allow learners to access their own PDF data
        if current_user.role == UserRole.LEARNER:
            if current_user.id != learner_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Learners can only access their own report data",
                )
            learner_user = await db.execute(select(User).where(User.id == learner_id))
            learner_user = learner_user.scalar_one_or_none()
            if not learner_user:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Learner not found")
            learners = [{"learner_id": learner_user.id, "learner_name": learner_user.name}]
        # Get learner info - filter by head if not admin
        elif current_user.role == UserRole.HEAD:
            result = await db.execute(
                select(HeadProfile).where(HeadProfile.user_id == current_user.id)
            )
            head_profile = result.scalar_one_or_none()
            if not head_profile:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Head profile not found",
                )
            learners = await session_report_crud.get_unique_learners_from_session_reports(db, head_id=head_profile.id)
        else:
            # ADMIN sees all
            learners = await session_report_crud.get_unique_learners_from_session_reports(db)
        
        learner = next((l for l in learners if l["learner_id"] == learner_id), None)
        
        if not learner:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Learner not found"
            )
        
        # If specific program requested
        if program_name:
            session_data = await session_report_crud.get_session_data_by_program(
                db, learner_id, program_name
            )
            
            return {
                "learner_name": learner["learner_name"],
                "program_name": program_name,
                "total_sessions": len(session_data),
                "sessions": session_data,
                "type": "single_program"
            }
        
        # Get all programs for the learner
        programs = await session_report_crud.get_programs_by_learner(db, learner_id)
        
        # Fetch session data for each program
        programs_with_sessions = []
        for program in programs:
            try:
                session_data = await session_report_crud.get_session_data_by_program(
                    db, learner_id, program["program_name"]
                )
                programs_with_sessions.append({
                    "program_name": program["program_name"],
                    "program_id": program.get("program_id"),
                    "total_sessions": len(session_data),
                    "last_session_date": program.get("last_session_date"),
                    "sessions": session_data
                })
            except Exception as e:
                print(f"Error fetching data for program {program['program_name']}: {str(e)}")
                # Continue with other programs even if one fails
                programs_with_sessions.append({
                    "program_name": program["program_name"],
                    "program_id": program.get("program_id"),
                    "total_sessions": 0,
                    "last_session_date": program.get("last_session_date"),
                    "sessions": []
                })
        
        return {
            "learner_name": learner["learner_name"],
            "programs": programs_with_sessions,
            "total_programs": len(programs_with_sessions),
            "type": "all_programs"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_learner_pdf_data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch PDF data: {str(e)}"
        )
