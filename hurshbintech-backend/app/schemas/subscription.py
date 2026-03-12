"""
Pydantic schemas for Learner Subscription & Payment Management System
"""

import enum
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


# ============ ENUMERATIONS ============

class SubscriptionStatusEnum(str, enum.Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"
    PAUSED = "PAUSED"
    FROZEN = "FROZEN"


class PaymentStatusEnum(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class DiscountTypeEnum(str, enum.Enum):
    PERCENTAGE = "PERCENTAGE"
    FIXED = "FIXED"


class RefundTypeEnum(str, enum.Enum):
    FULL = "FULL"
    PRORATED = "PRORATED"


class AdjustmentTypeEnum(str, enum.Enum):
    ADD = "ADD"
    SUBTRACT = "SUBTRACT"


class PackageTypeEnum(str, enum.Enum):
    LEARNER = "LEARNER"
    COACH = "COACH"


# ============ SUBSCRIPTION PACKAGE SCHEMAS ============

class SubscriptionPackageBase(BaseModel):
    """Base schema for subscription package"""
    package_name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    sessions_count: int = Field(..., gt=0)
    validity_days: int = Field(..., gt=0)
    price: Decimal = Field(..., ge=0, decimal_places=2)
    package_type: PackageTypeEnum = PackageTypeEnum.LEARNER


class SubscriptionPackageCreate(SubscriptionPackageBase):
    """Schema for creating a new package"""
    pass


class SubscriptionPackageUpdate(BaseModel):
    """Schema for updating a package"""
    package_name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    sessions_count: Optional[int] = Field(None, gt=0)
    validity_days: Optional[int] = Field(None, gt=0)
    price: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    is_active: Optional[bool] = None
    package_type: Optional[PackageTypeEnum] = None


class SubscriptionPackageResponse(SubscriptionPackageBase):
    """Schema for package response"""
    id: int
    head_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ LEARNER SUBSCRIPTION SCHEMAS ============

class LearnerSubscriptionBase(BaseModel):
    """Base schema for learner subscription"""
    learner_id: int
    package_id: int
    start_date: date
    discount_code: Optional[str] = None


class LearnerSubscriptionCreate(LearnerSubscriptionBase):
    """Schema for creating a new subscription"""
    pass


class LearnerSubscriptionBackdateCreate(BaseModel):
    """Schema for backdated subscription renewal within grace period"""
    learner_id: int
    package_id: int
    start_date: date  # Backdated start date
    discount_code: Optional[str] = None
    acknowledge_session_gap: bool = False  # Must be true if sessions exist in gap


class LearnerSubscriptionUpdate(BaseModel):
    """Schema for updating subscription"""
    status: Optional[SubscriptionStatusEnum] = None


class LearnerSubscriptionResponse(BaseModel):
    """Schema for subscription response"""
    id: int
    learner_id: int
    package_id: Optional[int]
    created_by_head_id: Optional[int]
    current_head_id: Optional[int]
    
    # Learner and Head info (from relationships)
    learner_name: Optional[str] = None
    head_name: Optional[str] = None
    
    # Denormalized package details
    package_name: str
    package_sessions: int
    package_validity_days: int
    package_original_price: Decimal
    
    # Subscription lifecycle
    start_date: date
    expiry_date: date
    status: SubscriptionStatusEnum
    
    # Session tracking
    sessions_total: int
    sessions_completed: int
    sessions_remaining: int
    
    # Pricing
    discount_applied: Decimal
    discount_code_id: Optional[int]
    applied_by_head_id: Optional[int]
    net_price_paid: Decimal
    
    # Pause/Freeze
    paused_at: Optional[datetime]
    paused_duration_days: int
    frozen_at: Optional[datetime]
    frozen_duration_days: int
    
    # Renewal
    renewed_from_subscription_id: Optional[int]
    renewed_to_subscription_id: Optional[int]
    
    # Refund
    refund_amount: Optional[Decimal]
    refund_type: Optional[RefundTypeEnum]
    refund_date: Optional[datetime]
    refund_reason: Optional[str]
    
    # Metadata
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @field_validator('learner_name', mode='before')
    @classmethod
    def populate_learner_name(cls, v, info):
        """Populate learner_name from learner relationship if not provided"""
        if v is None and 'learner' in info.data and info.data['learner'] is not None:
            return info.data['learner'].name
        return v

    @field_validator('head_name', mode='before')
    @classmethod
    def populate_head_name(cls, v, info):
        """Populate head_name from current_head relationship if not provided"""
        if v is None and 'current_head' in info.data and info.data['current_head'] is not None:
            return info.data['current_head'].name
        return v


class LearnerSubscriptionDetailResponse(LearnerSubscriptionResponse):
    """Detailed subscription response with related data"""
    learner_name: Optional[str] = None
    learner_email: Optional[str] = None
    head_name: Optional[str] = None
    payment_receipts: List["PaymentReceiptResponse"] = []
    session_adjustments: List["SessionAdjustmentLogResponse"] = []
    event_logs: List["SubscriptionEventLogResponse"] = []


# ============ PAYMENT RECEIPT SCHEMAS ============

class PaymentReceiptUpload(BaseModel):
    """Schema for uploading payment receipt"""
    subscription_id: int


class PaymentReceiptVerify(BaseModel):
    """Schema for verifying payment receipt"""
    payment_status: PaymentStatusEnum
    verification_notes: Optional[str] = None


class PaymentReceiptResponse(BaseModel):
    """Schema for payment receipt response"""
    id: int
    subscription_id: int
    uploaded_by_head_id: Optional[int]
    
    file_name: str
    file_path: str
    file_size: Optional[int]
    storage_type: str
    
    payment_status: PaymentStatusEnum
    verified_by_admin_id: Optional[int]
    verified_at: Optional[datetime]
    verification_notes: Optional[str]
    
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ============ SUBSCRIPTION DISCOUNT SCHEMAS ============

class SubscriptionDiscountBase(BaseModel):
    """Base schema for discount code"""
    code: str = Field(..., min_length=3, max_length=50)
    description: Optional[str] = None
    discount_type: DiscountTypeEnum
    discount_value: Decimal = Field(..., gt=0, decimal_places=2)
    eligibility_criteria: Optional[dict] = None
    valid_from: date
    valid_until: date
    max_usage_count: Optional[int] = Field(None, gt=0)

    @field_validator('valid_until')
    @classmethod
    def validate_date_range(cls, v, info):
        if 'valid_from' in info.data and v < info.data['valid_from']:
            raise ValueError('valid_until must be after valid_from')
        return v


class SubscriptionDiscountCreate(SubscriptionDiscountBase):
    """Schema for creating a discount code"""
    pass


class SubscriptionDiscountBulkCreate(BaseModel):
    """Schema for bulk discount code generation"""
    prefix: str = Field(..., min_length=2, max_length=20)
    count: int = Field(..., gt=0, le=1000)
    discount_type: DiscountTypeEnum
    discount_value: Decimal = Field(..., gt=0, decimal_places=2)
    eligibility_criteria: Optional[dict] = None
    valid_from: date
    valid_until: date
    max_usage_count: Optional[int] = Field(None, gt=0)
    description: Optional[str] = None


class SubscriptionDiscountUpdate(BaseModel):
    """Schema for updating discount code"""
    description: Optional[str] = None
    discount_type: Optional[DiscountTypeEnum] = None
    discount_value: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    eligibility_criteria: Optional[dict] = None
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    is_active: Optional[bool] = None
    max_usage_count: Optional[int] = Field(None, gt=0)


class SubscriptionDiscountResponse(SubscriptionDiscountBase):
    """Schema for discount code response"""
    id: int
    created_by_admin_id: Optional[int]
    is_active: bool
    usage_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DiscountCodeValidation(BaseModel):
    """Schema for discount code validation response"""
    is_valid: bool
    discount_id: Optional[int] = None
    discount_type: Optional[DiscountTypeEnum] = None
    discount_value: Optional[Decimal] = None
    calculated_discount: Optional[Decimal] = None
    final_price: Optional[Decimal] = None
    error_message: Optional[str] = None


# ============ SESSION ADJUSTMENT SCHEMAS ============

class SessionAdjustmentCreate(BaseModel):
    """Schema for creating session adjustment"""
    subscription_id: int
    adjustment_type: AdjustmentTypeEnum
    adjustment_amount: int = Field(..., gt=0, le=10)  # Max ±10 sessions
    reason: str = Field(..., min_length=10, max_length=500)


class SessionAdjustmentLogResponse(BaseModel):
    """Schema for session adjustment log response"""
    id: int
    subscription_id: int
    adjusted_by_id: Optional[int]
    adjusted_by_role: str
    
    adjustment_type: AdjustmentTypeEnum
    adjustment_amount: int
    reason: str
    
    sessions_before: int
    sessions_after: int
    
    adjusted_at: datetime

    class Config:
        from_attributes = True


# ============ SUBSCRIPTION EVENT LOG SCHEMAS ============

class SubscriptionEventLogCreate(BaseModel):
    """Schema for creating event log"""
    subscription_id: int
    event_type: str
    event_description: str
    event_metadata: Optional[dict] = None
    triggered_by_id: Optional[int] = None
    triggered_by_role: Optional[str] = None


class SubscriptionEventLogResponse(BaseModel):
    """Schema for event log response"""
    id: int
    subscription_id: int
    triggered_by_id: Optional[int]
    triggered_by_role: Optional[str]
    
    event_type: str
    event_description: str
    event_metadata: Optional[dict]
    
    created_at: datetime

    class Config:
        from_attributes = True


# ============ SUBSCRIPTION ACTION SCHEMAS ============

class SubscriptionPauseRequest(BaseModel):
    """Schema for pausing subscription"""
    subscription_id: int
    reason: Optional[str] = None


class SubscriptionFreezeRequest(BaseModel):
    """Schema for freezing subscription"""
    subscription_id: int
    reason: Optional[str] = None


class SubscriptionResumeRequest(BaseModel):
    """Schema for resuming subscription"""
    subscription_id: int


class SubscriptionCancelRequest(BaseModel):
    """Schema for cancelling subscription"""
    subscription_id: int
    reason: str = Field(..., min_length=10)


class SubscriptionRefundRequest(BaseModel):
    """Schema for processing refund"""
    subscription_id: int
    refund_type: RefundTypeEnum
    reason: str = Field(..., min_length=10)


class SubscriptionRefundResponse(BaseModel):
    """Schema for refund response"""
    subscription_id: int
    refund_amount: Decimal
    refund_type: RefundTypeEnum
    sessions_remaining: int
    sessions_total: int
    net_price_paid: Decimal


class SubscriptionRenewalRequest(BaseModel):
    """Schema for subscription renewal"""
    learner_id: int
    new_package_id: int
    discount_code: Optional[str] = None


# ============ ANALYTICS & REPORTING SCHEMAS ============

class RevenueByHeadResponse(BaseModel):
    """Schema for revenue reporting by HEAD"""
    head_id: int
    head_name: str
    total_subscriptions: int
    total_revenue: Decimal
    total_refunds: Decimal
    net_revenue: Decimal
    active_subscriptions: int
    period_start: Optional[date] = None
    period_end: Optional[date] = None


class SubscriptionStatsResponse(BaseModel):
    """Schema for subscription statistics"""
    total_active: int
    total_expired: int
    total_paused: int
    total_frozen: int
    total_cancelled: int
    total_refunded: int
    expiring_in_7_days: int
    expiring_in_14_days: int
    pending_payments: Optional[int] = 0  # No longer calculated after payment verification removal
    total_revenue: Decimal


class ExpiringSubscriptionResponse(BaseModel):
    """Schema for expiring subscriptions"""
    subscription_id: int
    learner_id: int
    learner_name: str
    learner_email: Optional[str]
    package_name: str
    expiry_date: date
    days_until_expiry: int
    sessions_remaining: int
    net_price_paid: Decimal


# ============ VALIDATION SCHEMAS ============

class SessionGapWarning(BaseModel):
    """Schema for session gap validation warning"""
    has_sessions_in_gap: bool
    session_count: int
    gap_start_date: date
    gap_end_date: date
    warning_message: str


class BackdateValidationResponse(BaseModel):
    """Schema for backdate validation response"""
    is_valid: bool
    within_grace_period: bool
    session_gap_warning: Optional[SessionGapWarning] = None
    error_message: Optional[str] = None


# Update forward references
LearnerSubscriptionDetailResponse.model_rebuild()


# ============ PUBLIC SUBSCRIPTION INQUIRY SCHEMAS ============

class PaymentMethodEnum(str, enum.Enum):
    UPI = "UPI"
    BANK_TRANSFER = "BANK_TRANSFER"


class InquiryReviewStatusEnum(str, enum.Enum):
    NEW = "NEW"
    REVIEWED = "REVIEWED"
    PROCESSED = "PROCESSED"


class PublicSubscriptionInquiryCreate(BaseModel):
    """Schema for creating a public subscription inquiry (no auth required)."""
    learner_name: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., max_length=255)
    contact_number: str = Field(..., min_length=1, max_length=50)
    age: Optional[int] = Field(None, ge=0, le=150)
    date_of_birth: Optional[date] = None
    date_of_assessment: Optional[date] = None
    package_id: Optional[int] = None
    package_name: Optional[str] = Field(None, max_length=200)
    package_price: Optional[Decimal] = Field(None, ge=0)
    payment_method: Optional[str] = None


class PublicSubscriptionInquiryResponse(BaseModel):
    """Schema for public subscription inquiry response."""
    id: int
    learner_name: str
    email: str
    contact_number: str
    age: Optional[int] = None
    date_of_birth: Optional[date] = None
    date_of_assessment: Optional[date] = None
    package_id: Optional[int] = None
    package_name: Optional[str] = None
    package_price: Optional[Decimal] = None
    payment_method: Optional[str] = None
    payment_receipt_url: Optional[str] = None
    payment_receipt_filename: Optional[str] = None
    review_status: str
    admin_notes: Optional[str] = None
    submitted_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PublicSubscriptionInquiryUpdate(BaseModel):
    """Schema used by admin to update review status / notes."""
    review_status: Optional[str] = None
    admin_notes: Optional[str] = None
