"""
CRUD operations for Learner Subscription & Payment Management System
"""

import logging
import random
import string
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy import select, and_, or_, func, desc, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.subscription import (
    SubscriptionPackage,
    LearnerSubscription,
    SubscriptionPaymentReceipt,
    SubscriptionDiscount,
    SessionAdjustmentLog,
    SubscriptionEventLog,
    SubscriptionStatus,
    PaymentStatus,
    DiscountType,
    RefundType,
    AdjustmentType,
)
from app.models.session_model import TrainingSession
from app.models.user_model import User
from app.schemas.subscription import (
    SubscriptionPackageCreate,
    SubscriptionPackageUpdate,
    LearnerSubscriptionCreate,
    LearnerSubscriptionBackdateCreate,
    SubscriptionDiscountCreate,
    AdjustmentTypeEnum,
    SubscriptionDiscountBulkCreate,
    SubscriptionDiscountUpdate,
    SessionAdjustmentCreate,
    SubscriptionEventLogCreate,
    SubscriptionRefundRequest,
)

# Configuration constants
SUBSCRIPTION_GRACE_PERIOD_DAYS = 7
MAX_PAUSE_DURATION_DAYS = 90
MAX_FREEZE_DURATION_DAYS = 180
MAX_SESSION_ADJUSTMENT_AMOUNT = 10
MAX_ADJUSTMENTS_PER_SUBSCRIPTION_HEAD = 3
RENEWAL_REMINDER_DAYS = [14, 7, 3]

logger = logging.getLogger(__name__)


# ============ SUBSCRIPTION PACKAGE CRUD ============

async def create_package(
    db: AsyncSession,
    package_data: SubscriptionPackageCreate,
    head_id: int
) -> SubscriptionPackage:
    """Create a new subscription package"""
    package = SubscriptionPackage(
        head_id=head_id,
        package_name=package_data.package_name,
        description=package_data.description,
        sessions_count=package_data.sessions_count,
        validity_days=package_data.validity_days,
        price=package_data.price,
    )
    db.add(package)
    await db.commit()
    await db.refresh(package)
    logger.info(f"Created package {package.id} by HEAD {head_id}")
    return package


async def get_package_by_id(db: AsyncSession, package_id: int) -> Optional[SubscriptionPackage]:
    """Get package by ID"""
    result = await db.execute(
        select(SubscriptionPackage).where(SubscriptionPackage.id == package_id)
    )
    return result.scalar_one_or_none()


async def get_packages_by_head(
    db: AsyncSession,
    head_id: int,
    active_only: bool = True
) -> List[SubscriptionPackage]:
    """Get all packages created by a HEAD"""
    query = select(SubscriptionPackage).where(SubscriptionPackage.head_id == head_id)
    if active_only:
        query = query.where(SubscriptionPackage.is_active == True)
    query = query.order_by(desc(SubscriptionPackage.created_at))
    
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_all_packages(
    db: AsyncSession,
    active_only: bool = True
) -> List[SubscriptionPackage]:
    """Get all subscription packages (ADMIN only)"""
    query = select(SubscriptionPackage)
    if active_only:
        query = query.where(SubscriptionPackage.is_active == True)
    query = query.order_by(desc(SubscriptionPackage.created_at))
    
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_package(
    db: AsyncSession,
    package_id: int,
    package_data: SubscriptionPackageUpdate
) -> Optional[SubscriptionPackage]:
    """Update a subscription package"""
    package = await get_package_by_id(db, package_id)
    if not package:
        return None
    
    update_data = package_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(package, field, value)
    
    await db.commit()
    await db.refresh(package)
    logger.info(f"Updated package {package_id}")
    return package


async def soft_delete_package(db: AsyncSession, package_id: int) -> bool:
    """Hard delete a package (completely remove from database)"""
    package = await get_package_by_id(db, package_id)
    if not package:
        return False
    
    # Check if any subscriptions are using this package
    result = await db.execute(
        select(LearnerSubscription).where(LearnerSubscription.package_id == package_id)
    )
    existing_subscriptions = result.scalars().all()
    
    if existing_subscriptions:
        # If subscriptions exist, only soft delete
        package.is_active = False
        await db.commit()
        logger.info(f"Soft deleted package {package_id} (has existing subscriptions)")
        return True
    
    # If no subscriptions, hard delete
    await db.delete(package)
    await db.commit()
    logger.info(f"Hard deleted package {package_id}")
    return True


# ============ LEARNER SUBSCRIPTION CRUD ============

async def get_active_subscription_for_learner(
    db: AsyncSession,
    learner_id: int
) -> Optional[LearnerSubscription]:
    """Get active/paused/frozen subscription for a learner"""
    result = await db.execute(
        select(LearnerSubscription)
        .where(
            and_(
                LearnerSubscription.learner_id == learner_id,
                LearnerSubscription.status.in_([
                    SubscriptionStatus.ACTIVE,
                    SubscriptionStatus.PAUSED,
                    SubscriptionStatus.FROZEN
                ])
            )
        )
    )
    return result.scalar_one_or_none()


