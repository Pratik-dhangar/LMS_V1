"""
Session data purge job.
Automatically deletes training sessions and associated records older than 30 days.
Only keeps data for the last 30 days to optimize storage and performance.
"""

import logging
from datetime import datetime, timedelta
from sqlalchemy import select, delete
from app.db.session import AsyncSessionLocal
from app.models.session_model import TrainingSession
from app.models.Chat.chat_model import Message
# Import other related models to ensure they are cleared if needed
# Although cascade deletes should handle most, we can be explicit or rely on DB constraints

logger = logging.getLogger(__name__)

async def purge_old_sessions():
    """
    Delete training sessions older than 30 days.
    
    This job should be run daily via cron or scheduler.
    
    Process:
    1. Calculate cutoff date (30 days ago)
    2. Find and delete sessions older than cutoff
    3. Log results
    """
    retention_days = 30
    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
    
    deleted_count = 0
    
    logger.info(f"Starting session purge for sessions older than {cutoff_date} UTC")
    
    try:
        async with AsyncSessionLocal() as db:
            # We use a direct delete query for efficiency
            # Note: Ensure your database has ON DELETE CASCADE for related tables 
            # (session_reports, session_notes, learning_goal_assignments, etc.)
            
            # First, let's find how many we are about to delete for logging
            count_query = select(TrainingSession).where(TrainingSession.scheduled_date < cutoff_date)
            result = await db.execute(count_query)
            sessions_to_delete = result.scalars().all()
            total_to_delete = len(sessions_to_delete)
            
            if total_to_delete > 0:
                # Delete sessions - this assumes cascade deletes are set up in DB
                # If not, we would need to manually delete related records first
                delete_stmt = delete(TrainingSession).where(TrainingSession.scheduled_date < cutoff_date)
                await db.execute(delete_stmt)
                await db.commit()
                deleted_count = total_to_delete
                
            logger.info(f"Session purge completed: {deleted_count} sessions deleted.")
            
            return {
                "status": "completed",
                "sessions_deleted": deleted_count,
                "cutoff_date": cutoff_date.isoformat()
            }
            
    except Exception as e:
        logger.error(f"Session purge job failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "sessions_deleted": deleted_count
        }
