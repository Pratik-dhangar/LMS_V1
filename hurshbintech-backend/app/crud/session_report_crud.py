"""Session Report CRUD Operations
"""

from typing import Dict, List

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.session_report_model import SessionReport
from app.models.session_model import TrainingSession
from app.models.user_model import User
from app.schemas.session_report import SessionReportCreate


async def create_session_report(
    db: AsyncSession, report_data: SessionReportCreate
) -> SessionReport:
    """Create a new session report"""
    db_report = SessionReport(
        session_id=report_data.session_id,
        learner_id=report_data.learner_id,
        program_id=report_data.program_id,
        program_name=report_data.program_name,
        prompt_meter=report_data.prompt_meter,
        reinforcement_meter=report_data.reinforcement_meter,
    )
    db.add(db_report)
    await db.commit()
    await db.refresh(db_report)
    return db_report


async def get_session_reports_by_session(db: AsyncSession, session_id: int) -> List[SessionReport]:
    """Get all reports for a specific session"""
    result = await db.execute(
        select(SessionReport)
        .where(SessionReport.session_id == session_id)
        .order_by(SessionReport.created_at)
    )
    return result.scalars().all()


async def get_session_reports_by_learner(db: AsyncSession, learner_id: int) -> List[SessionReport]:
    """Get all reports for a specific learner"""
    result = await db.execute(
        select(SessionReport)
        .where(SessionReport.learner_id == learner_id)
        .order_by(desc(SessionReport.created_at))
    )
    return result.scalars().all()


async def get_session_reports_by_learner_grouped(
    db: AsyncSession, learner_id: int
) -> Dict[str, List[SessionReport]]:
    """Get all reports for a learner grouped by program name"""
    result = await db.execute(
        select(SessionReport)
        .where(SessionReport.learner_id == learner_id)
        .order_by(SessionReport.program_name, desc(SessionReport.created_at))
    )
    reports = result.scalars().all()

    grouped = {}
    for report in reports:
        if report.program_name not in grouped:
            grouped[report.program_name] = []
        grouped[report.program_name].append(report)

    return grouped


async def get_session_reports_by_learner_grouped_with_details(
    db: AsyncSession, learner_id: int
) -> Dict[str, List[Dict]]:
    """Get all reports for a learner grouped by program name with session details"""
    # Fetch reports with session details
    result = await db.execute(
        select(SessionReport, TrainingSession)
        .join(TrainingSession, SessionReport.session_id == TrainingSession.id)
        .options(selectinload(TrainingSession.learning_goals))
        .where(SessionReport.learner_id == learner_id)
        .order_by(SessionReport.program_name, desc(SessionReport.created_at))
    )
    
    rows = result.all()
    
    grouped = {}
    for report, session in rows:
        # Get goal names from session
        goal_names = [goal.goal for goal in session.learning_goals] if session.learning_goals else []
        
        # Create enriched report dict
        enriched_report = {
            "id": report.id,
            "session_id": report.session_id,
            "learner_id": report.learner_id,
            "program_id": report.program_id,
            "program_name": report.program_name,
            "prompt_meter": report.prompt_meter,
            "reinforcement_meter": report.reinforcement_meter,
            "created_at": report.created_at,
            "session_started_at": session.started_at,
            "session_goals": goal_names
        }
        
        if report.program_name not in grouped:
            grouped[report.program_name] = []
        grouped[report.program_name].append(enriched_report)

    return grouped


async def get_learner_report_statistics(db: AsyncSession, learner_id: int) -> Dict:
    """Get statistics for learner reports (for charts)"""
    result = await db.execute(select(SessionReport).where(SessionReport.learner_id == learner_id))
    reports = result.scalars().all()

    prompt_dist = {}
    reinforcement_dist = {}
    program_breakdown = {}

    for report in reports:
        # Prompt distribution
        prompt_dist[report.prompt_meter] = prompt_dist.get(report.prompt_meter, 0) + 1

        # Reinforcement distribution
        reinforcement_dist[report.reinforcement_meter] = (
            reinforcement_dist.get(report.reinforcement_meter, 0) + 1
        )

        # Program breakdown
        program_breakdown[report.program_name] = program_breakdown.get(report.program_name, 0) + 1

    return {
        "prompt_distribution": prompt_dist,
        "reinforcement_distribution": reinforcement_dist,
        "program_breakdown": program_breakdown,
        "total_reports": len(reports),
    }


