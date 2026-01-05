"""CRUD operations for E-Commerce Cart and Orders
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID
import logging

from sqlalchemy import select, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.ecommerce_model import (
    Cart, CartItem, Order, OrderItem, OrderStatus, PaymentReceipt, OrderAuditLog, Product, Invoice
)
from app.models.user_model import User, UserRole
from app.schemas.ecommerce import CartItemCreate, CartItemUpdate, OrderCreate
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)


# Cart CRUD
async def get_or_create_cart(db: AsyncSession, user_id: int) -> Cart:
    """Get user's cart or create if doesn't exist"""
    result = await db.execute(
        select(Cart).where(Cart.user_id == user_id)
    )
    cart = result.scalar_one_or_none()
    
    if not cart:
        cart = Cart(user_id=user_id)
        db.add(cart)
        await db.commit()
        await db.refresh(cart)
    
    return cart


async def get_cart_with_items(db: AsyncSession, user_id: int) -> Optional[Cart]:
    """Get cart with all items and product details"""
    result = await db.execute(
        select(Cart)
        .options(
            selectinload(Cart.items).joinedload(CartItem.product)
        )
        .where(Cart.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def add_to_cart(
    db: AsyncSession, cart_id: UUID, item_data: CartItemCreate
) -> CartItem:
    """Add item to cart or update quantity if already exists"""
    # Check if item already exists in cart
    result = await db.execute(
        select(CartItem).where(
            and_(
                CartItem.cart_id == cart_id,
                CartItem.product_id == item_data.product_id
            )
        )
    )
    existing_item = result.scalar_one_or_none()
    
    # Get product for price snapshot
    product_result = await db.execute(
        select(Product).where(Product.id == item_data.product_id)
    )
    product = product_result.scalar_one_or_none()
    
    if not product:
        raise ValueError("Product not found")
    
    if not product.stock_available:
        raise ValueError("Product out of stock")
    
    if existing_item:
        # Update quantity
        existing_item.quantity += item_data.quantity
        existing_item.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(existing_item)
        return existing_item
    else:
        # Create new cart item with price snapshot
        new_item = CartItem(
            cart_id=cart_id,
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            unit_price=product.price,
            discount_percentage=product.discount_percentage
        )
        db.add(new_item)
        await db.commit()
        await db.refresh(new_item)
        return new_item


async def update_cart_item(
    db: AsyncSession, item_id: UUID, update_data: CartItemUpdate
) -> Optional[CartItem]:
    """Update cart item quantity"""
    result = await db.execute(
        select(CartItem).where(CartItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    
    if not item:
        return None
    
    item.quantity = update_data.quantity
    item.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(item)
    return item


async def remove_from_cart(db: AsyncSession, item_id: UUID) -> bool:
    """Remove item from cart"""
    result = await db.execute(
        select(CartItem).where(CartItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    
    if not item:
        return False
    
    await db.delete(item)
    await db.commit()
    return True


async def clear_cart(db: AsyncSession, cart_id: UUID) -> bool:
    """Clear all items from cart"""
    result = await db.execute(
        select(CartItem).where(CartItem.cart_id == cart_id)
    )
    items = result.scalars().all()
    
    for item in items:
        await db.delete(item)
    
    await db.commit()
    return True


# Order CRUD
async def generate_order_number(db: AsyncSession) -> str:
    """Generate unique order number: ORD-YYYY-XXXXXX using sequential counter"""
    from datetime import datetime
    
    year = datetime.now().year
    
    # Get count of orders created this year to ensure sequential numbering
    result = await db.execute(
        select(Order).where(Order.created_at >= datetime(year, 1, 1))
    )
    orders_this_year = result.scalars().all()
    order_count = len(orders_this_year) + 1
    
    # Format with leading zeros: ORD-2025-000001
    order_number = f"ORD-{year}-{order_count:06d}"
    
    return order_number


async def create_order(
    db: AsyncSession, user_id: int, order_data: OrderCreate, cart_items: List[CartItem]
) -> Order:
    """Create order from cart items"""
    # Calculate totals
    subtotal = sum(item.line_total for item in cart_items)
    discount_total = sum(
        (float(item.unit_price) * item.quantity * float(item.discount_percentage) / 100)
        for item in cart_items
    )
    total_amount = subtotal
    
    # Generate unique order number using sequential counter
    order_number = await generate_order_number(db)
    
    # Create order
    new_order = Order(
        order_number=order_number,
        user_id=user_id,
        customer_email=order_data.email,  # Store email provided during checkout
        status=OrderStatus.CREATED,
        payment_method=order_data.payment_method,
        subtotal=subtotal,
        discount_total=discount_total,
        total_amount=total_amount,
        delivery_address=order_data.delivery_address,
        delivery_city=order_data.delivery_city,
        delivery_pincode=order_data.delivery_pincode
    )
    db.add(new_order)
    await db.flush()
    
    # Create order items from cart items
    for cart_item in cart_items:
        product_result = await db.execute(
            select(Product).where(Product.id == cart_item.product_id)
        )
        product = product_result.scalar_one()
        
        order_item = OrderItem(
            order_id=new_order.id,
            product_id=cart_item.product_id,
            product_name=product.name,
            quantity=cart_item.quantity,
            unit_price=cart_item.unit_price,
            discount_percentage=cart_item.discount_percentage,
            line_total=cart_item.line_total
        )
        db.add(order_item)
        
        # STOCK MANAGEMENT: Decrement product stock by order quantity
        previous_stock = product.stock_quantity
        product.stock_quantity -= cart_item.quantity
        if product.stock_quantity < 0:
            product.stock_quantity = 0
        db.add(product)
        
        # Check if product just went out of stock (transitioned from > 0 to 0)
        if previous_stock > 0 and product.stock_quantity == 0:
            logger.info(f"Product '{product.name}' (ID: {product.id}) has gone out of stock")
            # Trigger out-of-stock notification
            await _send_out_of_stock_alert(db, product, previous_stock)

    
    # Create audit log entry
    audit_log = OrderAuditLog(
        order_id=new_order.id,
        action="CREATED",
        performed_by_id=user_id,
        old_status=None,
        new_status="CREATED"
    )
    db.add(audit_log)
    
    await db.commit()
    await db.refresh(new_order)
    
    # Load with relationships
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == new_order.id)
    )
    return result.scalar_one()


async def get_order_by_id(db: AsyncSession, order_id: UUID) -> Optional[Order]:
    """Get order by ID with all relationships"""
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items),
            joinedload(Order.user),
            joinedload(Order.payment_receipt)
        )
        .where(Order.id == order_id)
    )
    return result.scalar_one_or_none()


async def get_orders_by_user(
    db: AsyncSession, user_id: int, status: Optional[str] = None, page: int = 1, limit: int = 20
) -> tuple[List[Order], int]:
    """Get user's orders with optional status filter"""
    query = select(Order).options(
        selectinload(Order.items),
        joinedload(Order.payment_receipt)
    ).where(Order.user_id == user_id)
    
    if status:
        query = query.where(Order.status == status)
    
    # Count total
    from sqlalchemy import func
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Pagination
    offset = (page - 1) * limit
    query = query.order_by(Order.created_at.desc()).offset(offset).limit(limit)
    
    result = await db.execute(query)
    orders = result.scalars().all()
    
    return orders, total


