"""
Subscription Management Background Tasks
Scheduled tasks for subscription expiry, renewal reminders, and maintenance
"""

import logging
import asyncio
from datetime import date, timedelta
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.crud import subscription_crud, user_crud
from app.models.subscription import LearnerSubscription
from app.core.config import settings

logger = logging.getLogger(__name__)


async def get_db_session() -> AsyncSession:
    """Create a new database session for background tasks"""
    async with AsyncSessionLocal() as session:
        return session


# ============ SUBSCRIPTION EXPIRY TASK ============

async def expire_subscriptions_task():
    """
    Mark subscriptions as expired if expiry_date has passed.
    Should run daily via cron job or task scheduler.
    """
    logger.info("Starting subscription expiry task...")
    
    try:
        async with AsyncSessionLocal() as db:
            expired_count = await subscription_crud.expire_subscriptions(db)
            logger.info(f"Subscription expiry task completed: {expired_count} subscriptions expired")
            return expired_count
    except Exception as e:
        logger.error(f"Error in subscription expiry task: {str(e)}")
        raise


# ============ RENEWAL REMINDER TASKS ============

async def send_renewal_reminder_email(
    db: AsyncSession,
    subscription: LearnerSubscription,
    days_until_expiry: int
):
    """
    Send renewal reminder email to learner and HEAD.
    This is a placeholder - implement actual email sending via Brevo/email service.
    """
    try:
        # Get learner details
        learner = await user_crud.get_user_by_id(db, subscription.learner_id)
        if not learner or not learner.email:
            logger.warning(f"Cannot send reminder - no email for learner {subscription.learner_id}")
            return
        
        # Get HEAD details
        head = await user_crud.get_user_by_id(db, subscription.current_head_id)
        if not head:
            logger.warning(f"Cannot send reminder - HEAD {subscription.current_head_id} not found")
            return
        
        # Email subject and body
        subject = f"Subscription Expiring in {days_until_expiry} Days"
        learner_body = f"""
        Hi {learner.name},
        
        Your subscription '{subscription.package_name}' will expire on {subscription.expiry_date}.
        You have {subscription.sessions_remaining} sessions remaining.
        
        Please contact your coach {head.name} to renew your subscription.
        
        Best regards,
        Hurshbintech Team
        """
        
        head_body = f"""
        Hi {head.name},
        
        Learner {learner.name}'s subscription '{subscription.package_name}' will expire on {subscription.expiry_date}.
        Days until expiry: {days_until_expiry}
        Sessions remaining: {subscription.sessions_remaining}
        Net price paid: ₹{subscription.net_price_paid}
        
        Please follow up with the learner for renewal.
        
        Best regards,
        Hurshbintech System
        """
        
        # TODO: Integrate with actual email service (Brevo API or app.services.email_service)
        # For now, just log
        logger.info(f"[EMAIL] Renewal reminder sent for subscription {subscription.id} (expires in {days_until_expiry} days)")
        logger.info(f"  Learner: {learner.name} ({learner.email})")
        logger.info(f"  HEAD: {head.name}")
        
        # If you have email service, call it here:
        # from app.services.email_service import send_email
        # await send_email(learner.email, subject, learner_body)
        # await send_email(head.email, subject, head_body)
        
    except Exception as e:
        logger.error(f"Error sending renewal reminder for subscription {subscription.id}: {str(e)}")


async def send_renewal_reminders_for_days(days_before_expiry: int):
    """
    Send renewal reminders for subscriptions expiring in N days.
    Only sends if subscription hasn't been renewed yet.
    """
    logger.info(f"Starting renewal reminder task for {days_before_expiry} days before expiry...")
    
    try:
        async with AsyncSessionLocal() as db:
            subscriptions = await subscription_crud.get_subscriptions_needing_reminders(db, days_before_expiry)
            
            reminder_count = 0
            for subscription in subscriptions:
                await send_renewal_reminder_email(db, subscription, days_before_expiry)
                reminder_count += 1
            
            logger.info(f"Renewal reminder task completed: {reminder_count} reminders sent for {days_before_expiry} days")
            return reminder_count
    except Exception as e:
        logger.error(f"Error in renewal reminder task ({days_before_expiry} days): {str(e)}")
        raise


