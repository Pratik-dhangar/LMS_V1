"""Pydantic schemas for E-Commerce Cart and Order module
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


# Enums
class OrderStatusEnum(str):
    CREATED = "CREATED"
    PAYMENT_UPLOADED = "PAYMENT_UPLOADED"
    PAYMENT_APPROVED = "PAYMENT_APPROVED"
    PAYMENT_REJECTED = "PAYMENT_REJECTED"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class PaymentMethodEnum(str):
    UPI_QR = "UPI_QR"
    BANK_TRANSFER = "BANK_TRANSFER"


# Cart Schemas
class CartItemBase(BaseModel):
    product_id: UUID
    quantity: int = Field(..., gt=0)


class CartItemCreate(CartItemBase):
    pass


class CartItemUpdate(BaseModel):
    quantity: int = Field(..., gt=0)


class CartItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    product_name: str
    quantity: int
    unit_price: Decimal
    discount_percentage: Decimal
    line_total: float
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    product: Optional[dict] = None

    class Config:
        from_attributes = True


class CartResponse(BaseModel):
    cart_id: UUID
    items: List[CartItemResponse]
    subtotal: float
    discount_total: float
    total: float

    class Config:
        from_attributes = True


# Order Schemas
class GuestCartItem(BaseModel):
    """Guest cart item for checkout (from localStorage)"""
    product_id: str  # UUID as string
    quantity: int = Field(..., gt=0)


class OrderCreate(BaseModel):
    delivery_address: str = Field(..., min_length=10, max_length=1000)
    delivery_city: str = Field(..., min_length=2, max_length=100)
    delivery_pincode: str = Field(..., min_length=6, max_length=10)
    payment_method: str  # UPI_QR or BANK_TRANSFER
    email: Optional[str] = Field(None, description="Customer email for payment instructions (uses account email if not provided)")
    name: Optional[str] = Field(None, min_length=2, max_length=255, description="Customer name (required for guest checkout)")
    contact_number: Optional[str] = Field(None, min_length=10, max_length=20, description="Customer contact number (required for guest checkout)")
    items: Optional[List[GuestCartItem]] = Field(None, description="Cart items for guest users (from localStorage)")
    
    @field_validator('delivery_address')
    @classmethod
    def validate_delivery_address(cls, v):
        if len(v.strip()) < 10:
            raise ValueError("Please enter your full address properly")
        return v
    
    @field_validator('payment_method')
    @classmethod
    def validate_payment_method(cls, v):
        if v not in ["UPI_QR", "BANK_TRANSFER"]:
            raise ValueError("Invalid payment method. Must be UPI_QR or BANK_TRANSFER")
        return v


class OrderItemResponse(BaseModel):
    id: UUID
    product_id: Optional[UUID] = None
    product_name: str
    quantity: int
    unit_price: Decimal
    discount_percentage: Decimal
    line_total: Decimal

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    order_id: UUID
    order_number: str
    status: str
    user_id: Optional[int] = None  # Nullable for guest orders
    payment_method: Optional[str] = None
    subtotal: Decimal
    discount_total: Decimal
    total_amount: Decimal
    delivery_address: str
    delivery_city: Optional[str] = None
    delivery_pincode: Optional[str] = None
    rejection_reason: Optional[str] = None
    items: List[OrderItemResponse]
    payment_receipt: Optional[dict] = None  # Payment receipt details
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AdminOrderItemResponse(BaseModel):
    """Order item response for admin orders list"""
    id: UUID
    product_id: Optional[UUID] = None
    product_name: str
    quantity: int
    unit_price: Decimal
    discount_percentage: Decimal
    line_total: Decimal

    class Config:
        from_attributes = True


class AdminOrderResponse(BaseModel):
    """Admin-specific order response with user and guest details"""
    order_id: UUID
    order_number: str
    status: str
    user_id: Optional[int] = None  # Nullable for guest orders
    user_name: str  # "Unknown" for guest orders
    user_email: Optional[str] = None  # None for guest orders
    customer_name: Optional[str] = None  # Set for guest orders
    customer_contact_number: Optional[str] = None  # Set for guest orders
    guest_token: Optional[str] = None  # Set for guest orders
    payment_method: Optional[str] = None
    subtotal: Decimal
    discount_total: Decimal
    total_amount: Decimal
    delivery_address: str
    delivery_city: Optional[str] = None
    delivery_pincode: Optional[str] = None
    rejection_reason: Optional[str] = None
    items: List[AdminOrderItemResponse]
    payment_receipt: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrderWithUserResponse(OrderResponse):
    """Extended order response with user details (for admin)"""
    user_name: str
    user_email: Optional[str] = None


class OrderCreateResponse(BaseModel):
    order_id: UUID
    order_number: str
    status: str
    total_amount: Decimal
    payment_method: str
    payment_details: dict  # Contains UPI QR URL or bank details
    items: List[OrderItemResponse]
    delivery_address: str
    created_at: datetime
    guest_token: Optional[str] = None


class OrderListResponse(BaseModel):
    """Response for listing orders with pagination"""
    orders: List[OrderResponse]
    pagination: dict


class AdminOrderListResponse(BaseModel):
    """Response for admin orders list with pagination"""
    orders: List[AdminOrderResponse]
    pagination: dict


class OrderFilters(BaseModel):
    """Query parameters for filtering orders"""
    status: Optional[str] = None
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)


# Payment Receipt Schemas
class PaymentReceiptUpload(BaseModel):
    # File will be handled via FastAPI's UploadFile, this is for response
    pass


class PaymentReceiptResponse(BaseModel):
    receipt_id: UUID
    order_id: UUID
    s3_path: str
    file_name: str
    file_size: int
    file_type: str
    uploaded_at: datetime
    preview_url: Optional[str] = None  # Signed URL for preview

    class Config:
        from_attributes = True


# Admin Approval Schemas
class OrderApprove(BaseModel):
    # No body needed, admin_id extracted from JWT
    pass


class OrderReject(BaseModel):
    reason: str = Field(..., max_length=500)


class OrderApprovalResponse(BaseModel):
    message: str
    order: OrderResponse
    invoice: Optional[dict] = None  # Invoice details (optional, may be None if S3 unavailable)


# Audit Log Schemas
class OrderAuditLogResponse(BaseModel):
    id: UUID
    action: str
    performed_by_name: str
    old_status: Optional[str] = None
    new_status: str
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OrderAuditLogList(BaseModel):
    logs: List[OrderAuditLogResponse]