async def get_all_learners_with_reports(db: AsyncSession) -> List[Dict]:
    """Get all learners who have session reports with summary data"""
    learners_data = []

    # Get all learners with reports
    result = await db.execute(
        select(User).join(SessionReport, User.id == SessionReport.learner_id).distinct()
    )
    learners_with_reports = result.scalars().all()

    for learner in learners_with_reports:
        # Count total reports
        count_result = await db.execute(
            select(func.count(SessionReport.id)).where(SessionReport.learner_id == learner.id)
        )
        total_reports = count_result.scalar()

        # Count total sessions with reports
        sessions_result = await db.execute(
            select(func.count(func.distinct(SessionReport.session_id))).where(
                SessionReport.learner_id == learner.id
            )
        )
        total_sessions = sessions_result.scalar()

        # Get last session date
        last_result = await db.execute(
            select(SessionReport)
            .where(SessionReport.learner_id == learner.id)
            .order_by(desc(SessionReport.created_at))
            .limit(1)
        )
        last_report = last_result.scalar_one_or_none()

        # Get unique programs covered
        programs_result = await db.execute(
            select(func.distinct(SessionReport.program_name)).where(
                SessionReport.learner_id == learner.id
            )
        )
        programs_list = [p[0] for p in programs_result.all()]

        learners_data.append(
            {
                "learner_id": learner.id,
                "learner_name": learner.name,
                "iip_id": None,  # iip_id field doesn't exist in learner_profiles table
                "total_sessions": total_sessions,
                "total_reports": total_reports,
                "last_session_date": last_report.created_at if last_report else None,
                "programs_covered": programs_list,
            }
        )

    # Sort by last session date (most recent first)
    learners_data.sort(
        key=lambda x: x["last_session_date"] if x["last_session_date"] else "", reverse=True
    )

    return learners_data


async def delete_session_report(db: AsyncSession, report_id: int) -> bool:
    """Delete a session report"""
    result = await db.execute(select(SessionReport).where(SessionReport.id == report_id))
    report = result.scalar_one_or_none()
    if report:
        await db.delete(report)
        await db.commit()
        return True
    return False


async def get_overall_statistics(db: AsyncSession) -> Dict:
    """Get overall statistics across all learners (for bar graphs)"""
    result = await db.execute(select(SessionReport))
    reports = result.scalars().all()

    prompt_dist = {}
    reinforcement_dist = {}
    program_breakdown = {}
    learner_breakdown = {}

    for report in reports:
        # Prompt distribution
        prompt_dist[report.prompt_meter] = prompt_dist.get(report.prompt_meter, 0) + 1

        # Reinforcement distribution
        reinforcement_dist[report.reinforcement_meter] = (
            reinforcement_dist.get(report.reinforcement_meter, 0) + 1
        )

        # Program breakdown
        program_breakdown[report.program_name] = program_breakdown.get(report.program_name, 0) + 1

        # Learner breakdown
        learner_breakdown[report.learner_id] = learner_breakdown.get(report.learner_id, 0) + 1

    # Get learner names for the breakdown
    learner_names = {}
    for learner_id in learner_breakdown.keys():
        user_result = await db.execute(select(User).where(User.id == learner_id))
        user = user_result.scalar_one_or_none()
        if user:
            learner_names[learner_id] = user.name

    learner_breakdown_with_names = {
        learner_names.get(k, f"Learner {k}"): v for k, v in learner_breakdown.items()
    }

    return {
        "prompt_distribution": prompt_dist,
        "reinforcement_distribution": reinforcement_dist,
        "program_breakdown": program_breakdown,
        "learner_breakdown": learner_breakdown_with_names,
        "total_reports": len(reports),
        "total_learners": len(learner_breakdown),
        "total_programs": len(program_breakdown),
    }


async def get_program_statistics(db: AsyncSession, learner_id: int, program_name: str) -> Dict:
    """Get statistics for a specific program of a learner"""
    result = await db.execute(
        select(SessionReport)
        .where(SessionReport.learner_id == learner_id)
        .where(SessionReport.program_name == program_name)
        .order_by(SessionReport.created_at)
    )
    reports = result.scalars().all()

    prompt_dist = {}
    reinforcement_dist = {}
    progress_data = []

    for i, report in enumerate(reports):
        # Prompt distribution
        prompt_dist[report.prompt_meter] = prompt_dist.get(report.prompt_meter, 0) + 1

        # Reinforcement distribution
        reinforcement_dist[report.reinforcement_meter] = (
            reinforcement_dist.get(report.reinforcement_meter, 0) + 1
        )

        # Progress over time
        prompt_value = 0 if report.prompt_meter == "I" else int(report.prompt_meter)
        reinforcement_value = (
            100 if report.reinforcement_meter == "Full" else int(report.reinforcement_meter)
        )

        progress_data.append(
            {
                "session_number": i + 1,
                "date": report.created_at.isoformat() if report.created_at else None,
                "prompt_meter": report.prompt_meter,
                "prompt_value": prompt_value,
                "reinforcement_meter": report.reinforcement_meter,
                "reinforcement_value": reinforcement_value,
            }
        )

    return {
        "program_name": program_name,
        "prompt_distribution": prompt_dist,
        "reinforcement_distribution": reinforcement_dist,
        "progress_data": progress_data,
        "total_reports": len(reports),
    }