async def send_14_day_renewal_reminders():
    """Send reminders 14 days before expiry"""
    return await send_renewal_reminders_for_days(14)


async def send_7_day_renewal_reminders():
    """Send reminders 7 days before expiry"""
    return await send_renewal_reminders_for_days(7)


async def send_3_day_renewal_reminders():
    """Send reminders 3 days before expiry"""
    return await send_renewal_reminders_for_days(3)


# ============ GRACE PERIOD WARNING TASK ============

async def send_grace_period_warnings():
    """
    Send warnings to HEADs about subscriptions in grace period.
    Grace period = 7 days after expiry where backdated renewal is allowed.
    """
    logger.info("Starting grace period warning task...")
    
    try:
        async with AsyncSessionLocal() as db:
            from app.models.subscription import SubscriptionStatus
            from sqlalchemy import select, and_
            
            # Get expired subscriptions within grace period that haven't been renewed
            grace_start = date.today() - timedelta(days=settings.SUBSCRIPTION_GRACE_PERIOD_DAYS)
            grace_end = date.today()
            
            result = await db.execute(
                select(LearnerSubscription).where(
                    and_(
                        LearnerSubscription.status == SubscriptionStatus.EXPIRED,
                        LearnerSubscription.expiry_date >= grace_start,
                        LearnerSubscription.expiry_date < grace_end,
                        LearnerSubscription.renewed_to_subscription_id.is_(None)
                    )
                )
            )
            subscriptions = result.scalars().all()
            
            # Group by HEAD
            head_subscriptions = {}
            for sub in subscriptions:
                if sub.current_head_id not in head_subscriptions:
                    head_subscriptions[sub.current_head_id] = []
                head_subscriptions[sub.current_head_id].append(sub)
            
            # Send warnings to each HEAD
            warning_count = 0
            for head_id, subs in head_subscriptions.items():
                head = await user_crud.get_user_by_id(db, head_id)
                if not head or not head.email:
                    continue
                
                days_in_grace = [(date.today() - sub.expiry_date).days for sub in subs]
                days_remaining = [settings.SUBSCRIPTION_GRACE_PERIOD_DAYS - days for days in days_in_grace]
                
                subject = f"Grace Period Warning: {len(subs)} Expired Subscriptions"
                body = f"""
                Hi {head.name},
                
                You have {len(subs)} expired subscriptions in the grace period.
                These subscriptions can still be renewed with backdating:
                
                """
                
                for sub, days_left in zip(subs, days_remaining):
                    learner = await user_crud.get_user_by_id(db, sub.learner_id)
                    learner_name = learner.name if learner else "Unknown"
                    body += f"- {learner_name}: '{sub.package_name}' expired on {sub.expiry_date} ({days_left} days left in grace period)\n"
                
                body += f"""
                
                Please follow up with these learners for renewal.
                After the grace period, backdated renewal will not be allowed.
                
                Best regards,
                Hurshbintech System
                """
                
                logger.info(f"[EMAIL] Grace period warning sent to HEAD {head.name} for {len(subs)} subscriptions")
                # TODO: Send actual email via email service
                warning_count += 1
            
            logger.info(f"Grace period warning task completed: {warning_count} HEADs notified")
            return warning_count
    except Exception as e:
        logger.error(f"Error in grace period warning task: {str(e)}")
        raise


# ============ SUBSCRIPTION CLEANUP TASK ============

async def cleanup_old_receipts():
    """
    Archive old payment receipts to AWS S3 Glacier after 2 years.
    This task should be configured to run monthly.
    """
    logger.info("Starting payment receipt cleanup task...")
    
    try:
        # This would integrate with AWS S3 lifecycle policies
        # For now, just log - S3 lifecycle rules should handle the actual archival
        logger.info("Payment receipt cleanup: S3 lifecycle policies handle automatic archival to Glacier after 2 years")
        return 0
    except Exception as e:
        logger.error(f"Error in receipt cleanup task: {str(e)}")
        raise


