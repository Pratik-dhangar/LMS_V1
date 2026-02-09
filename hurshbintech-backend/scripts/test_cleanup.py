"""
Test script to manually run chat message cleanup
Run this to test if the cleanup is working correctly
"""

import asyncio
import logging
from datetime import datetime, timedelta
from sqlalchemy import select

# Import all models to avoid relationship errors
from app.db.session import AsyncSessionLocal
import app.models  # Import all models
from app.models.Chat.chat_model import Message
from app.workers.chat_message_cleanup import cleanup_old_messages

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def check_messages():
    """Check message counts and dates"""
    async with AsyncSessionLocal() as db:
        # Total messages
        total_result = await db.execute(select(Message))
        total_messages = total_result.scalars().all()
        logger.info(f"Total messages in database: {len(total_messages)}")

        # Non-deleted messages
        non_deleted_result = await db.execute(
            select(Message).where(Message.is_deleted == False)
        )
        non_deleted = non_deleted_result.scalars().all()
        logger.info(f"Non-deleted messages: {len(non_deleted)}")

        # Messages older than 7 days
        cutoff_date = datetime.utcnow() - timedelta(days=7)
        old_messages_result = await db.execute(
            select(Message).where(
                Message.created_at < cutoff_date,
                Message.is_deleted == False
            )
        )
        old_messages = old_messages_result.scalars().all()
        logger.info(f"Messages older than 7 days ({cutoff_date}): {len(old_messages)}")

        if old_messages:
            logger.info("\nOldest messages to be deleted:")
            for msg in old_messages[:5]:  # Show first 5
                logger.info(f"  - ID: {msg.id}, Created: {msg.created_at}, Content: {msg.content[:50] if msg.content else 'N/A'}...")

        # Show newest and oldest message dates
        if total_messages:
            dates = [msg.created_at for msg in total_messages if msg.created_at]
            if dates:
                logger.info(f"\nOldest message date: {min(dates)}")
                logger.info(f"Newest message date: {max(dates)}")
                logger.info(f"Current UTC time: {datetime.utcnow()}")


async def main():
    """Run cleanup test"""
    logger.info("=" * 60)
    logger.info("BEFORE CLEANUP")
    logger.info("=" * 60)
    await check_messages()

    logger.info("\n" + "=" * 60)
    logger.info("RUNNING CLEANUP")
    logger.info("=" * 60)
    result = await cleanup_old_messages()
    logger.info(f"Cleanup result: {result}")

    logger.info("\n" + "=" * 60)
    logger.info("AFTER CLEANUP")
    logger.info("=" * 60)
    await check_messages()


if __name__ == "__main__":
    asyncio.run(main())
