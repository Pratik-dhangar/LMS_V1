"""SQLAlchemy ORM Models for E-Commerce Module
"""

import enum
import uuid
from datetime import datetime
from typing import List

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text,
    CheckConstraint, UniqueConstraint
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


# Enums
class ProductVisibility(enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"


class OrderStatus(enum.Enum):
    CREATED = "CREATED"
    PAYMENT_UPLOADED = "PAYMENT_UPLOADED"
    PAYMENT_APPROVED = "PAYMENT_APPROVED"
    PAYMENT_REJECTED = "PAYMENT_REJECTED"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class PaymentMethod(enum.Enum):
    UPI_QR = "UPI_QR"
    BANK_TRANSFER = "BANK_TRANSFER"


# Association Tables
class ProductAgeGroup(Base):
    __tablename__ = "products_age_groups"
    
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    age_group_id = Column(UUID(as_uuid=True), ForeignKey("product_age_groups.id", ondelete="CASCADE"), primary_key=True)


class ProductSkillFocus(Base):
    __tablename__ = "products_skill_focus"
    
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    skill_id = Column(UUID(as_uuid=True), ForeignKey("product_skill_focus.id", ondelete="CASCADE"), primary_key=True)


# Main Models
class ProductCategory(Base):
    __tablename__ = "product_categories"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    name = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    icon_url = Column(String(1024), nullable=True)
    display_order = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, server_default=func.now())
    
    # Relationships
    products = relationship("Product", back_populates="category")


class AgeGroup(Base):
    __tablename__ = "product_age_groups"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    name = Column(String(50), nullable=False, unique=True)
    min_age = Column(Integer, nullable=True)
    max_age = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, server_default=func.now())
    
    # Relationships
    products = relationship("Product", secondary="products_age_groups", back_populates="age_groups")


class SkillFocus(Base):
    __tablename__ = "product_skill_focus"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, server_default=func.now())
    
    # Relationships
    products = relationship("Product", secondary="products_skill_focus", back_populates="skills")


class Product(Base):
    __tablename__ = "products"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("product_categories.id", ondelete="SET NULL"), nullable=True)
    price = Column(Numeric(10, 2), nullable=False)
    discount_percentage = Column(Numeric(5, 2), nullable=False, default=0, server_default="0")
    stock_quantity = Column(Integer, nullable=False, default=0, server_default="0")
    image_url = Column(String(1024), nullable=True)
    thumbnail_url = Column(String(1024), nullable=True)
    visibility = Column(SAEnum(ProductVisibility, name="productvisibility"), nullable=False, default=ProductVisibility.DRAFT, server_default="DRAFT", index=True)
    tags = Column(JSONB, nullable=True)  # ["Recommended", "Bestseller", "New"]
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, server_default=func.now())
    deleted_at = Column(DateTime, nullable=True)
    
    # Relationships
    category = relationship("ProductCategory", back_populates="products")
    created_by = relationship("User", foreign_keys=[created_by_id])
    age_groups = relationship("AgeGroup", secondary="products_age_groups", back_populates="products")
    skills = relationship("SkillFocus", secondary="products_skill_focus", back_populates="products")
    cart_items = relationship("CartItem", back_populates="product")
    order_items = relationship("OrderItem", back_populates="product")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('price > 0', name='products_price_check'),
        CheckConstraint('discount_percentage >= 0 AND discount_percentage <= 100', name='products_discount_check'),
        CheckConstraint('stock_quantity >= 0', name='products_stock_check'),
    )
    
    @property
    def final_price(self):
        """Calculate final price after discount"""
        if self.discount_percentage and self.discount_percentage > 0:
            return float(self.price) * (1 - float(self.discount_percentage) / 100)
        return float(self.price)
    
    @property
    def stock_available(self):
        """Check if product is in stock"""
        return self.stock_quantity > 0


class Cart(Base):
    __tablename__ = "carts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, server_default=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    items = relationship("CartItem", back_populates="cart", cascade="all, delete-orphan")