async def calculate_discount(
    db: AsyncSession,
    package: SubscriptionPackage,
    discount_code: Optional[str],
    head_id: int
) -> Tuple[Decimal, Optional[int], Optional[int]]:
    """
    Calculate discount for a subscription
    Returns: (discount_amount, discount_code_id, applied_by_head_id)
    """
    if not discount_code:
        return Decimal("0"), None, None
    
    # Get discount code
    result = await db.execute(
        select(SubscriptionDiscount)
        .where(
            and_(
                SubscriptionDiscount.code == discount_code.upper(),
                SubscriptionDiscount.is_active == True,
                SubscriptionDiscount.valid_from <= date.today(),
                SubscriptionDiscount.valid_until >= date.today()
            )
        )
    )
    discount = result.scalar_one_or_none()
    
    if not discount:
        return Decimal("0"), None, None
    
    # Check max usage
    if discount.max_usage_count and discount.usage_count >= discount.max_usage_count:
        return Decimal("0"), None, None
    
    # Check eligibility criteria
    if discount.eligibility_criteria:
        criteria = discount.eligibility_criteria
        
        # Check minimum package price
        if "min_package_price" in criteria:
            if package.price < Decimal(str(criteria["min_package_price"])):
                return Decimal("0"), None, None
        
        # Check applicable heads
        if "applicable_heads" in criteria:
            if head_id not in criteria["applicable_heads"]:
                return Decimal("0"), None, None
    
    # Calculate discount amount
    if discount.discount_type == DiscountType.PERCENTAGE:
        discount_amount = (package.price * discount.discount_value) / Decimal("100")
    else:  # FIXED
        discount_amount = discount.discount_value
    
    # Ensure discount doesn't exceed price
    discount_amount = min(discount_amount, package.price)
    
    return discount_amount, discount.id, head_id


async def create_subscription(
    db: AsyncSession,
    subscription_data: LearnerSubscriptionCreate,
    head_id: int
) -> Tuple[Optional[LearnerSubscription], Optional[str]]:
    """
    Create a new subscription for a learner
    Returns: (subscription, error_message)
    """
    # Check for existing active subscription
    existing = await get_active_subscription_for_learner(db, subscription_data.learner_id)
    if existing:
        return None, "Learner already has an active subscription"
    
    # Get package
    package = await get_package_by_id(db, subscription_data.package_id)
    if not package or not package.is_active:
        return None, "Invalid or inactive package"
    
    # Calculate discount
    discount_amount, discount_code_id, applied_by_head_id = await calculate_discount(
        db, package, subscription_data.discount_code, head_id
    )
    
    net_price = package.price - discount_amount
    
    # Calculate expiry date
    expiry_date = subscription_data.start_date + timedelta(days=package.validity_days)
    
    # Create subscription
    subscription = LearnerSubscription(
        learner_id=subscription_data.learner_id,
        package_id=package.id,
        created_by_head_id=head_id,
        current_head_id=head_id,
        
        # Denormalized package details
        package_name=package.package_name,
        package_sessions=package.sessions_count,
        package_validity_days=package.validity_days,
        package_original_price=package.price,
        
        # Lifecycle
        start_date=subscription_data.start_date,
        expiry_date=expiry_date,
        status=SubscriptionStatus.ACTIVE,
        
        # Sessions
        sessions_total=package.sessions_count,
        sessions_completed=0,
        sessions_remaining=package.sessions_count,
        
        # Pricing
        discount_applied=discount_amount,
        discount_code_id=discount_code_id,
        applied_by_head_id=applied_by_head_id,
        net_price_paid=net_price,
    )
    
    db.add(subscription)
    
    # Update discount usage count
    if discount_code_id:
        discount_result = await db.execute(
            select(SubscriptionDiscount).where(SubscriptionDiscount.id == discount_code_id)
        )
        discount = discount_result.scalar_one_or_none()
        if discount:
            discount.usage_count += 1
    
    # Re-activate learner when new subscription is purchased
    learner = await db.execute(
        select(User).where(User.id == subscription_data.learner_id)
    )
    learner_user = learner.scalar_one_or_none()
    if learner_user:
        learner_user.is_active = True
    
    await db.flush()  # Flush instead of commit to let caller handle transaction
    await db.refresh(subscription)
    
    # Create event log
    await create_event_log(
        db,
        SubscriptionEventLogCreate(
            subscription_id=subscription.id,
            event_type="CREATED",
            event_description=f"Subscription created with package '{package.package_name}'",
            event_metadata={
                "package_id": package.id,
                "discount_applied": float(discount_amount),
                "net_price": float(net_price)
            },
            triggered_by_id=head_id,
            triggered_by_role="HEAD"
        )
    )
    
    logger.info(f"Created subscription {subscription.id} for learner {subscription_data.learner_id}")
    return subscription, None


async def validate_backdate_for_renewal(
    db: AsyncSession,
    learner_id: int,
    old_expiry_date: date,
    new_start_date: date
) -> Tuple[bool, int]:
    """
    Validate if sessions exist between old expiry and new backdated start date
    Returns: (has_sessions, session_count)
    """
    # Ensure we're checking the gap correctly (from expiry to new start)
    # The gap is from old_expiry_date to new_start_date
    start_datetime = datetime.combine(old_expiry_date, datetime.min.time())
    end_datetime = datetime.combine(new_start_date, datetime.min.time())
    
    # If new_start_date is before old_expiry_date, there's no gap
    if new_start_date <= old_expiry_date:
        return False, 0
    
    result = await db.execute(
        select(func.count(TrainingSession.id))
        .where(
            and_(
                TrainingSession.learner_id == learner_id,
                TrainingSession.scheduled_date >= start_datetime,
                TrainingSession.scheduled_date < end_datetime
            )
        )
    )
    session_count = result.scalar() or 0
    return session_count > 0, session_count