async def get_unique_learners_from_session_reports(db: AsyncSession) -> List[Dict]:
    """Get all unique learners from session reports with their summary data"""
    learners_data = []

    # Get all unique learners from session_reports
    result = await db.execute(
        select(User)
        .join(SessionReport, User.id == SessionReport.learner_id)
        .distinct()
        .order_by(User.name)
    )
    learners = result.scalars().all()

    for learner in learners:
        # Count total reports
        count_result = await db.execute(
            select(func.count(SessionReport.id)).where(SessionReport.learner_id == learner.id)
        )
        total_reports = count_result.scalar()

        # Count total unique sessions
        sessions_result = await db.execute(
            select(func.count(func.distinct(SessionReport.session_id))).where(
                SessionReport.learner_id == learner.id
            )
        )
        total_sessions = sessions_result.scalar()

        # Get last report date
        last_result = await db.execute(
            select(SessionReport)
            .where(SessionReport.learner_id == learner.id)
            .order_by(desc(SessionReport.created_at))
            .limit(1)
        )
        last_report = last_result.scalar_one_or_none()

        # Get unique programs
        programs_result = await db.execute(
            select(func.distinct(SessionReport.program_name)).where(
                SessionReport.learner_id == learner.id
            )
        )
        programs_list = [p[0] for p in programs_result.all()]

        learners_data.append(
            {
                "learner_id": learner.id,
                "learner_name": learner.name,
                "total_sessions": total_sessions,
                "total_reports": total_reports,
                "last_session_date": last_report.created_at if last_report else None,
                "programs_covered": programs_list,
            }
        )

    return learners_data


async def get_programs_by_learner(db: AsyncSession, learner_id: int) -> List[Dict]:
    """Get all unique programs/goals for a specific learner with summary data"""
    programs_data = []

    # Get all unique programs for this learner
    result = await db.execute(
        select(func.distinct(SessionReport.program_name), SessionReport.program_id)
        .where(SessionReport.learner_id == learner_id)
        .order_by(SessionReport.program_name)
    )
    programs = result.all()

    for program_name, program_id in programs:
        # Count reports for this program
        count_result = await db.execute(
            select(func.count(SessionReport.id))
            .where(SessionReport.learner_id == learner_id)
            .where(SessionReport.program_name == program_name)
        )
        total_reports = count_result.scalar()

        # Get latest report date
        last_result = await db.execute(
            select(SessionReport.created_at)
            .where(SessionReport.learner_id == learner_id)
            .where(SessionReport.program_name == program_name)
            .order_by(desc(SessionReport.created_at))
            .limit(1)
        )
        last_date = last_result.scalar_one_or_none()

        programs_data.append(
            {
                "program_id": program_id,
                "program_name": program_name,
                "total_sessions": total_reports,
                "last_session_date": last_date,
            }
        )

    return programs_data


async def get_session_data_by_program(
    db: AsyncSession, learner_id: int, program_name: str
) -> List[Dict]:
    """Get all session data for a specific program/goal of a learner for graph visualization"""
    # Fetch all reports for this learner and program with session details
    result = await db.execute(
        select(SessionReport, TrainingSession)
        .join(TrainingSession, SessionReport.session_id == TrainingSession.id)
        .where(SessionReport.learner_id == learner_id)
        .where(SessionReport.program_name == program_name)
        .order_by(SessionReport.created_at)
    )
    
    rows = result.all()
    
    session_data = []
    for idx, (report, session) in enumerate(rows, start=1):
        # Convert prompt meter to numeric value
        prompt_value = 0 if report.prompt_meter == "I" else int(report.prompt_meter)
        
        # Convert reinforcement meter to numeric value
        reinforcement_value = (
            100 if report.reinforcement_meter == "Full" else int(report.reinforcement_meter)
        )
        
        session_data.append({
            "session_number": idx,
            "session_id": report.session_id,
            "session_name": f"Session {idx}",
            "prompt_meter": report.prompt_meter,
            "prompt_value": prompt_value,
            "reinforcement_meter": report.reinforcement_meter,
            "reinforcement_value": reinforcement_value,
            "created_at": report.created_at,
            "session_start_time": session.session_start_time,
            "session_date": session.session_start_time or session.started_at or session.scheduled_date,
        })
    
    return session_data