async def get_orders_for_admin(
    db: AsyncSession, status: Optional[str] = None, page: int = 1, limit: int = 20
) -> tuple[List[Order], int]:
    """Get all orders for admin with optional status filter"""
    from sqlalchemy import func
    
    # Count total first without eager loading
    count_query = select(func.count()).select_from(Order)
    if status:
        count_query = count_query.where(Order.status == status)
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Query for orders with eager loading using selectinload for all relationships
    query = select(Order).options(
        selectinload(Order.items),
        selectinload(Order.user),
        selectinload(Order.payment_receipt)
    )
    
    if status:
        query = query.where(Order.status == status)
    
    # Pagination
    offset = (page - 1) * limit
    query = query.order_by(Order.created_at.desc()).offset(offset).limit(limit)
    
    result = await db.execute(query)
    orders = result.scalars().unique().all()
    
    return orders, total


async def update_order_status(
    db: AsyncSession, order_id: UUID, new_status: OrderStatus, admin_id: int, reason: Optional[str] = None
) -> Optional[Order]:
    """Update order status and create audit log"""
    order = await get_order_by_id(db, order_id)
    if not order:
        return None
    
    old_status = order.status.value if isinstance(order.status, OrderStatus) else order.status
    order.status = new_status
    
    # Update approval/rejection fields
    if new_status == OrderStatus.PAYMENT_APPROVED:
        order.approved_by_id = admin_id
        order.approved_at = datetime.utcnow()
    elif new_status == OrderStatus.PAYMENT_REJECTED:
        order.rejected_by_id = admin_id
        order.rejected_at = datetime.utcnow()
        if reason:
            order.rejection_reason = reason
    
    # Create audit log
    audit_log = OrderAuditLog(
        order_id=order_id,
        action=new_status.value,
        performed_by_id=admin_id,
        old_status=old_status,
        new_status=new_status.value,
        reason=reason
    )
    db.add(audit_log)
    
    await db.commit()
    await db.refresh(order)
    return order


# Payment Receipt CRUD
async def create_payment_receipt(
    db: AsyncSession, order_id: UUID, s3_path: str, file_name: str, 
    file_size: int, file_type: str, user_id: int
) -> PaymentReceipt:
    """Upload payment receipt for order"""
    receipt = PaymentReceipt(
        order_id=order_id,
        s3_path=s3_path,
        file_name=file_name,
        file_size=file_size,
        file_type=file_type,
        uploaded_by_id=user_id
    )
    db.add(receipt)
    
    # Update order status
    order_result = await db.execute(
        select(Order).where(Order.id == order_id)
    )
    order = order_result.scalar_one()
    order.status = OrderStatus.PAYMENT_UPLOADED
    
    # Create audit log
    audit_log = OrderAuditLog(
        order_id=order_id,
        action="PAYMENT_UPLOADED",
        performed_by_id=user_id,
        old_status="CREATED",
        new_status="PAYMENT_UPLOADED"
    )
    db.add(audit_log)
    
    await db.commit()
    await db.refresh(receipt)
    return receipt


