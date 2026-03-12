"""SQLAlchemy ORM Models for Learner Subscription & Payment Management System
"""

import enum
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text, Date,
    CheckConstraint, Index
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


def get_current_datetime():
    """Get current local system datetime (naive datetime for database compatibility)"""
    return datetime.now()


# ============ ENUMERATIONS ============

class PackageType(enum.Enum):
    """Type of subscription package"""
    LEARNER = "LEARNER"    # Package for learners
    COACH = "COACH"        # Package for coaches


class SubscriptionStatus(enum.Enum):
    """Status of a learner's subscription"""
    ACTIVE = "ACTIVE"              # Currently active, sessions can be consumed
    EXPIRED = "EXPIRED"            # Validity period ended
    CANCELLED = "CANCELLED"        # Manually cancelled by HEAD
    REFUNDED = "REFUNDED"          # Refund issued
    PAUSED = "PAUSED"              # Temporarily paused, stops expiry countdown, sessions allowed
    FROZEN = "FROZEN"              # Completely frozen, no sessions allowed, no expiry countdown


class PaymentStatus(enum.Enum):
    """Status of payment receipt verification"""
    PENDING = "PENDING"            # Uploaded, awaiting verification
    APPROVED = "APPROVED"          # Verified by ADMIN
    REJECTED = "REJECTED"          # Rejected by ADMIN


class DiscountType(enum.Enum):
    """Type of discount calculation"""
    PERCENTAGE = "PERCENTAGE"      # Discount as percentage (e.g., 20%)
    FIXED = "FIXED"                # Fixed amount discount (e.g., ₹500)


class RefundType(enum.Enum):
    """Type of refund calculation"""
    FULL = "FULL"                  # Full amount refunded
    PRORATED = "PRORATED"          # Prorated based on remaining sessions


class AdjustmentType(enum.Enum):
    """Type of session adjustment"""
    ADD = "ADD"                    # Adding sessions
    SUBTRACT = "SUBTRACT"          # Subtracting sessions


# ============ MAIN MODELS ============

class SubscriptionPackage(Base):
    """
    Subscription package templates created by HEAD.
    Defines session count, validity, and pricing.
    """
    __tablename__ = "subscription_packages"
    
    id = Column(Integer, primary_key=True, index=True)
    head_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Package details
    package_name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    sessions_count = Column(Integer, nullable=False)  # Total sessions in package
    validity_days = Column(Integer, nullable=False)    # Validity period in days
    price = Column(Numeric(10, 2), nullable=False)     # Package price
    package_type = Column(SAEnum(PackageType, name="packagetype"), nullable=False, default=PackageType.LEARNER)  # Package target type

    # Package status
    is_active = Column(Boolean, default=True, nullable=False)  # Soft delete flag
    
    # Metadata
    created_at = Column(DateTime, nullable=False, default=get_current_datetime, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, default=get_current_datetime, onupdate=get_current_datetime, server_default=func.now())
    
    # Dedicated coach for COACH-type packages (one coach per package)
    dedicated_coach_id = Column(Integer, ForeignKey("coach_profiles.id", ondelete="SET NULL"), nullable=True, index=True)

    # Relationships
    head = relationship("User", foreign_keys=[head_id])
    dedicated_coach = relationship("CoachProfile", foreign_keys=[dedicated_coach_id])
    subscriptions = relationship("LearnerSubscription", back_populates="package", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_package_head_active', 'head_id', 'is_active'),
        Index('idx_package_dedicated_coach', 'dedicated_coach_id'),
    )


