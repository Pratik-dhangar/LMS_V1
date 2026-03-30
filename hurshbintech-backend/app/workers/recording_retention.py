"""
Recording retention and cleanup job.
Automatically deletes recordings older than 30 days to manage storage costs.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import select

from app.db.session import get_db
from app.models.coach_session_model import CoachAppointmentSession
from app.models.session_model import TrainingSession
from app.services.recording_storage import get_recording_storage

logger = logging.getLogger(__name__)


async def cleanup_old_recordings():
    """
    Delete recordings older than 30 days from their creation date.
    
    This job should be run daily via cron, APScheduler, or Celery Beat.
    
    Process:
    1. Find sessions with recording_url where created_at is older than 30 days
    2. Delete each recording individually from storage backend (local or S3)
    3. Update database recording fields for each deleted recording
    4. Log summary results
    
    Returns:
        dict: Summary of cleanup operation
    """
    retention_days = 30
    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
    
    deleted_count = 0
    failed_count = 0
    
    logger.info(f"Starting recording cleanup for recordings older than {cutoff_date}")
    
    try:
        # Get database session
        async for db in get_db():
            # Find old training session recordings by session creation timestamp
            training_query = select(TrainingSession).where(
                TrainingSession.created_at < cutoff_date,
                TrainingSession.recording_url.isnot(None),
                TrainingSession.recording_status == "completed"
            )
            training_result = await db.execute(training_query)
            training_sessions = training_result.scalars().all()

            # Find old coach appointment session recordings by session creation timestamp
            coach_query = select(CoachAppointmentSession).where(
                CoachAppointmentSession.created_at < cutoff_date,
                CoachAppointmentSession.recording_url.isnot(None),
                CoachAppointmentSession.recording_status == "completed"
            )
            coach_result = await db.execute(coach_query)
            coach_sessions = coach_result.scalars().all()

            total_sessions = len(training_sessions) + len(coach_sessions)
            logger.info(
                "Found %s recordings to clean up (training=%s, coach=%s)",
                total_sessions,
                len(training_sessions),
                len(coach_sessions),
            )
            
            # Get storage backend
            storage = get_recording_storage()
            
            # Process each training session recording individually
            for session in training_sessions:
                try:
                    # Delete from storage
                    await storage.delete(session.recording_url)
                    
                    # Clear database fields
                    session.recording_url = None
                    session.recording_status = "deleted"
                    
                    deleted_count += 1
                    logger.info("Deleted training session recording for session_id=%s", session.id)
                    
                except Exception as e:
                    failed_count += 1
                    logger.error("Failed to delete training recording for session_id=%s: %s", session.id, e)

            # Process each coach appointment session recording individually
            for session in coach_sessions:
                try:
                    # Delete from storage
                    await storage.delete(session.recording_url)

                    # Clear database fields
                    session.recording_url = None
                    session.recording_status = "deleted"
                    session.recording_uploaded_at = None

                    deleted_count += 1
                    logger.info("Deleted coach session recording for session_id=%s", session.id)

                except Exception as e:
                    failed_count += 1
                    logger.error("Failed to delete coach recording for session_id=%s: %s", session.id, e)
            
            # Commit changes
            await db.commit()
            
            logger.info(
                f"Cleanup completed: {deleted_count} deleted, {failed_count} failed"
            )
            
            return {
                "status": "completed",
                "deleted": deleted_count,
                "failed": failed_count,
                "matched": total_sessions,
                "cutoff_date": cutoff_date.isoformat()
            }
            
    except Exception as e:
        logger.error(f"Recording cleanup job failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "deleted": deleted_count,
            "failed": failed_count
        }


async def cleanup_failed_recordings():
    """
    Clean up recordings that failed to upload.
    
    This job finds sessions where recording_status = "failed" and
    clears the recording fields to allow retry or manual intervention.
    
    Returns:
        dict: Summary of cleanup operation
    """
    cleaned_count = 0
    
    logger.info("Starting failed recording cleanup")
    
    try:
        async for db in get_db():
            # Find sessions with failed recordings
            query = select(TrainingSession).where(
                TrainingSession.recording_status == "failed"
            )
            
            result = await db.execute(query)
            sessions = result.scalars().all()
            
            logger.info(f"Found {len(sessions)} failed recordings")
            
            for session in sessions:
                # If file path exists, try to clean it up
                if session.recording_url:
                    try:
                        storage = get_recording_storage()
                        await storage.delete(session.recording_url)
                        logger.info(f"Cleaned up failed recording file for session {session.id}")
                    except Exception as e:
                        logger.warning(f"Could not delete failed recording file: {e}")
                
                # Clear fields
                session.recording_url = None
                session.recording_status = "pending"
                cleaned_count += 1
            
            await db.commit()
            
            logger.info(f"Failed recording cleanup completed: {cleaned_count} cleaned")
            
            return {
                "status": "completed",
                "cleaned": cleaned_count
            }
            
    except Exception as e:
        logger.error(f"Failed recording cleanup job error: {e}")
        return {
            "status": "error",
            "error": str(e),
            "cleaned": cleaned_count
        }


# ============================================================================
# CRON JOB SETUP INSTRUCTIONS
# ============================================================================
"""
To run these cleanup jobs automatically, add one of the following:

1. APScheduler (in main.py):
```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.workers.recording_retention import cleanup_old_recordings

scheduler = AsyncIOScheduler()
scheduler.add_job(cleanup_old_recordings, 'cron', hour=2, minute=0)  # Daily at 2 AM
scheduler.start()
```

2. Celery Beat (in celery_worker.py):
```python
from celery import Celery
from app.workers.recording_retention import cleanup_old_recordings

app = Celery('hurshbintech')

@app.task
def cleanup_recordings_task():
    import asyncio
    return asyncio.run(cleanup_old_recordings())

app.conf.beat_schedule = {
    'cleanup-old-recordings': {
        'task': 'cleanup_recordings_task',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2 AM
    },
}
```

3. System Cron (requires Python script wrapper):
Create script: /usr/local/bin/cleanup_recordings.py
```python
#!/usr/bin/env python3
import asyncio
from app.workers.recording_retention import cleanup_old_recordings

if __name__ == "__main__":
    asyncio.run(cleanup_old_recordings())
```

Then add to crontab:
```bash
0 2 * * * /usr/local/bin/cleanup_recordings.py >> /var/log/recording_cleanup.log 2>&1
```

4. Docker Compose (separate service):
```yaml
services:
  cleanup-worker:
    build: ./hurshbintech-backend
    command: python -m app.workers.recording_retention
    environment:
      - RECORDING_STORAGE_MODE=s3
    depends_on:
      - postgres
```
"""