async def get_receipt_by_order(db: AsyncSession, order_id: UUID) -> Optional[PaymentReceipt]:
    """Get payment receipt for order"""
    result = await db.execute(
        select(PaymentReceipt).where(PaymentReceipt.order_id == order_id)
    )
    return result.scalar_one_or_none()


# Audit Log CRUD
async def get_order_audit_logs(db: AsyncSession, order_id: UUID) -> List[OrderAuditLog]:
    """Get all audit logs for an order"""
    result = await db.execute(
        select(OrderAuditLog)
        .options(joinedload(OrderAuditLog.performed_by))
        .where(OrderAuditLog.order_id == order_id)
        .order_by(OrderAuditLog.created_at.asc())
    )
    return result.scalars().all()


# Invoice CRUD
async def create_invoice(
    db: AsyncSession,
    order_id: UUID,
    invoice_number: str,
    invoice_pdf_url: str,
    total_amount: float,
    expires_at: datetime
) -> Invoice:
    """Create invoice record for an order"""
    invoice = Invoice(
        order_id=order_id,
        invoice_number=invoice_number,
        invoice_pdf_url=invoice_pdf_url,
        total_amount=total_amount,
        expires_at=expires_at
    )
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    return invoice


async def get_invoice_by_order(db: AsyncSession, order_id: UUID) -> Optional[Invoice]:
    """Get invoice for an order"""
    result = await db.execute(
        select(Invoice).where(Invoice.order_id == order_id)
    )
    return result.scalar_one_or_none()


async def get_invoice_by_number(db: AsyncSession, invoice_number: str) -> Optional[Invoice]:
    """Get invoice by invoice number"""
    result = await db.execute(
        select(Invoice).where(Invoice.invoice_number == invoice_number)
    )
    return result.scalar_one_or_none()


# Helper function to send out-of-stock notifications to admin
async def _send_out_of_stock_alert(
    db: AsyncSession, product: Product, previous_stock: int
) -> None:
    """
    Send out-of-stock notification email to all admin users
    
    Args:
        db: Database session
        product: Product that has gone out of stock
        previous_stock: Stock quantity before the last order
    """
    try:
        # Fetch all admin users
        result = await db.execute(
            select(User).where(User.role == UserRole.ADMIN, User.is_active == True)
        )
        admins = result.scalars().all()
        
        if not admins:
            logger.warning("No admin users found to send out-of-stock notification")
            return
        
        # Send email to each admin
        for admin in admins:
            if admin.email:
                try:
                    success = await EmailService.send_out_of_stock_notification(
                        admin_email=admin.email,
                        admin_name=admin.name,
                        product_name=product.name,
                        product_id=str(product.id),
                        previous_stock=previous_stock,
                        current_stock=product.stock_quantity,
                    )
                    
                    if success:
                        logger.info(
                            f"✓ Out-of-stock notification sent to admin {admin.name} ({admin.email}) "
                            f"for product '{product.name}'"
                        )
                    else:
                        logger.warning(
                            f"✗ Failed to send out-of-stock notification to admin {admin.name} ({admin.email})"
                        )
                except Exception as e:
                    logger.error(
                        f"✗ Error sending out-of-stock notification to admin {admin.name}: {str(e)}"
                    )
            else:
                logger.warning(f"Admin {admin.name} has no email address configured")
                
    except Exception as e:
        logger.error(f"✗ Error fetching admins for out-of-stock notification: {str(e)}")


async def get_max_invoice_sequence(db: AsyncSession, year: int) -> int:
    """
    Get max sequence number for invoices in a given year.
    
    Invoice format: INV-YYYY-XXXXXX where XXXXXX is the 6-digit sequence
    Returns the highest sequence number, defaulting to 0 if none exist
    """
    # Query all invoices for the current year
    result = await db.execute(
        select(Invoice.invoice_number).where(
            extract('year', Invoice.created_at) == year
        ).order_by(Invoice.created_at.desc())
    )
    
    invoice_numbers = result.scalars().all()
    
    max_sequence = 0
    
    # Parse invoice numbers to extract sequence (format: INV-YYYY-XXXXXX)
    for inv_num in invoice_numbers:
        try:
            # Invoice number format: INV-2025-000001
            parts = inv_num.split('-')
            if len(parts) == 3:
                sequence = int(parts[2])
                if sequence > max_sequence:
                    max_sequence = sequence
        except (ValueError, IndexError):
            # If parsing fails, continue to next
            continue
    
    return max_sequence