class LearnerSubscription(Base):
    """
    Active subscription for a learner.
    One learner can have only one ACTIVE/PAUSED/FROZEN subscription at a time.
    Stores denormalized package details for historical accuracy.
    """
    __tablename__ = "learner_subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    learner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    package_id = Column(Integer, ForeignKey("subscription_packages.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by_head_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    current_head_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Denormalized package details (snapshot at subscription creation)
    package_name = Column(String(200), nullable=False)
    package_sessions = Column(Integer, nullable=False)
    package_validity_days = Column(Integer, nullable=False)
    package_original_price = Column(Numeric(10, 2), nullable=False)
    
    # Subscription lifecycle
    start_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=False)
    status = Column(SAEnum(SubscriptionStatus, name="subscriptionstatus"), nullable=False, default=SubscriptionStatus.ACTIVE, server_default="ACTIVE", index=True)
    
    # Session tracking
    sessions_total = Column(Integer, nullable=False)           # Total sessions purchased
    sessions_completed = Column(Integer, nullable=False, default=0, server_default="0")  # Sessions consumed
    sessions_remaining = Column(Integer, nullable=False)       # Calculated: total - completed
    
    # Pricing and discounts
    discount_applied = Column(Numeric(10, 2), nullable=False, default=0, server_default="0")  # Total discount amount
    discount_code_id = Column(Integer, ForeignKey("subscription_discounts.id", ondelete="SET NULL"), nullable=True, index=True)
    applied_by_head_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)  # HEAD who applied discount
    net_price_paid = Column(Numeric(10, 2), nullable=False)   # Final price after discount
    
    # Pause/Freeze tracking
    paused_at = Column(DateTime, nullable=True)
    paused_duration_days = Column(Integer, nullable=False, default=0, server_default="0")  # Cumulative pause duration
    frozen_at = Column(DateTime, nullable=True)
    frozen_duration_days = Column(Integer, nullable=False, default=0, server_default="0")  # Cumulative freeze duration
    
    # Renewal tracking
    renewed_from_subscription_id = Column(Integer, ForeignKey("learner_subscriptions.id", ondelete="SET NULL"), nullable=True, index=True)
    renewed_to_subscription_id = Column(Integer, nullable=True)  # Filled when this subscription is renewed
    
    # Refund tracking
    refund_amount = Column(Numeric(10, 2), nullable=True)
    refund_type = Column(SAEnum(RefundType, name="refundtype"), nullable=True)
    refund_date = Column(DateTime, nullable=True)
    refund_reason = Column(Text, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, nullable=False, default=get_current_datetime, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, default=get_current_datetime, onupdate=get_current_datetime, server_default=func.now())
    
    # Relationships
    learner = relationship("User", foreign_keys=[learner_id])
    package = relationship("SubscriptionPackage", back_populates="subscriptions")
    created_by_head = relationship("User", foreign_keys=[created_by_head_id])
    current_head = relationship("User", foreign_keys=[current_head_id])
    applied_by_head = relationship("User", foreign_keys=[applied_by_head_id])
    discount_code = relationship("SubscriptionDiscount", back_populates="subscriptions")
    
    payment_receipts = relationship("SubscriptionPaymentReceipt", back_populates="subscription", cascade="all, delete-orphan")
    session_adjustments = relationship("SessionAdjustmentLog", back_populates="subscription", cascade="all, delete-orphan")
    event_logs = relationship("SubscriptionEventLog", back_populates="subscription", cascade="all, delete-orphan")
    
    renewed_from = relationship("LearnerSubscription", remote_side=[id], foreign_keys=[renewed_from_subscription_id])
    
    # Indexes
    __table_args__ = (
        Index('idx_subscription_learner_status', 'learner_id', 'status'),
        Index('idx_subscription_head_status', 'current_head_id', 'status'),
        Index('idx_subscription_expiry', 'expiry_date', 'status'),
        CheckConstraint('sessions_total >= 0', name='check_sessions_total_positive'),
        CheckConstraint('sessions_completed >= 0', name='check_sessions_completed_positive'),
        CheckConstraint('sessions_remaining >= 0', name='check_sessions_remaining_positive'),
        CheckConstraint('net_price_paid >= 0', name='check_net_price_positive'),
    )