async def create_backdated_subscription(
    db: AsyncSession,
    subscription_data: LearnerSubscriptionBackdateCreate,
    head_id: int,
    old_subscription_id: int
) -> Tuple[Optional[LearnerSubscription], Optional[str]]:
    """
    Create a backdated subscription renewal within grace period
    Returns: (subscription, error_message)
    """
    # Get old subscription
    old_sub = await get_subscription_by_id(db, old_subscription_id)
    if not old_sub:
        return None, "Previous subscription not found"
    
    # Check if within grace period
    days_since_expiry = (date.today() - old_sub.expiry_date).days
    if days_since_expiry > SUBSCRIPTION_GRACE_PERIOD_DAYS:
        return None, f"Backdate exceeds grace period of {SUBSCRIPTION_GRACE_PERIOD_DAYS} days"
    
    # Validate session gap
    has_sessions, session_count = await validate_backdate_for_renewal(
        db, subscription_data.learner_id, old_sub.expiry_date, subscription_data.start_date
    )
    
    if has_sessions and not subscription_data.acknowledge_session_gap:
        return None, f"Warning: {session_count} sessions exist between expiry and backdate. Please acknowledge."
    
    # Get package
    package = await get_package_by_id(db, subscription_data.package_id)
    if not package or not package.is_active:
        return None, "Invalid or inactive package"
    
    # Calculate discount
    discount_amount, discount_code_id, applied_by_head_id = await calculate_discount(
        db, package, subscription_data.discount_code, head_id
    )
    
    net_price = package.price - discount_amount
    expiry_date = subscription_data.start_date + timedelta(days=package.validity_days)
    
    # Create new subscription
    subscription = LearnerSubscription(
        learner_id=subscription_data.learner_id,
        package_id=package.id,
        created_by_head_id=head_id,
        current_head_id=head_id,
        
        # Denormalized package details
        package_name=package.package_name,
        package_sessions=package.sessions_count,
        package_validity_days=package.validity_days,
        package_original_price=package.price,
        
        # Lifecycle
        start_date=subscription_data.start_date,
        expiry_date=expiry_date,
        status=SubscriptionStatus.ACTIVE,
        
        # Sessions
        sessions_total=package.sessions_count,
        sessions_completed=0,
        sessions_remaining=package.sessions_count,
        
        # Pricing
        discount_applied=discount_amount,
        discount_code_id=discount_code_id,
        applied_by_head_id=applied_by_head_id,
        net_price_paid=net_price,
        
        # Renewal chain
        renewed_from_subscription_id=old_subscription_id,
    )
    
    db.add(subscription)
    
    # Update old subscription
    old_sub.renewed_to_subscription_id = subscription.id
    
    # Update discount usage
    if discount_code_id:
        discount_result = await db.execute(
            select(SubscriptionDiscount).where(SubscriptionDiscount.id == discount_code_id)
        )
        discount = discount_result.scalar_one_or_none()
        if discount:
            discount.usage_count += 1
    
    # Re-activate learner when subscription is renewed
    learner = await db.execute(
        select(User).where(User.id == subscription_data.learner_id)
    )
    learner_user = learner.scalar_one_or_none()
    if learner_user:
        learner_user.is_active = True
    
    await db.commit()
    await db.refresh(subscription)
    
    # Create event log
    await create_event_log(
        db,
        SubscriptionEventLogCreate(
            subscription_id=subscription.id,
            event_type="RENEWED",
            event_description=f"Backdated renewal from subscription {old_subscription_id}",
            event_metadata={
                "old_subscription_id": old_subscription_id,
                "backdate_start": subscription_data.start_date.isoformat(),
                "session_gap_acknowledged": subscription_data.acknowledge_session_gap,
                "sessions_in_gap": session_count
            },
            triggered_by_id=head_id,
            triggered_by_role="HEAD"
        )
    )
    
    logger.info(f"Created backdated subscription {subscription.id} for learner {subscription_data.learner_id}")
    return subscription, None


async def get_subscription_by_id(
    db: AsyncSession,
    subscription_id: int,
    load_relations: bool = False
) -> Optional[LearnerSubscription]:
    """Get subscription by ID with optional relationship loading"""
    query = select(LearnerSubscription).where(LearnerSubscription.id == subscription_id)
    
    if load_relations:
        query = query.options(
            selectinload(LearnerSubscription.payment_receipts),
            selectinload(LearnerSubscription.session_adjustments),
            selectinload(LearnerSubscription.event_logs)
        )
    
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_subscriptions_by_head(
    db: AsyncSession,
    head_id: int,
    status: Optional[SubscriptionStatus] = None,
    limit: Optional[int] = None
) -> List[LearnerSubscription]:
    """Get all subscriptions managed by a HEAD with all relationships loaded"""
    from sqlalchemy.orm import selectinload
    
    query = select(LearnerSubscription).options(
        selectinload(LearnerSubscription.learner),  # User object
        selectinload(LearnerSubscription.current_head),  # User object
        selectinload(LearnerSubscription.package),  # SubscriptionPackage object
        selectinload(LearnerSubscription.created_by_head),  # User object
        selectinload(LearnerSubscription.discount_code)  # SubscriptionDiscount object
    ).where(LearnerSubscription.current_head_id == head_id)
    
    if status:
        query = query.where(LearnerSubscription.status == status)
    
    query = query.order_by(desc(LearnerSubscription.created_at))
    
    if limit:
        query = query.limit(limit)
    
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_subscriptions_by_learner(
    db: AsyncSession,
    learner_id: int
) -> List[LearnerSubscription]:
    """Get all subscriptions for a learner with relationships loaded"""
    result = await db.execute(
        select(LearnerSubscription)
        .where(LearnerSubscription.learner_id == learner_id)
        .options(
            selectinload(LearnerSubscription.learner),
            selectinload(LearnerSubscription.created_by_head),
            selectinload(LearnerSubscription.current_head),
            selectinload(LearnerSubscription.package),
            selectinload(LearnerSubscription.discount_code)
        )
        .order_by(desc(LearnerSubscription.created_at))
    )
    return list(result.scalars().all())