class CartItem(Base):
    __tablename__ = "cart_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    cart_id = Column(UUID(as_uuid=True), ForeignKey("carts.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)  # Snapshot at add time
    discount_percentage = Column(Numeric(5, 2), nullable=False, default=0, server_default="0")  # Snapshot at add time
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, server_default=func.now())
    
    # Relationships
    cart = relationship("Cart", back_populates="items")
    product = relationship("Product", back_populates="cart_items")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('cart_id', 'product_id', name='uq_cart_product'),
        CheckConstraint('quantity > 0', name='cart_items_quantity_check'),
    )
    
    @property
    def line_total(self):
        """Calculate line total after discount"""
        subtotal = float(self.unit_price) * self.quantity
        if self.discount_percentage and self.discount_percentage > 0:
            return subtotal * (1 - float(self.discount_percentage) / 100)
        return subtotal


class Order(Base):
    __tablename__ = "orders"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    order_number = Column(String(20), nullable=False, unique=True, index=True)  # ORD-2025-001234
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_email = Column(String(255), nullable=True, index=True)  # Email provided during checkout (may differ from user.email)
    status = Column(SAEnum(OrderStatus, name="orderstatus"), nullable=False, default=OrderStatus.CREATED, server_default="CREATED", index=True)
    payment_method = Column(SAEnum(PaymentMethod, name="paymentmethod"), nullable=True)
    subtotal = Column(Numeric(10, 2), nullable=False)
    discount_total = Column(Numeric(10, 2), nullable=False, default=0, server_default="0")
    total_amount = Column(Numeric(10, 2), nullable=False)
    delivery_address = Column(Text, nullable=False)
    delivery_city = Column(String(100), nullable=True)
    delivery_pincode = Column(String(10), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    approved_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejected_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, server_default=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    rejected_by = relationship("User", foreign_keys=[rejected_by_id])
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payment_receipt = relationship("PaymentReceipt", back_populates="order", uselist=False, cascade="all, delete-orphan")
    invoice = relationship("Invoice", back_populates="order", uselist=False, cascade="all, delete-orphan")
    audit_logs = relationship("OrderAuditLog", back_populates="order", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('subtotal > 0', name='orders_subtotal_check'),
        CheckConstraint('total_amount > 0', name='orders_total_check'),
    )


class OrderItem(Base):
    __tablename__ = "order_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    product_name = Column(String(255), nullable=False)  # Snapshot for order history
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)  # Price snapshot
    discount_percentage = Column(Numeric(5, 2), nullable=False, default=0, server_default="0")  # Discount snapshot
    line_total = Column(Numeric(10, 2), nullable=False)
    
    # Relationships
    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('quantity > 0', name='order_items_quantity_check'),
    )


class PaymentReceipt(Base):
    __tablename__ = "payment_receipts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    s3_path = Column(String(1024), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String(20), nullable=False)  # PNG, JPG, PDF
    uploaded_by_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    uploaded_at = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=func.now())
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, server_default=func.now())
    
    # Relationships
    order = relationship("Order", back_populates="payment_receipt")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])


class OrderAuditLog(Base):
    __tablename__ = "order_audit_log"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    action = Column(String(50), nullable=False)  # CREATED, PAYMENT_UPLOADED, PAYMENT_APPROVED, etc.
    performed_by_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    reason = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=func.now())
    
    # Relationships
    order = relationship("Order", back_populates="audit_logs")
    performed_by = relationship("User", foreign_keys=[performed_by_id])


class Invoice(Base):
    __tablename__ = "invoices"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=func.gen_random_uuid())
    order_id = Column(UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    invoice_number = Column(String(20), nullable=False, unique=True, index=True)  # INV-2025-000001
    invoice_pdf_url = Column(String(1024), nullable=False)  # S3 path to PDF
    total_amount = Column(Numeric(10, 2), nullable=False)
    expires_at = Column(DateTime, nullable=False)  # 7 years from creation for retention policy
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow, server_default=func.now())
    
    # Relationships
    order = relationship("Order", back_populates="invoice")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('total_amount > 0', name='invoices_total_check'),
    )
