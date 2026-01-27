"""
Chat message auto-deletion job.
Automatically deletes chat messages older than 7 days (auto-disappearing messages).
"""

import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db, AsyncSessionLocal
from app.models.Chat.chat_model import Message
from app.core.config import settings

logger = logging.getLogger(__name__)


async def cleanup_old_messages():
    """
    Delete chat messages older than 7 days.
    
    This job should be run daily via cron or scheduler.
    
    Process:
    1. Find all messages older than 7 days
    2. Delete associated files from storage (if any)
    3. Delete messages from database
    4. Log results
    
    Returns:
        dict: Summary of cleanup operation
    """
    retention_days = 7
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=retention_days)
    
    deleted_count = 0
    failed_count = 0
    files_deleted = 0
    
    logger.info(f"Starting chat message cleanup for messages older than {cutoff_date}")
    
    try:
        # Get database session
        async with AsyncSessionLocal() as db:
            # Find messages older than 7 days
            query = select(Message).where(
                Message.created_at < cutoff_date,
                Message.is_deleted == False
            )
            
            result = await db.execute(query)
            messages = result.scalars().all()
            
            logger.info(f"Found {len(messages)} messages to delete")
            
            # Process each message
            for message in messages:
                try:
                    # Delete file if exists
                    if message.file_url:
                        file_deleted = await delete_message_file(message.file_url)
                        if file_deleted:
                            files_deleted += 1
                    
                    # Delete message from database (hard delete)
                    await db.delete(message)
                    deleted_count += 1
                    
                except Exception as e:
                    failed_count += 1
                    logger.error(f"Failed to delete message {message.id}: {e}")
            
            # Commit changes
            await db.commit()
            
            logger.info(
                f"Cleanup completed: {deleted_count} messages deleted, "
                f"{files_deleted} files deleted, {failed_count} failed"
            )
            
            return {
                "status": "completed",
                "messages_deleted": deleted_count,
                "files_deleted": files_deleted,
                "failed": failed_count,
                "cutoff_date": cutoff_date.isoformat()
            }
            
    except Exception as e:
        logger.error(f"Chat message cleanup job failed: {e}")
        return {
            "status": "error",
            "error": str(e),
            "messages_deleted": deleted_count,
            "files_deleted": files_deleted,
            "failed": failed_count
        }


async def delete_message_file(file_url: str) -> bool:
    """
    Delete a message file from storage.
    
    Args:
        file_url: The file URL/path to delete
        
    Returns:
        bool: True if file was deleted successfully, False otherwise
    """
    try:
        # Check if it's an S3 URL or local file
        if file_url.startswith("http://") or file_url.startswith("https://"):
            # S3 file - extract key and delete from S3
            if settings.AWS_S3_BUCKET_NAME:
                try:
                    import boto3
                    from botocore.exceptions import ClientError
                    
                    # Extract S3 key from URL
                    # Expected format: https://bucket.s3.region.amazonaws.com/key
                    # or https://s3.region.amazonaws.com/bucket/key
                    s3_key = file_url.split(f"{settings.AWS_S3_BUCKET_NAME}/")[-1]
                    
                    s3_client = boto3.client(
                        's3',
                        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                        region_name=settings.AWS_REGION
                    )
                    
                    s3_client.delete_object(
                        Bucket=settings.AWS_S3_BUCKET_NAME,
                        Key=s3_key
                    )
                    
                    logger.info(f"Deleted S3 file: {s3_key}")
                    return True
                    
                except ClientError as e:
                    logger.error(f"Failed to delete S3 file {file_url}: {e}")
                    return False
            else:
                logger.warning(f"S3 bucket not configured, skipping S3 file deletion: {file_url}")
                return False
        else:
            # Local file
            upload_dir = Path(settings.UPLOAD_DIR) if hasattr(settings, 'UPLOAD_DIR') else Path("uploads")
            file_path = upload_dir / file_url.lstrip("/uploads/")
            
            if file_path.exists():
                file_path.unlink()
                logger.info(f"Deleted local file: {file_path}")
                return True
            else:
                logger.warning(f"Local file not found: {file_path}")
                return False
                
    except Exception as e:
        logger.error(f"Error deleting file {file_url}: {e}")
        return False


# ============ MANUAL RUN FUNCTION ============

async def run_cleanup_manually():
    """
    Manually trigger cleanup (for testing or manual execution).
    """
    result = await cleanup_old_messages()
    print(f"Cleanup result: {result}")
    return result


# ============ SCHEDULER SETUP INSTRUCTIONS ============
"""
To set up automated cleanup, you can use one of these approaches:

1. APScheduler (add to main.py):

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.workers.chat_message_cleanup import cleanup_old_messages

scheduler = AsyncIOScheduler()
scheduler.add_job(cleanup_old_messages, 'cron', hour=3, minute=0)  # Daily at 3 AM
scheduler.start()

2. System Cron Job:

# Add to crontab (runs daily at 3 AM)
0 3 * * * cd /path/to/backend && python -c "import asyncio; from app.workers.chat_message_cleanup import run_cleanup_manually; asyncio.run(run_cleanup_manually())"

3. Celery Beat (if using Celery):

from celery.schedules import crontab

app.conf.beat_schedule = {
    'cleanup-old-chat-messages': {
        'task': 'app.workers.chat_message_cleanup.cleanup_old_messages',
        'schedule': crontab(hour=3, minute=0),  # Daily at 3 AM
    },
}
"""