# ============ SESSION TRACKING TASK ============

async def process_ended_sessions_task():
    """
    Process all ended sessions and update subscription session counts.
    - Decrement sessions_remaining when session ends
    - Mark learner as inactive when sessions_remaining reaches 0
    Should run frequently (e.g., every 5-10 minutes) to ensure timely processing
    """
    logger.info("Starting session tracking task...")
    
    try:
        async with AsyncSessionLocal() as db:
            sessions_processed = await subscription_crud.process_ended_sessions_and_update_subscriptions(db)
            logger.info(f"Session tracking task completed: {sessions_processed} sessions processed")
            return sessions_processed
    except Exception as e:
        logger.error(f"Error in session tracking task: {str(e)}")
        raise


# ============ MASTER TASK SCHEDULER ============

async def run_all_daily_tasks():
    """
    Run all daily subscription maintenance tasks.
    This can be called by a cron job or task scheduler.
    """
    logger.info("=" * 60)
    logger.info("Starting daily subscription maintenance tasks...")
    logger.info("=" * 60)
    
    results = {
        "expired_subscriptions": 0,
        "reminders_14_days": 0,
        "reminders_7_days": 0,
        "reminders_3_days": 0,
        "grace_period_warnings": 0,
        "sessions_processed": 0,
    }
    
    try:
        # Task 1: Expire subscriptions
        results["expired_subscriptions"] = await expire_subscriptions_task()
        
        # Task 2: Send 14-day reminders
        results["reminders_14_days"] = await send_14_day_renewal_reminders()
        
        # Task 3: Send 7-day reminders
        results["reminders_7_days"] = await send_7_day_renewal_reminders()
        
        # Task 4: Send 3-day reminders
        results["reminders_3_days"] = await send_3_day_renewal_reminders()
        
        # Task 5: Send grace period warnings
        results["grace_period_warnings"] = await send_grace_period_warnings()
        
        # Task 6: Process ended sessions and update subscription counts
        results["sessions_processed"] = await process_ended_sessions_task()
        
        logger.info("=" * 60)
        logger.info("Daily subscription maintenance tasks completed successfully!")
        logger.info(f"Results: {results}")
        logger.info("=" * 60)
        
        return results
    except Exception as e:
        logger.error(f"Error in daily subscription maintenance tasks: {str(e)}")
        raise


# ============ FREQUENT TASK SCHEDULER (FOR SESSION PROCESSING) ============

async def run_frequent_session_processing():
    """
    Run session processing task frequently (every 5-10 minutes).
    This ensures timely updates to subscription session counts and learner status.
    """
    logger.info("Starting frequent session processing task...")
    
    try:
        results = {
            "sessions_processed": await process_ended_sessions_task(),
        }
        return results
    except Exception as e:
        logger.error(f"Error in frequent session processing task: {str(e)}")
        raise


# ============ MANUAL TASK EXECUTION (FOR TESTING) ============

if __name__ == "__main__":
    """
    Run tasks manually for testing:
    python -m app.workers.subscription_tasks
    """
    import sys
    
    async def main():
        if len(sys.argv) > 1:
            task_name = sys.argv[1]
            
            if task_name == "expire":
                await expire_subscriptions_task()
            elif task_name == "remind-14":
                await send_14_day_renewal_reminders()
            elif task_name == "remind-7":
                await send_7_day_renewal_reminders()
            elif task_name == "remind-3":
                await send_3_day_renewal_reminders()
            elif task_name == "grace-warnings":
                await send_grace_period_warnings()
            elif task_name == "process-sessions":
                await process_ended_sessions_task()
            elif task_name == "all":
                await run_all_daily_tasks()
            else:
                print("Unknown task. Available tasks: expire, remind-14, remind-7, remind-3, grace-warnings, process-sessions, all")
        else:
            print("Usage: python -m app.workers.subscription_tasks <task_name>")
            print("Tasks: expire, remind-14, remind-7, remind-3, grace-warnings, process-sessions, all")
    
    asyncio.run(main())