async def get_renewal_chain(
    db: AsyncSession,
    subscription_id: int
) -> List[LearnerSubscription]:
    """Get full renewal chain for a subscription (A→B→C)"""
    chain = []
    current_id = subscription_id
    
    # Find the root of the chain
    while current_id:
        sub = await get_subscription_by_id(db, current_id)
        if not sub:
            break
        chain.insert(0, sub)
        current_id = sub.renewed_from_subscription_id
    
    # Now go forward from the original subscription
    current_id = chain[0].renewed_to_subscription_id if chain else None
    while current_id:
        sub = await get_subscription_by_id(db, current_id)
        if not sub:
            break
        chain.append(sub)
        current_id = sub.renewed_to_subscription_id
    
    return chain


async def pause_subscription(
    db: AsyncSession,
    subscription_id: int,
    reason: Optional[str] = None
) -> Tuple[Optional[LearnerSubscription], Optional[str]]:
    """Pause a subscription (stops expiry, allows sessions)"""
    subscription = await get_subscription_by_id(db, subscription_id)
    if not subscription:
        return None, "Subscription not found"
    
    if subscription.status != SubscriptionStatus.ACTIVE:
        return None, "Only active subscriptions can be paused"
    
    # Check pause duration limit
    if subscription.paused_duration_days >= MAX_PAUSE_DURATION_DAYS:
        return None, f"Maximum pause duration of {MAX_PAUSE_DURATION_DAYS} days exceeded"
    
    subscription.status = SubscriptionStatus.PAUSED
    subscription.paused_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(subscription)
    
    logger.info(f"Paused subscription {subscription_id}")
    return subscription, None


async def freeze_subscription(
    db: AsyncSession,
    subscription_id: int,
    reason: Optional[str] = None
) -> Tuple[Optional[LearnerSubscription], Optional[str]]:
    """Freeze a subscription (blocks sessions, stops expiry)"""
    subscription = await get_subscription_by_id(db, subscription_id)
    if not subscription:
        return None, "Subscription not found"
    
    if subscription.status != SubscriptionStatus.ACTIVE:
        return None, "Only active subscriptions can be frozen"
    
    # Check freeze duration limit
    if subscription.frozen_duration_days >= MAX_FREEZE_DURATION_DAYS:
        return None, f"Maximum freeze duration of {MAX_FREEZE_DURATION_DAYS} days exceeded"
    
    subscription.status = SubscriptionStatus.FROZEN
    subscription.frozen_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(subscription)
    
    logger.info(f"Frozen subscription {subscription_id}")
    return subscription, None


async def resume_subscription(
    db: AsyncSession,
    subscription_id: int
) -> Tuple[Optional[LearnerSubscription], Optional[str]]:
    """Resume a paused/frozen subscription"""
    subscription = await get_subscription_by_id(db, subscription_id)
    if not subscription:
        return None, "Subscription not found"
    
    if subscription.status not in [SubscriptionStatus.PAUSED, SubscriptionStatus.FROZEN]:
        return None, "Only paused/frozen subscriptions can be resumed"
    
    # Calculate pause/freeze duration
    if subscription.status == SubscriptionStatus.PAUSED and subscription.paused_at:
        duration = (datetime.utcnow() - subscription.paused_at).days
        subscription.paused_duration_days += duration
        subscription.paused_at = None
        # Extend expiry by pause duration
        subscription.expiry_date += timedelta(days=duration)
    elif subscription.status == SubscriptionStatus.FROZEN and subscription.frozen_at:
        duration = (datetime.utcnow() - subscription.frozen_at).days
        subscription.frozen_duration_days += duration
        subscription.frozen_at = None
        # Extend expiry by freeze duration
        subscription.expiry_date += timedelta(days=duration)
    
    subscription.status = SubscriptionStatus.ACTIVE
    
    await db.commit()
    await db.refresh(subscription)
    
    logger.info(f"Resumed subscription {subscription_id}")
    return subscription, None


async def cancel_subscription(
    db: AsyncSession,
    subscription_id: int,
    reason: str
) -> Tuple[Optional[LearnerSubscription], Optional[str]]:
    """Cancel a subscription"""
    subscription = await get_subscription_by_id(db, subscription_id)
    if not subscription:
        return None, "Subscription not found"
    
    if subscription.status in [SubscriptionStatus.CANCELLED, SubscriptionStatus.REFUNDED]:
        return None, "Subscription already cancelled or refunded"
    
    subscription.status = SubscriptionStatus.CANCELLED
    
    await db.commit()
    await db.refresh(subscription)
    
    logger.info(f"Cancelled subscription {subscription_id}")
    return subscription, None


