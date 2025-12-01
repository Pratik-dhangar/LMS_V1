"""
Session Report CRUD Operations
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import joinedload
from typing import List, Optional, Dict
from app.models.session_report_model import SessionReport
from app.models.user_model import User, LearnerProfile
from app.models.session_model import TrainingSession
from app.schemas.session_report import SessionReportCreate


async def create_session_report(db: AsyncSession, report_data: SessionReportCreate) -> SessionReport:
    """Create a new session report"""
    db_report = SessionReport(
        session_id=report_data.session_id,
        learner_id=report_data.learner_id,
        program_id=report_data.program_id,
        program_name=report_data.program_name,
        prompt_meter=report_data.prompt_meter,
        reinforcement_meter=report_data.reinforcement_meter
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


async def get_session_reports_by_learner_grouped(db: AsyncSession, learner_id: int) -> Dict[str, List[SessionReport]]:
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


async def get_learner_report_statistics(db: AsyncSession, learner_id: int) -> Dict:
    """Get statistics for learner reports (for charts)"""
    result = await db.execute(
        select(SessionReport).where(SessionReport.learner_id == learner_id)
    )
    reports = result.scalars().all()
    
    prompt_dist = {}
    reinforcement_dist = {}
    program_breakdown = {}
    
    for report in reports:
        # Prompt distribution
        prompt_dist[report.prompt_meter] = prompt_dist.get(report.prompt_meter, 0) + 1
        
        # Reinforcement distribution
        reinforcement_dist[report.reinforcement_meter] = reinforcement_dist.get(report.reinforcement_meter, 0) + 1
        
        # Program breakdown
        program_breakdown[report.program_name] = program_breakdown.get(report.program_name, 0) + 1
    
    return {
        "prompt_distribution": prompt_dist,
        "reinforcement_distribution": reinforcement_dist,
        "program_breakdown": program_breakdown,
        "total_reports": len(reports)
    }


async def get_all_learners_with_reports(db: AsyncSession) -> List[Dict]:
    """Get all learners who have session reports with summary data"""
    learners_data = []
    
    # Get all learners with reports
    result = await db.execute(
        select(User)
        .join(SessionReport, User.id == SessionReport.learner_id)
        .distinct()
    )
    learners_with_reports = result.scalars().all()
    
    for learner in learners_with_reports:
        # Get learner profile for IIP ID
        profile_result = await db.execute(
            select(LearnerProfile).where(LearnerProfile.user_id == learner.id)
        )
        learner_profile = profile_result.scalar_one_or_none()
        
        # Count total reports
        count_result = await db.execute(
            select(func.count(SessionReport.id)).where(SessionReport.learner_id == learner.id)
        )
        total_reports = count_result.scalar()
        
        # Count total sessions with reports
        sessions_result = await db.execute(
            select(func.count(func.distinct(SessionReport.session_id)))
            .where(SessionReport.learner_id == learner.id)
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
            select(func.distinct(SessionReport.program_name))
            .where(SessionReport.learner_id == learner.id)
        )
        programs_list = [p[0] for p in programs_result.all()]
        
        learners_data.append({
            "learner_id": learner.id,
            "learner_name": learner.name,
            "iip_id": None,  # iip_id field doesn't exist in learner_profiles table
            "total_sessions": total_sessions,
            "total_reports": total_reports,
            "last_session_date": last_report.created_at if last_report else None,
            "programs_covered": programs_list
        })
    
    # Sort by last session date (most recent first)
    learners_data.sort(key=lambda x: x["last_session_date"] if x["last_session_date"] else "", reverse=True)
    
    return learners_data


async def delete_session_report(db: AsyncSession, report_id: int) -> bool:
    """Delete a session report"""
    result = await db.execute(
        select(SessionReport).where(SessionReport.id == report_id)
    )
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
        reinforcement_dist[report.reinforcement_meter] = reinforcement_dist.get(report.reinforcement_meter, 0) + 1
        
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
        learner_names.get(k, f"Learner {k}"): v 
        for k, v in learner_breakdown.items()
    }
    
    return {
        "prompt_distribution": prompt_dist,
        "reinforcement_distribution": reinforcement_dist,
        "program_breakdown": program_breakdown,
        "learner_breakdown": learner_breakdown_with_names,
        "total_reports": len(reports),
        "total_learners": len(learner_breakdown),
        "total_programs": len(program_breakdown)
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
        reinforcement_dist[report.reinforcement_meter] = reinforcement_dist.get(report.reinforcement_meter, 0) + 1
        
        # Progress over time
        prompt_value = 0 if report.prompt_meter == 'I' else int(report.prompt_meter)
        reinforcement_value = 100 if report.reinforcement_meter == 'Full' else int(report.reinforcement_meter)
        
        progress_data.append({
            "session_number": i + 1,
            "date": report.created_at.isoformat() if report.created_at else None,
            "prompt_meter": report.prompt_meter,
            "prompt_value": prompt_value,
            "reinforcement_meter": report.reinforcement_meter,
            "reinforcement_value": reinforcement_value
        })
    
    return {
        "program_name": program_name,
        "prompt_distribution": prompt_dist,
        "reinforcement_distribution": reinforcement_dist,
        "progress_data": progress_data,
        "total_reports": len(reports)
    }