class SubscriptionPaymentReceipt(Base):
    """
    Payment receipt uploads for subscriptions.
    Stored in AWS S3 with local filesystem fallback.
    """
    __tablename__ = "subscription_payment_receipts"
    
    id = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey("learner_subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    uploaded_by_head_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # File details
    file_name = Column(String(500), nullable=False)
    file_path = Column(String(1024), nullable=False)  # S3 URL or local filesystem path
    file_size = Column(Integer, nullable=True)         # File size in bytes
    storage_type = Column(String(20), nullable=False, default="s3")  # "s3" or "local"
    
    # Payment verification
    payment_status = Column(SAEnum(PaymentStatus, name="paymentstatus"), nullable=False, default=PaymentStatus.PENDING, server_default="PENDING", index=True)
    verified_by_admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    verified_at = Column(DateTime, nullable=True)
    verification_notes = Column(Text, nullable=True)
    
    # Metadata
    uploaded_at = Column(DateTime, nullable=False, default=get_current_datetime, server_default=func.now())
    
    # Relationships
    subscription = relationship("LearnerSubscription", back_populates="payment_receipts")
    uploaded_by_head = relationship("User", foreign_keys=[uploaded_by_head_id])
    verified_by_admin = relationship("User", foreign_keys=[verified_by_admin_id])
    
    # Indexes
    __table_args__ = (
        Index('idx_receipt_subscription_status', 'subscription_id', 'payment_status'),
        Index('idx_receipt_status_uploaded', 'payment_status', 'uploaded_at'),
    )


class SubscriptionDiscount(Base):
    """
    Discount codes for subscription packages.
    Can be percentage or fixed amount with eligibility criteria.
    """
    __tablename__ = "subscription_discounts"
    
    id = Column(Integer, primary_key=True, index=True)
    created_by_admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Discount code details
    code = Column(String(50), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    
    # Discount calculation
    discount_type = Column(SAEnum(DiscountType, name="discounttype"), nullable=False)
    discount_value = Column(Numeric(10, 2), nullable=False)  # Percentage (0-100) or Fixed amount
    
    # Eligibility criteria (JSONB for flexibility)
    eligibility_criteria = Column(JSONB, nullable=True)
    # Example: {"min_package_price": 5000, "max_usage_count": 100, "applicable_heads": [1, 2, 3]}
    
    # Validity
    valid_from = Column(Date, nullable=False)
    valid_until = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Usage tracking
    usage_count = Column(Integer, nullable=False, default=0, server_default="0")
    max_usage_count = Column(Integer, nullable=True)  # NULL = unlimited
    
    # Metadata
    created_at = Column(DateTime, nullable=False, default=get_current_datetime, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, default=get_current_datetime, onupdate=get_current_datetime, server_default=func.now())
    
    # Relationships
    created_by_admin = relationship("User", foreign_keys=[created_by_admin_id])
    subscriptions = relationship("LearnerSubscription", back_populates="discount_code")
    
    # Indexes
    __table_args__ = (
        Index('idx_discount_code_active', 'code', 'is_active'),
        Index('idx_discount_validity', 'valid_from', 'valid_until', 'is_active'),
        CheckConstraint('discount_value >= 0', name='check_discount_value_positive'),
    )


class SessionAdjustmentLog(Base):
    """
    Audit log for manual session adjustments.
    Tracks all manual additions/subtractions of sessions by HEAD or ADMIN.
    """
    __tablename__ = "session_adjustment_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey("learner_subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    adjusted_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    adjusted_by_role = Column(String(20), nullable=False)  # "HEAD" or "ADMIN"
    
    # Adjustment details
    adjustment_type = Column(SAEnum(AdjustmentType, name="adjustmenttype"), nullable=False)
    adjustment_amount = Column(Integer, nullable=False)  # Positive value (direction is in type)
    reason = Column(Text, nullable=False)
    
    # Session counts before/after
    sessions_before = Column(Integer, nullable=False)
    sessions_after = Column(Integer, nullable=False)
    
    # Metadata
    adjusted_at = Column(DateTime, nullable=False, default=get_current_datetime, server_default=func.now())
    
    # Relationships
    subscription = relationship("LearnerSubscription", back_populates="session_adjustments")
    adjusted_by = relationship("User", foreign_keys=[adjusted_by_id])
    
    # Indexes
    __table_args__ = (
        Index('idx_adjustment_subscription', 'subscription_id', 'adjusted_at'),
        Index('idx_adjustment_user', 'adjusted_by_id', 'adjusted_at'),
        CheckConstraint('adjustment_amount > 0', name='check_adjustment_amount_positive'),
    )


class SubscriptionEventLog(Base):
    """
    Timeline event log for all subscription lifecycle events.
    Provides complete audit trail for status changes, payments, adjustments.
    """
    __tablename__ = "subscription_event_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey("learner_subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    triggered_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    triggered_by_role = Column(String(20), nullable=True)  # "HEAD", "ADMIN", "SYSTEM"
    
    # Event details
    event_type = Column(String(50), nullable=False, index=True)
    # Event types: "CREATED", "ACTIVATED", "PAUSED", "FROZEN", "RESUMED", "EXPIRED", 
    #              "RENEWED", "CANCELLED", "REFUNDED", "PAYMENT_UPLOADED", "PAYMENT_VERIFIED",
    #              "SESSION_ADJUSTED", "STATUS_CHANGED"
    
    event_description = Column(Text, nullable=False)
    event_metadata = Column(JSONB, nullable=True)  # Additional structured data
    
    # Metadata
    created_at = Column(DateTime, nullable=False, default=get_current_datetime, server_default=func.now())
    
    # Relationships
    subscription = relationship("LearnerSubscription", back_populates="event_logs")
    triggered_by = relationship("User", foreign_keys=[triggered_by_id])
    
    # Indexes
    __table_args__ = (
        Index('idx_event_subscription_type', 'subscription_id', 'event_type', 'created_at'),
        Index('idx_event_created', 'created_at'),
    )


class PublicSubscriptionInquiry(Base):
    """
    Public inquiry for subscription purchase submitted via the landing page.
    No authentication required – simply collects prospective learner information.
    No subscription or learner account is created; this is purely a data-collection record.
    """
    __tablename__ = "public_subscription_inquiries"

    id = Column(Integer, primary_key=True, index=True)

    # Learner personal details
    learner_name = Column(String(200), nullable=False)
    email = Column(String(255), nullable=False)
    contact_number = Column(String(50), nullable=False)
    age = Column(Integer, nullable=True)
    date_of_birth = Column(Date, nullable=True)

    # Assessment date
    date_of_assessment = Column(Date, nullable=True)

    # Package & payment details (denormalised so we preserve history)
    package_id = Column(Integer, ForeignKey("subscription_packages.id", ondelete="SET NULL"), nullable=True)
    package_name = Column(String(200), nullable=True)
    package_price = Column(Numeric(10, 2), nullable=True)
    payment_method = Column(String(50), nullable=True)  # "UPI" | "BANK_TRANSFER"

    # Payment receipt file
    payment_receipt_url = Column(String(1024), nullable=True)
    payment_receipt_filename = Column(String(500), nullable=True)

    # Admin review
    review_status = Column(String(50), nullable=False, default="NEW", server_default="NEW")
    # Possible values: NEW, REVIEWED, PROCESSED
    admin_notes = Column(Text, nullable=True)

    # Timestamps
    submitted_at = Column(DateTime, nullable=False, default=get_current_datetime, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, default=get_current_datetime, onupdate=get_current_datetime, server_default=func.now())

    # Relationship (read-only reference)
    package = relationship("SubscriptionPackage", foreign_keys=[package_id])

    __table_args__ = (
        Index('idx_inquiry_submitted_at', 'submitted_at'),
        Index('idx_inquiry_review_status', 'review_status'),
    )