async def delete_subscription(
    db: AsyncSession,
    subscription_id: int
) -> Tuple[bool, Optional[str]]:
    """
    Hard delete a subscription and all related records from the database.
    This removes the subscription completely including payment receipts, session adjustments, and event logs.
    
    Returns: (success, error_message)
    """
    try:
        subscription = await get_subscription_by_id(db, subscription_id)
        if not subscription:
            return False, "Subscription not found"
        
        # Check if subscription has any active sessions scheduled for the future
        from app.models.session_model import TrainingSession
        from datetime import datetime as dt
        
        result = await db.execute(
            select(func.count(TrainingSession.id))
            .where(
                and_(
                    TrainingSession.subscription_id == subscription_id,
                    TrainingSession.scheduled_date >= dt.utcnow(),
                    TrainingSession.status.in_(["scheduled", "ongoing"])
                )
            )
        )
        active_sessions_count = result.scalar() or 0
        
        if active_sessions_count > 0:
            return False, f"Cannot delete subscription with {active_sessions_count} active/scheduled sessions"
        
        # Delete all related records first (maintaining referential integrity)
        # Delete payment receipts
        await db.execute(
            delete(SubscriptionPaymentReceipt)
            .where(SubscriptionPaymentReceipt.subscription_id == subscription_id)
        )
        
        # Delete session adjustments
        await db.execute(
            delete(SessionAdjustmentLog)
            .where(SessionAdjustmentLog.subscription_id == subscription_id)
        )
        
        # Delete event logs
        await db.execute(
            delete(SubscriptionEventLog)
            .where(SubscriptionEventLog.subscription_id == subscription_id)
        )
        
        # Delete the subscription itself
        await db.delete(subscription)
        
        # Commit all deletions
        await db.commit()
        
        logger.info(f"Hard deleted subscription {subscription_id} along with all related records")
        return True, None
        
    except Exception as e:
        await db.rollback()
        error_msg = f"Error deleting subscription: {str(e)}"
        logger.error(error_msg)
        return False, error_msg


async def process_refund(
    db: AsyncSession,
    refund_request: SubscriptionRefundRequest
) -> Tuple[Optional[Decimal], Optional[str]]:
    """Process refund for a subscription"""
    subscription = await get_subscription_by_id(db, refund_request.subscription_id)
    if not subscription:
        return None, "Subscription not found"
    
    if subscription.status == SubscriptionStatus.REFUNDED:
        return None, "Subscription already refunded"
    
    # Calculate refund amount
    if refund_request.refund_type == RefundType.FULL:
        refund_amount = subscription.net_price_paid
    else:  # PRORATED
        if subscription.sessions_total > 0:
            refund_amount = (
                subscription.sessions_remaining / subscription.sessions_total
            ) * subscription.net_price_paid
        else:
            refund_amount = Decimal("0")
    
    subscription.status = SubscriptionStatus.REFUNDED
    subscription.refund_amount = refund_amount
    subscription.refund_type = refund_request.refund_type
    subscription.refund_date = datetime.utcnow()
    subscription.refund_reason = refund_request.reason
    
    await db.commit()
    await db.refresh(subscription)
    
    logger.info(f"Processed refund for subscription {refund_request.subscription_id}: {refund_amount}")
    return refund_amount, None


async def decrement_session_count(
    db: AsyncSession,
    subscription_id: int
) -> bool:
    """Decrement session count when a session is completed"""
    subscription = await get_subscription_by_id(db, subscription_id)
    if not subscription:
        return False
    
    # Only decrement for active or paused subscriptions
    if subscription.status not in [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAUSED]:
        return False
    
    if subscription.sessions_remaining <= 0:
        return False
    
    subscription.sessions_completed += 1
    subscription.sessions_remaining -= 1
    
    await db.commit()
    logger.info(f"Decremented session for subscription {subscription_id}: {subscription.sessions_remaining} remaining")
    return True


# ============ SESSION ADJUSTMENT CRUD ============

async def get_adjustment_count_for_subscription(
    db: AsyncSession,
    subscription_id: int,
    adjusted_by_role: str
) -> int:
    """Get count of adjustments for a subscription by role"""
    result = await db.execute(
        select(func.count(SessionAdjustmentLog.id))
        .where(
            and_(
                SessionAdjustmentLog.subscription_id == subscription_id,
                SessionAdjustmentLog.adjusted_by_role == adjusted_by_role
            )
        )
    )
    return result.scalar() or 0


async def create_session_adjustment(
    db: AsyncSession,
    adjustment_data: SessionAdjustmentCreate,
    adjusted_by_id: int,
    adjusted_by_role: str
) -> Tuple[Optional[SessionAdjustmentLog], Optional[str]]:
    """Create a manual session adjustment"""
    subscription = await get_subscription_by_id(db, adjustment_data.subscription_id)
    if not subscription:
        return None, "Subscription not found"
    
    # Check adjustment limits for HEAD (ADMIN has unlimited)
    if adjusted_by_role == "HEAD":
        adjustment_count = await get_adjustment_count_for_subscription(
            db, adjustment_data.subscription_id, "HEAD"
        )
        if adjustment_count >= MAX_ADJUSTMENTS_PER_SUBSCRIPTION_HEAD:
            return None, f"Maximum {MAX_ADJUSTMENTS_PER_SUBSCRIPTION_HEAD} adjustments per subscription reached"
    
    # Calculate new session counts
    sessions_before = subscription.sessions_remaining
    
    logger.info(f"Adjusting sessions - Type: {adjustment_data.adjustment_type}, Amount: {adjustment_data.adjustment_amount}, Before: {sessions_before}")
    
    if adjustment_data.adjustment_type == AdjustmentTypeEnum.ADD:
        sessions_after = sessions_before + adjustment_data.adjustment_amount
        subscription.sessions_total += adjustment_data.adjustment_amount
        subscription.sessions_remaining += adjustment_data.adjustment_amount
        logger.info(f"ADD operation - After: {sessions_after}, Total: {subscription.sessions_total}, Remaining: {subscription.sessions_remaining}")
    else:  # SUBTRACT
        sessions_after = max(0, sessions_before - adjustment_data.adjustment_amount)
        subtract_amount = min(adjustment_data.adjustment_amount, sessions_before)
        subscription.sessions_total -= subtract_amount
        subscription.sessions_remaining -= subtract_amount
        logger.info(f"SUBTRACT operation - After: {sessions_after}, Total: {subscription.sessions_total}, Remaining: {subscription.sessions_remaining}")
    
    # Create adjustment log
    adjustment_log = SessionAdjustmentLog(
        subscription_id=adjustment_data.subscription_id,
        adjusted_by_id=adjusted_by_id,
        adjusted_by_role=adjusted_by_role,
        adjustment_type=adjustment_data.adjustment_type,
        adjustment_amount=adjustment_data.adjustment_amount,
        reason=adjustment_data.reason,
        sessions_before=sessions_before,
        sessions_after=sessions_after,
    )
    
    db.add(adjustment_log)
    await db.commit()
    await db.refresh(adjustment_log)
    
    logger.info(f"Created session adjustment for subscription {adjustment_data.subscription_id}")
    return adjustment_log, None


# ============ PAYMENT RECEIPT CRUD ============

async def create_payment_receipt(
    db: AsyncSession,
    subscription_id: int,
    uploaded_by_head_id: int,
    file_name: str,
    file_path: str,
    file_size: int,
    storage_type: str = "s3"
) -> SubscriptionPaymentReceipt:
    """Create a payment receipt record"""
    receipt = SubscriptionPaymentReceipt(
        subscription_id=subscription_id,
        uploaded_by_head_id=uploaded_by_head_id,
        file_name=file_name,
        file_path=file_path,
        file_size=file_size,
        storage_type=storage_type,
        payment_status=PaymentStatus.PENDING,
    )
    
    db.add(receipt)
    await db.commit()
    await db.refresh(receipt)
    
    logger.info(f"Created payment receipt {receipt.id} for subscription {subscription_id}")
    return receipt


async def get_payment_receipt_by_id(
    db: AsyncSession,
    receipt_id: int
) -> Optional[SubscriptionPaymentReceipt]:
    """Get payment receipt by ID"""
    result = await db.execute(
        select(SubscriptionPaymentReceipt).where(SubscriptionPaymentReceipt.id == receipt_id)
    )
    return result.scalar_one_or_none()


# ============ DISCOUNT CODE CRUD ============

async def create_discount_code(
    db: AsyncSession,
    discount_data: SubscriptionDiscountCreate,
    created_by_admin_id: int
) -> SubscriptionDiscount:
    """Create a discount code"""
    discount = SubscriptionDiscount(
        created_by_admin_id=created_by_admin_id,
        code=discount_data.code.upper(),
        description=discount_data.description,
        discount_type=discount_data.discount_type,
        discount_value=discount_data.discount_value,
        eligibility_criteria=discount_data.eligibility_criteria,
        valid_from=discount_data.valid_from,
        valid_until=discount_data.valid_until,
        max_usage_count=discount_data.max_usage_count,
    )
    
    db.add(discount)
    await db.commit()
    await db.refresh(discount)
    
    logger.info(f"Created discount code {discount.code}")
    return discount


def generate_discount_code(prefix: str, length: int = 6) -> str:
    """Generate a random discount code with prefix"""
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))
    return f"{prefix.upper()}{suffix}"


async def bulk_create_discount_codes(
    db: AsyncSession,
    bulk_data: SubscriptionDiscountBulkCreate,
    created_by_admin_id: int
) -> List[SubscriptionDiscount]:
    """Bulk create discount codes with prefix pattern"""
    codes = []
    
    for _ in range(bulk_data.count):
        # Generate unique code
        while True:
            code = generate_discount_code(bulk_data.prefix)
            # Check if code exists
            result = await db.execute(
                select(SubscriptionDiscount).where(SubscriptionDiscount.code == code)
            )
            if not result.scalar_one_or_none():
                break
        
        discount = SubscriptionDiscount(
            created_by_admin_id=created_by_admin_id,
            code=code,
            description=bulk_data.description,
            discount_type=bulk_data.discount_type,
            discount_value=bulk_data.discount_value,
            eligibility_criteria=bulk_data.eligibility_criteria,
            valid_from=bulk_data.valid_from,
            valid_until=bulk_data.valid_until,
            max_usage_count=bulk_data.max_usage_count,
        )
        db.add(discount)
        codes.append(discount)
    
    await db.commit()
    
    logger.info(f"Bulk created {len(codes)} discount codes with prefix {bulk_data.prefix}")
    return codes


async def get_discount_by_code(
    db: AsyncSession,
    code: str
) -> Optional[SubscriptionDiscount]:
    """Get discount by code"""
    result = await db.execute(
        select(SubscriptionDiscount).where(SubscriptionDiscount.code == code.upper())
    )
    return result.scalar_one_or_none()


async def get_all_discount_codes(
    db: AsyncSession,
    active_only: bool = True
) -> List[SubscriptionDiscount]:
    """Get all discount codes"""
    query = select(SubscriptionDiscount)
    if active_only:
        query = query.where(SubscriptionDiscount.is_active == True)
    query = query.order_by(desc(SubscriptionDiscount.created_at))
    
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_discount_by_id(
    db: AsyncSession,
    discount_id: int
) -> Optional[SubscriptionDiscount]:
    """Get discount code by ID"""
    result = await db.execute(
        select(SubscriptionDiscount).where(SubscriptionDiscount.id == discount_id)
    )
    return result.scalar_one_or_none()


async def update_discount_code(
    db: AsyncSession,
    discount_id: int,
    discount_data: SubscriptionDiscountUpdate
) -> Optional[SubscriptionDiscount]:
    """Update a discount code"""
    result = await db.execute(
        select(SubscriptionDiscount).where(SubscriptionDiscount.id == discount_id)
    )
    discount = result.scalar_one_or_none()
    if not discount:
        return None
    
    update_data = discount_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(discount, field, value)
    
    await db.commit()
    await db.refresh(discount)
    
    logger.info(f"Updated discount code {discount_id}")
    return discount


# ============ EVENT LOG CRUD ============

async def create_event_log(
    db: AsyncSession,
    event_data: SubscriptionEventLogCreate
) -> SubscriptionEventLog:
    """Create a subscription event log entry"""
    event_log = SubscriptionEventLog(
        subscription_id=event_data.subscription_id,
        triggered_by_id=event_data.triggered_by_id,
        triggered_by_role=event_data.triggered_by_role,
        event_type=event_data.event_type,
        event_description=event_data.event_description,
        event_metadata=event_data.event_metadata,
    )
    
    db.add(event_log)
    await db.commit()
    await db.refresh(event_log)
    
    return event_log


# ============ ANALYTICS & REPORTING ============

async def get_expiring_subscriptions(
    db: AsyncSession,
    head_id: int,
    days: int = 7
) -> List[LearnerSubscription]:
    """Get subscriptions expiring in the next N days for a HEAD"""
    target_date = date.today() + timedelta(days=days)
    
    result = await db.execute(
        select(LearnerSubscription)
        .where(
            and_(
                LearnerSubscription.current_head_id == head_id,
                LearnerSubscription.status == SubscriptionStatus.ACTIVE,
                LearnerSubscription.expiry_date <= target_date,
                LearnerSubscription.expiry_date >= date.today()
            )
        )
        .order_by(LearnerSubscription.expiry_date)
    )
    return list(result.scalars().all())


async def get_revenue_by_head(
    db: AsyncSession,
    head_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> dict:
    """Get revenue statistics for a HEAD"""
    query = select(LearnerSubscription).where(LearnerSubscription.created_by_head_id == head_id)
    
    if start_date:
        query = query.where(LearnerSubscription.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.where(LearnerSubscription.created_at <= datetime.combine(end_date, datetime.max.time()))
    
    result = await db.execute(query)
    subscriptions = result.scalars().all()
    
    total_revenue = sum(sub.net_price_paid for sub in subscriptions)
    total_refunds = sum(sub.refund_amount or Decimal("0") for sub in subscriptions if sub.refund_amount)
    net_revenue = total_revenue - total_refunds
    
    active_count = sum(1 for sub in subscriptions if sub.status == SubscriptionStatus.ACTIVE)
    
    return {
        "total_subscriptions": len(subscriptions),
        "total_revenue": total_revenue,
        "total_refunds": total_refunds,
        "net_revenue": net_revenue,
        "active_subscriptions": active_count,
    }


async def get_subscription_stats(db: AsyncSession) -> dict:
    """Get overall subscription statistics (for ADMIN)"""
    result = await db.execute(select(LearnerSubscription))
    subscriptions = result.scalars().all()
    
    stats = {
        "total_active": sum(1 for s in subscriptions if s.status == SubscriptionStatus.ACTIVE),
        "total_expired": sum(1 for s in subscriptions if s.status == SubscriptionStatus.EXPIRED),
        "total_paused": sum(1 for s in subscriptions if s.status == SubscriptionStatus.PAUSED),
        "total_frozen": sum(1 for s in subscriptions if s.status == SubscriptionStatus.FROZEN),
        "total_cancelled": sum(1 for s in subscriptions if s.status == SubscriptionStatus.CANCELLED),
        "total_refunded": sum(1 for s in subscriptions if s.status == SubscriptionStatus.REFUNDED),
        "total_revenue": sum(s.net_price_paid for s in subscriptions),
    }
    
    return stats


# ============ SCHEDULED TASK HELPERS ============

async def expire_subscriptions(db: AsyncSession) -> int:
    """Mark subscriptions as expired if expiry_date has passed (for scheduled task)"""
    result = await db.execute(
        select(LearnerSubscription)
        .where(
            and_(
                LearnerSubscription.status == SubscriptionStatus.ACTIVE,
                LearnerSubscription.expiry_date < date.today()
            )
        )
    )
    subscriptions = result.scalars().all()
    
    count = 0
    for subscription in subscriptions:
        subscription.status = SubscriptionStatus.EXPIRED
        count += 1
    
    if count > 0:
        await db.commit()
        logger.info(f"Expired {count} subscriptions")
    
    return count


async def process_ended_sessions_and_update_subscriptions(db: AsyncSession) -> int:
    """
    Process all ended sessions that haven't been counted yet.
    - Decrement sessions_remaining and increment sessions_completed
    - Mark learner as inactive when sessions_remaining reaches 0
    Returns count of sessions processed
    """
    from app.models.session_model import TrainingSession
    from app.models.user_model import User
    
    # Get all ended sessions that haven't been counted yet
    result = await db.execute(
        select(TrainingSession)
        .where(
            and_(
                TrainingSession.status == "ended",
                TrainingSession.session_counted == 0,
                TrainingSession.subscription_id.isnot(None)
            )
        )
    )
    ended_sessions = result.scalars().all()
    
    count = 0
    for session in ended_sessions:
        try:
            # Get the subscription
            subscription = await db.execute(
                select(LearnerSubscription)
                .where(LearnerSubscription.id == session.subscription_id)
            )
            sub = subscription.scalar_one_or_none()
            
            if sub and sub.sessions_remaining > 0:
                # Decrement remaining and increment completed
                sub.sessions_remaining -= 1
                sub.sessions_completed += 1
                
                # Mark session as counted
                session.session_counted = 1
                
                # Log the adjustment
                await db.flush()
                
                # Create event log
                event_log = SubscriptionEventLog(
                    subscription_id=sub.id,
                    event_type="SESSION_COMPLETED",
                    event_description=f"Session {session.session_id} counted. Remaining: {sub.sessions_remaining}",
                    event_metadata={
                        "session_id": session.session_id,
                        "sessions_remaining": sub.sessions_remaining,
                        "sessions_completed": sub.sessions_completed,
                        "learner_id": sub.learner_id
                    }
                )
                db.add(event_log)
                
                # Check if sessions_remaining reached 0
                if sub.sessions_remaining == 0:
                    # Mark subscription as EXPIRED
                    from app.models.subscription import SubscriptionStatus
                    sub.status = SubscriptionStatus.EXPIRED
                    
                    # Mark learner as inactive
                    learner = await db.execute(
                        select(User).where(User.id == sub.learner_id)
                    )
                    learner_user = learner.scalar_one_or_none()
                    
                    if learner_user:
                        learner_user.is_active = False
                        
                        # Log the inactivation
                        event_log_inactive = SubscriptionEventLog(
                            subscription_id=sub.id,
                            event_type="LEARNER_INACTIVATED",
                            event_description=f"Learner {sub.learner_id} marked as inactive - all subscription sessions exhausted",
                            event_metadata={
                                "learner_id": sub.learner_id,
                                "reason": "sessions_exhausted"
                            }
                        )
                        db.add(event_log_inactive)
                        
                        logger.info(f"Learner {sub.learner_id} marked as inactive due to subscription sessions exhausted")
                
                count += 1
        
        except Exception as e:
            logger.error(f"Error processing session {session.session_id}: {str(e)}")
            continue
    
    if count > 0:
        await db.commit()
        logger.info(f"Processed {count} ended sessions and updated subscriptions")
    
    return count


async def get_subscriptions_needing_reminders(
    db: AsyncSession,
    days_before_expiry: int
) -> List[LearnerSubscription]:
    """Get subscriptions needing renewal reminders"""
    target_date = date.today() + timedelta(days=days_before_expiry)
    
    result = await db.execute(
        select(LearnerSubscription)
        .where(
            and_(
                LearnerSubscription.status == SubscriptionStatus.ACTIVE,
                LearnerSubscription.expiry_date == target_date,
                LearnerSubscription.renewed_to_subscription_id.is_(None)  # Not yet renewed
            )
        )
    )
    return list(result.scalars().all())


# ============ PUBLIC SUBSCRIPTION INQUIRY CRUD ============

from app.models.subscription import PublicSubscriptionInquiry


async def create_inquiry(
    db: AsyncSession,
    learner_name: str,
    email: str,
    contact_number: str,
    age: Optional[int] = None,
    date_of_birth=None,
    date_of_assessment=None,
    package_id: Optional[int] = None,
    package_name: Optional[str] = None,
    package_price=None,
    payment_method: Optional[str] = None,
    payment_receipt_url: Optional[str] = None,
    payment_receipt_filename: Optional[str] = None,
) -> PublicSubscriptionInquiry:
    """Create a new public subscription inquiry record."""
    inquiry = PublicSubscriptionInquiry(
        learner_name=learner_name,
        email=email,
        contact_number=contact_number,
        age=age,
        date_of_birth=date_of_birth,
        date_of_assessment=date_of_assessment,
        package_id=package_id,
        package_name=package_name,
        package_price=package_price,
        payment_method=payment_method,
        payment_receipt_url=payment_receipt_url,
        payment_receipt_filename=payment_receipt_filename,
        review_status="NEW",
    )
    db.add(inquiry)
    await db.commit()
    await db.refresh(inquiry)
    logger.info(f"New public subscription inquiry #{inquiry.id} from {email}")
    return inquiry


async def get_all_inquiries(
    db: AsyncSession,
    review_status: Optional[str] = None,
    skip: int = 0,
    limit: int = 200,
) -> List[PublicSubscriptionInquiry]:
    """Fetch all inquiries with optional status filter."""
    query = select(PublicSubscriptionInquiry)
    if review_status:
        query = query.where(PublicSubscriptionInquiry.review_status == review_status)
    query = query.order_by(desc(PublicSubscriptionInquiry.submitted_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_inquiry_by_id(db: AsyncSession, inquiry_id: int) -> Optional[PublicSubscriptionInquiry]:
    """Get a single inquiry by ID."""
    result = await db.execute(
        select(PublicSubscriptionInquiry).where(PublicSubscriptionInquiry.id == inquiry_id)
    )
    return result.scalar_one_or_none()


async def update_inquiry(
    db: AsyncSession,
    inquiry_id: int,
    review_status: Optional[str] = None,
    admin_notes: Optional[str] = None,
) -> Optional[PublicSubscriptionInquiry]:
    """Update admin review status or notes for an inquiry."""
    inquiry = await get_inquiry_by_id(db, inquiry_id)
    if not inquiry:
        return None
    if review_status is not None:
        inquiry.review_status = review_status
    if admin_notes is not None:
        inquiry.admin_notes = admin_notes
    await db.commit()
    await db.refresh(inquiry)
    return inquiry
