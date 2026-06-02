"""API endpoints for E-Commerce Orders and Payments
"""
import hashlib
import json
import logging
import secrets
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_current_admin, get_db, get_current_user_optional
from app.core.config import settings
from app.crud import ecommerce_crud, vendor_crud
from app.models.user_model import User
from app.models.ecommerce_model import OrderStatus
from app.schemas.ecommerce import (
    OrderCreate, OrderResponse, OrderCreateResponse, OrderListResponse,
    PaymentReceiptResponse, OrderApprove, OrderReject, OrderApprovalResponse,
    OrderWithUserResponse, OrderAuditLogList, AdminOrderListResponse
)
from app.utils.s3_utils import convert_s3_url_to_proxy, s3_key_to_proxy
from app.utils.file_handler import upload_file
from app.services.email_service import EmailService
from app.services.cache_service import cache_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/orders", tags=["Orders"])


def get_public_url(file_path: Optional[str]) -> Optional[str]:
    """Convert S3 key or path to permanent backend proxy URL"""
    if not file_path:
        return None
    if file_path.startswith("http"):
        return file_path
    if settings.USE_S3:
        if file_path.startswith("s3://"):
            return convert_s3_url_to_proxy(file_path)
        return s3_key_to_proxy(file_path)
    return file_path


def _build_order_response(order) -> dict:
    """Helper function to build order response dict"""
    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "status": order.status.value if isinstance(order.status, OrderStatus) else order.status,
        "user_id": order.user_id,
        "user_name": order.user.name if order.user else "Unknown",
        "user_email": order.customer_email or (order.user.email if order.user else None),
        "payment_method": order.payment_method.value if hasattr(order.payment_method, 'value') else order.payment_method,
        "subtotal": order.subtotal,
        "discount_total": order.discount_total,
        "total_amount": order.total_amount,
        "delivery_address": order.delivery_address,
        "delivery_city": order.delivery_city,
        "delivery_pincode": order.delivery_pincode,
        "rejection_reason": order.rejection_reason,
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product_name,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "discount_percentage": item.discount_percentage,
                "line_total": item.line_total
            }
            for item in order.items
        ],
        "created_at": order.created_at,
        "updated_at": order.updated_at
    }


@router.post("/checkout", response_model=OrderCreateResponse, status_code=status.HTTP_201_CREATED)
async def checkout(
    order_data: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Create order from cart (checkout) - supports both registered and guest users"""
    is_guest = current_user is None
    current_user_id = current_user.id if current_user else None
    current_user_email = current_user.email if current_user else None
    current_user_name = current_user.name if current_user else None

    # Validate required fields based on user type
    if is_guest:
        # Guest user must provide name, email, and contact_number
        if not order_data.name or not order_data.email or not order_data.contact_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name, email, and contact number are required for guest checkout"
            )
    else:
        # Registered user - email is optional, will use account email if not provided
        if not order_data.email:
            order_data.email = current_user_email

    # Get cart items based on user type
    if is_guest:
        # Guest users: accept items from request payload
        if not order_data.items or len(order_data.items) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cart cannot be empty. Please add items before checkout."
            )
        
        # Fetch product details and build cart items
        from collections import namedtuple
        from app.models.ecommerce_model import Product
        from sqlalchemy import select
        
        GuestCartItem = namedtuple('GuestCartItem', ['product_id', 'quantity', 'unit_price', 'discount_percentage', 'line_total'])
        
        cart_items = []
        for guest_item in order_data.items:
            # Fetch product from database
            product_result = await db.execute(
                select(Product).where(Product.id == UUID(guest_item.product_id))
            )
            product = product_result.scalar_one_or_none()
            
            if not product:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product not found: {guest_item.product_id}"
                )
            if not product.stock_available:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Product '{product.name}' is out of stock"
                )
            if product.stock_quantity < guest_item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Insufficient stock for '{product.name}'. Only {product.stock_quantity} available."
                )
            
            # Build cart item with product details
            unit_price = product.price
            discount_percentage = product.discount_percentage
            line_total = float(unit_price * guest_item.quantity)
            
            cart_item = GuestCartItem(
                product_id=UUID(guest_item.product_id),
                quantity=guest_item.quantity,
                unit_price=unit_price,
                discount_percentage=discount_percentage,
                line_total=line_total
            )
            cart_items.append(cart_item)
        cart = None  # No database cart for guests
    else:
        # Registered users: get cart from database
        cart = await ecommerce_crud.get_cart_with_items(db, current_user_id)
        
        if not cart or not cart.items:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty")
        
        # Verify stock availability for all items
        for item in cart.items:
            if not item.product.stock_available:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Product '{item.product.name}' is out of stock"
                )
            if item.product.stock_quantity < item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Insufficient stock for '{item.product.name}'. Only {item.product.stock_quantity} available."
                )
        cart_items = cart.items
    
    try:
        # Create order
        order, created_items_response = await ecommerce_crud.create_order(db, current_user_id, order_data, cart_items)
        
        # For guest users, store their information and generate guest token
        if is_guest:
            guest_token = secrets.token_urlsafe(48)
            order.customer_name = order_data.name
            order.customer_email = order_data.email
            order.customer_contact_number = order_data.contact_number
            order.guest_token = guest_token
            await db.commit()
            await db.refresh(order)
        
        # Clear cart after order creation
        if cart:
            await ecommerce_crud.clear_cart(db, cart.id)
        
        # Generate payment details based on method
        payment_details = {}
        if order_data.payment_method == "UPI_QR":
            # TODO: Generate or retrieve UPI QR code URL
            payment_details = {
                "upi_qr_url": f"{settings.FRONTEND_URL}/payment/qr/{order.order_number}",
                "merchant_upi": "hurshbintech@upi"
            }
        elif order_data.payment_method == "BANK_TRANSFER":
            payment_details = {
                "bank_name": "HDFC Bank",
                "account_number": "50200034124439",
                "ifsc_code": "HDFC0000538",
                "account_holder": "HurshBin"
            }
        
        # Send order created email with order details and payment instructions
        recipient_email = order_data.email
        recipient_name = order_data.name if is_guest else current_user_name
        
        user_type = "Guest" if is_guest else f"User {current_user_id}"
        logger.info(f"Checkout: Order created {order.order_number} for {user_type}")
        logger.info(f"Checkout: Email being sent to - {recipient_email}, Name - {recipient_name}")
        
        # Validate email before sending
        if not recipient_email:
            logger.error(f"Checkout: No email found. is_guest={is_guest}, order_data.email={order_data.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required for checkout. Please provide an email address."
            )
        
        # Prepare items for email
        order_items = [
            {
                "product_name": item["product_name"],
                "quantity": item["quantity"],
                "unit_price": float(item["unit_price"]),
                "line_total": float(item["line_total"]),
                "discount_percentage": item["discount_percentage"]
            }
            for item in created_items_response
        ]
        
        # Generate tracking link
        tracking_link = f"{settings.FRONTEND_URL}/order/track/{order.guest_token if is_guest else order.order_number}"
        
        await EmailService.send_order_created(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            order_number=order.order_number,
            order_items=order_items,
            subtotal=float(order.subtotal),
            discount=float(order.discount_total),
            total=float(order.total_amount),
            delivery_address=f"{order.delivery_address}, {order.delivery_city} - {order.delivery_pincode}",
            payment_method=order_data.payment_method,
            upi_details=payment_details if order_data.payment_method == "UPI_QR" else None,
            bank_details=payment_details if order_data.payment_method == "BANK_TRANSFER" else None,
            tracking_link=tracking_link
        )
        
        logger.info(f"Checkout: Order confirmation email sent successfully to {recipient_email}")
        
        # Build response
        items_response = created_items_response
        
        return {
            "order_id": order.id,
            "order_number": order.order_number,
            "status": order.status.value if isinstance(order.status, OrderStatus) else order.status,
            "total_amount": order.total_amount,
            "payment_method": order.payment_method.value if hasattr(order.payment_method, 'value') else order.payment_method,
            "payment_details": payment_details,
            "items": items_response,
            "delivery_address": order.delivery_address,
            "created_at": order.created_at,
            "guest_token": order.guest_token if is_guest else None
        }
    except Exception as e:
        await db.rollback()
        error_msg = f"Checkout: Error creating order"
        if current_user_id:
            error_msg += f" for user {current_user_id}"
        error_msg += f": {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create order: {str(e)}"
        )


@router.get("/track/{tracking_id}")
async def track_order(
    tracking_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Track order by order_number or guest_token
    Public endpoint - no authentication required
    """
    try:
        # Try to find order by order_number or guest_token
        order = await ecommerce_crud.get_order_by_tracking_id(db, tracking_id)
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found. Please check your tracking ID."
            )
        
        # Build response with order details
        items_response = [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product_name,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "discount_percentage": item.discount_percentage,
                "line_total": item.line_total
            }
            for item in order.items
        ]
        
        return {
            "order_id": str(order.id),
            "order_number": order.order_number,
            "status": order.status.value if isinstance(order.status, OrderStatus) else order.status,
            "payment_method": order.payment_method.value if hasattr(order.payment_method, 'value') else order.payment_method,
            "subtotal": float(order.subtotal),
            "discount_total": float(order.discount_total),
            "total_amount": float(order.total_amount),
            "delivery_address": order.delivery_address,
            "delivery_city": order.delivery_city,
            "delivery_pincode": order.delivery_pincode,
            "rejection_reason": order.rejection_reason,
            "items": items_response,
            "created_at": order.created_at
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error tracking order with ID {tracking_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve order details"
        )


async def get_orders(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's orders with optional status filter"""
    # Try cache first
    filters_data = {"user_id": current_user.id, "status": status, "page": page, "limit": limit}
    filters_hash = hashlib.md5(json.dumps(filters_data, sort_keys=True).encode()).hexdigest()
    cache_key = f"orders:list:{filters_hash}"

    cached_data = await cache_service.get(cache_key)
    if cached_data:
        logger.debug(f"Cache HIT: {cache_key}")
        return OrderListResponse(**cached_data)

    logger.debug(f"Cache MISS: {cache_key}")
    orders, total = await ecommerce_crud.get_orders_by_user(db, current_user.id, status, page, limit)

    total_pages = (total + limit - 1) // limit

    orders_response = [
        {
            "order_id": order.id,
            "order_number": order.order_number,
            "status": order.status.value if isinstance(order.status, OrderStatus) else order.status,
            "user_id": order.user_id,
            "payment_method": order.payment_method.value if hasattr(order.payment_method, 'value') else order.payment_method,
            "subtotal": order.subtotal,
            "discount_total": order.discount_total,
            "total_amount": order.total_amount,
            "delivery_address": order.delivery_address,
            "delivery_city": order.delivery_city,
            "delivery_pincode": order.delivery_pincode,
            "rejection_reason": order.rejection_reason,
            "items": [
                {
                    "id": item.id,
                    "product_id": item.product_id,
                    "product_name": item.product_name,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "discount_percentage": item.discount_percentage,
                    "line_total": item.line_total
                }
                for item in order.items
            ],
            "created_at": order.created_at,
            "updated_at": order.updated_at
        }
        for order in orders
    ]

    response = {
        "orders": orders_response,
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": total_pages
        }
    }

    # Cache for 10 minutes
    await cache_service.set(cache_key, response, ttl=cache_service.TTL_ORDER)

    return response


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get order details"""
    # Try cache first
    cache_key = f"order:detail:{order_id}:{current_user.id}"
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        logger.debug(f"Cache HIT: {cache_key}")
        return OrderResponse(**cached_data)

    logger.debug(f"Cache MISS: {cache_key}")
    order = await ecommerce_crud.get_order_by_id(db, order_id)

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    # Verify order belongs to user
    if order.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    response = {
        "order_id": order.id,
        "order_number": order.order_number,
        "status": order.status.value if isinstance(order.status, OrderStatus) else order.status,
        "user_id": order.user_id,
        "payment_method": order.payment_method.value if hasattr(order.payment_method, 'value') else order.payment_method,
        "subtotal": order.subtotal,
        "discount_total": order.discount_total,
        "total_amount": order.total_amount,
        "delivery_address": order.delivery_address,
        "delivery_city": order.delivery_city,
        "delivery_pincode": order.delivery_pincode,
        "rejection_reason": order.rejection_reason,
        "items": [
            {
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product_name,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "discount_percentage": item.discount_percentage,
                "line_total": item.line_total
            }
            for item in order.items
        ],
        "created_at": order.created_at,
        "updated_at": order.updated_at
    }

    # Cache for 10 minutes
    await cache_service.set(cache_key, response, ttl=cache_service.TTL_ORDER)

    return response


@router.post("/{order_id}/payment-receipt", response_model=PaymentReceiptResponse, status_code=status.HTTP_201_CREATED)
async def upload_payment_receipt(
    order_id: UUID,
    receipt: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
    guest_token: Optional[str] = Query(None)
):
    """Upload payment receipt for order"""
    # Verify order exists and belongs to user
    order = await ecommerce_crud.get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    if order.user_id is None:
        if not guest_token or order.guest_token != guest_token:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")
    else:
        if not current_user or order.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")
    
    # Verify order status is CREATED or PAYMENT_REJECTED (for reupload)
    if order.status not in [OrderStatus.CREATED, OrderStatus.PAYMENT_REJECTED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot upload receipt for order in {order.status.value} status"
        )
    
    # Check if receipt already exists (only for initial upload)
    existing_receipt = await ecommerce_crud.get_receipt_by_order(db, order_id)
    if existing_receipt and order.status == OrderStatus.CREATED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment receipt already uploaded for this order"
        )
    
    # For rejected orders, delete old receipt to allow reupload
    if existing_receipt and order.status == OrderStatus.PAYMENT_REJECTED:
        await db.delete(existing_receipt)
        await db.commit()
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    if receipt.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only JPG, PNG, and PDF are allowed."
        )
    
    # Validate file size (max 5MB)
    contents = await receipt.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds 5MB limit."
        )
    
    # Upload to S3 (production) or local storage (development)
    try:
        s3_path = await upload_file(
            file_content=contents,
            folder=f"receipts/{order_id}",
            filename=receipt.filename,
            content_type=receipt.content_type
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to upload receipt: {str(e)}"
        )
    
    # Determine file type
    file_type = "PDF" if receipt.content_type == "application/pdf" else "JPG"
    
    # Create payment receipt record
    try:
        payment_receipt = await ecommerce_crud.create_payment_receipt(
            db, order_id, s3_path, receipt.filename, len(contents), file_type, current_user.id if current_user else None
        )
        
        # Update order status to PAYMENT_UPLOADED and clear rejection reason if it was rejected
        if order.status == OrderStatus.PAYMENT_REJECTED:
            order.status = OrderStatus.PAYMENT_UPLOADED
            order.rejection_reason = None  # Clear the rejection reason
            await db.commit()
            print(f"✅ Order {order_id} status updated from PAYMENT_REJECTED to PAYMENT_UPLOADED")
        
        # Convert S3 path to public URL
        public_url = get_public_url(payment_receipt.s3_path)
        
        return {
            "receipt_id": payment_receipt.id,
            "order_id": payment_receipt.order_id,
            "s3_path": public_url,
            "file_name": payment_receipt.file_name,
            "file_size": payment_receipt.file_size,
            "file_type": payment_receipt.file_type,
            "uploaded_at": payment_receipt.uploaded_at
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload receipt: {str(e)}"
        )


# Admin endpoints
@router.get("/admin/orders", response_model=AdminOrderListResponse)
async def get_admin_orders(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get all orders for admin review (Admin only). If status is None, returns all orders."""
    orders, total = await ecommerce_crud.get_orders_for_admin(db, status, page, limit)
    
    total_pages = (total + limit - 1) // limit
    
    # Build response with user details
    orders_response = []
    for order in orders:
        # Convert S3 URL to public URL if present
        payment_receipt_dict = None
        if order.payment_receipt:
            payment_receipt_dict = {
                "id": order.payment_receipt.id,
                "s3_path": get_public_url(order.payment_receipt.s3_path),
                "file_name": order.payment_receipt.file_name,
                "file_type": order.payment_receipt.file_type,
                "file_size": order.payment_receipt.file_size,
                "uploaded_at": order.payment_receipt.uploaded_at
            }
            logger.info(f"Payment receipt for order {order.order_number}: {payment_receipt_dict['s3_path']}")
        
        order_dict = {
            "order_id": order.id,
            "order_number": order.order_number,
            "status": order.status.value if isinstance(order.status, OrderStatus) else order.status,
            "user_id": order.user_id,
            "user_name": order.user.name if order.user else order.customer_name or "Unknown",
            "user_email": order.customer_email or (order.user.email if order.user else None),
            "customer_name": order.customer_name,
            "customer_contact_number": order.customer_contact_number,
            "guest_token": order.guest_token,
            "payment_method": order.payment_method.value if hasattr(order.payment_method, 'value') else order.payment_method,
            "subtotal": order.subtotal,
            "discount_total": order.discount_total,
            "total_amount": order.total_amount,
            "delivery_address": order.delivery_address,
            "delivery_city": order.delivery_city,
            "delivery_pincode": order.delivery_pincode,
            "rejection_reason": order.rejection_reason,
            "items": [
                {
                    "id": item.id,
                    "product_id": item.product_id,
                    "product_name": item.product_name,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "discount_percentage": item.discount_percentage,
                    "line_total": item.line_total
                }
                for item in order.items
            ],
            "payment_receipt": payment_receipt_dict,
            "created_at": order.created_at,
            "updated_at": order.updated_at
        }
        orders_response.append(order_dict)
    
    return {
        "orders": orders_response,
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": total_pages
        }
    }


@router.post("/admin/orders/{order_id}/approve", response_model=OrderApprovalResponse)
async def approve_payment(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Approve payment for order (Admin only)"""
    order = await ecommerce_crud.get_order_by_id(db, order_id)
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    
    if order.status != OrderStatus.PAYMENT_UPLOADED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve order in {order.status.value} status"
        )
    
    # CRITICAL: Validate receipt exists before approval
    if not order.payment_receipt or not order.payment_receipt.s3_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment receipt not uploaded. Cannot verify payment without receipt review."
        )
    
    # Check if invoice already exists (idempotency)
    existing_invoice = await ecommerce_crud.get_invoice_by_order(db, order_id)
    if existing_invoice:
        logger.info(f"Invoice already exists for order {order_id}. Returning existing invoice.")
        # Return success without re-sending email (idempotent)
        await db.refresh(order, ['user', 'items', 'invoice'])
        
        return {
            "message": "Payment already approved",
            "order": _build_order_response(order),
            "invoice": {
                "invoice_number": existing_invoice.invoice_number,
                "invoice_pdf_url": existing_invoice.invoice_pdf_url,
                "created_at": existing_invoice.created_at
            }
        }
    
    try:
        # Generate invoice
        from app.services.invoice_service import InvoiceGenerator
        from datetime import timedelta
        
        generator = InvoiceGenerator()
        invoice_number = None
        s3_path = None
        invoice = None
        invoice_number = None
        
        try:
            # Generate invoice number: INV-{YEAR}-{SEQUENCE}
            year = datetime.utcnow().year
            sequence = await ecommerce_crud.get_max_invoice_sequence(db, year)
            invoice_number = f"INV-{year}-{sequence + 1:06d}"
            
            # Generate PDF and upload to S3 (s3_path is set here)
            pdf_bytes, s3_path = generator.generate_invoice_pdf(
                order_id=str(order.id),
                order_number=order.order_number,
                invoice_number=invoice_number,
                customer_name=order.user.name if order.user else "Customer",
                customer_email=order.customer_email or (order.user.email if order.user else ""),
                delivery_address=order.delivery_address,
                delivery_city=order.delivery_city or "",
                delivery_pincode=order.delivery_pincode or "",
                order_items=[
                    {
                        "product_name": item.product_name,
                        "quantity": item.quantity,
                        "unit_price": item.unit_price,
                        "line_total": item.line_total
                    }
                    for item in order.items
                ],
                subtotal=order.subtotal,
                discount_total=order.discount_total,
                total_amount=order.total_amount,
                created_at=order.created_at
            )
            
            # Create invoice record
            expires_at = datetime.utcnow() + timedelta(days=365*7)  # 7 year retention
            invoice = await ecommerce_crud.create_invoice(
                db=db,
                order_id=order_id,
                invoice_number=invoice_number,
                invoice_pdf_url=s3_path,
                total_amount=float(order.total_amount),
                expires_at=expires_at
            )
            logger.info(f"Invoice generated successfully: {invoice_number}")
        except Exception as invoice_error:
            logger.warning(f"Could not generate invoice due to S3 issue: {str(invoice_error)}. Order approval will proceed without invoice.")
            # Allow order approval to continue even if invoice generation fails
            # This is important for local development where S3 credentials may not be configured
        
        # Update order status to PAYMENT_APPROVED
        updated_order = await ecommerce_crud.update_order_status(
            db, order_id, OrderStatus.PAYMENT_APPROVED, current_admin.id
        )
        
        # Refresh to get updated relationships
        await db.refresh(updated_order, ['user', 'items', 'invoice'])
        
        # Get recipient email - prioritize stored customer_email from checkout
        recipient_email = updated_order.customer_email or (updated_order.user.email if updated_order.user else None)
        recipient_name = updated_order.user.name if updated_order.user else "Customer"
        
        logger.info(f"Order {order_id} approved" + (f" with invoice {invoice_number}" if invoice_number else " (invoice generation skipped)") + f". Sending approval email to {recipient_email}")
        
        # Send confirmation email with invoice PDF attached (if available)
        if recipient_email and recipient_name and invoice_number:
            try:
                await EmailService.send_order_confirmation(
                    recipient_email=recipient_email,
                    recipient_name=recipient_name,
                    order_number=updated_order.order_number,
                    order_items=[
                        {
                            "product_name": item.product_name,
                            "quantity": item.quantity,
                            "unit_price": float(item.unit_price),
                            "line_total": float(item.line_total)
                        }
                        for item in updated_order.items
                    ],
                    subtotal=float(updated_order.subtotal),
                    discount=float(updated_order.discount_total),
                    total=float(updated_order.total_amount),
                    delivery_address=updated_order.delivery_address,
                    invoice_number=invoice_number,
                    invoice_pdf_url=s3_path
                )
                logger.info(f"✓ Approval confirmation email with invoice sent to {recipient_email}")
            except Exception as email_error:
                logger.error(f"✗ Failed to send approval email: {str(email_error)}")
        elif recipient_email and recipient_name:
            # Send email without invoice if invoice generation failed
            logger.info(f"Sending approval email without invoice to {recipient_email}")
        else:
            logger.error(f"Order {order_id}: Cannot send email - no recipient email found. customer_email: {updated_order.customer_email}, user.email: {updated_order.user.email if updated_order.user else 'NO USER'}")
        
        return {
            "message": "Payment approved",
            "order": _build_order_response(updated_order),
            "invoice": {
                "invoice_number": invoice.invoice_number,
                "invoice_pdf_url": invoice.invoice_pdf_url,
                "created_at": invoice.created_at
            } if invoice else None
        }
    except Exception as e:
        logger.error(f"Error approving payment for order {order_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve payment: {str(e)}"
        )


@router.post("/admin/orders/{order_id}/reject", response_model=OrderApprovalResponse)
async def reject_payment(
    order_id: UUID,
    reject_data: OrderReject,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Reject payment for order (Admin only)"""
    order = await ecommerce_crud.get_order_by_id(db, order_id)
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    
    if order.status != OrderStatus.PAYMENT_UPLOADED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject order in {order.status.value} status"
        )
    
    try:
        updated_order = await ecommerce_crud.update_order_status(
            db, order_id, OrderStatus.PAYMENT_REJECTED, current_admin.id, reject_data.reason
        )
        
        # Refresh to get updated relationships
        await db.refresh(updated_order, ['user', 'items'])
        
        # Get recipient email - prioritize stored customer_email from checkout
        recipient_email = updated_order.customer_email or (updated_order.user.email if updated_order.user else None)
        recipient_name = updated_order.user.name if updated_order.user else "Customer"
        
        logger.info(f"Order {order_id} rejected. Sending rejection email to {recipient_email}")
        
        # Send rejection email
        if recipient_email and recipient_name:
            try:
                await EmailService.send_order_rejection(
                    recipient_email=recipient_email,
                    recipient_name=recipient_name,
                    order_number=updated_order.order_number,
                    rejection_reason=reject_data.reason,
                    order_id=str(order_id)
                )
                logger.info(f"✓ Rejection email sent to {recipient_email}")
            except Exception as email_error:
                logger.error(f"✗ Failed to send rejection email: {str(email_error)}")
        else:
            logger.error(f"Order {order_id}: Cannot send rejection email - no recipient email found")
        
        return {
            "message": "Payment rejected",
            "order": {
                "order_id": updated_order.id,
                "order_number": updated_order.order_number,
                "status": updated_order.status.value if isinstance(updated_order.status, OrderStatus) else updated_order.status,
                "user_id": updated_order.user_id,
                "payment_method": updated_order.payment_method.value if hasattr(updated_order.payment_method, 'value') else updated_order.payment_method,
                "subtotal": updated_order.subtotal,
                "discount_total": updated_order.discount_total,
                "total_amount": updated_order.total_amount,
                "delivery_address": updated_order.delivery_address,
                "delivery_city": updated_order.delivery_city,
                "delivery_pincode": updated_order.delivery_pincode,
                "rejection_reason": updated_order.rejection_reason,
                "items": [
                    {
                        "id": item.id,
                        "product_id": item.product_id,
                        "product_name": item.product_name,
                        "quantity": item.quantity,
                        "unit_price": item.unit_price,
                        "discount_percentage": item.discount_percentage,
                        "line_total": item.line_total
                    }
                    for item in updated_order.items
                ],
                "created_at": updated_order.created_at,
                "updated_at": updated_order.updated_at
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reject payment: {str(e)}"
        )


@router.get("/admin/orders/{order_id}/audit-log", response_model=OrderAuditLogList)
async def get_order_audit_log(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get audit log for an order (Admin only)"""
    order = await ecommerce_crud.get_order_by_id(db, order_id)
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    
    logs = await ecommerce_crud.get_order_audit_logs(db, order_id)
    
    logs_response = [
        {
            "id": log.id,
            "action": log.action,
            "performed_by_name": log.performed_by.name if log.performed_by else "System",
            "old_status": log.old_status,
            "new_status": log.new_status,
            "reason": log.reason,
            "created_at": log.created_at
        }
        for log in logs
    ]
    
    return {"logs": logs_response}


# Invoice Download Endpoints

@router.get("/invoice/{order_id}")
async def download_invoice(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download invoice PDF for an order (User must own the order)"""
    order = await ecommerce_crud.get_order_by_id(db, order_id)
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    
    # Verify user owns this order
    if order.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    
    # Get invoice
    invoice = await ecommerce_crud.get_invoice_by_order(db, order_id)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not available yet. Order may not be approved."
        )
    
    try:
        # Generate S3 signed URL for direct download
        import boto3
        import os
        from botocore.exceptions import ClientError
        
        s3_client = boto3.client(
            "s3",
            region_name=os.getenv("AWS_REGION", "ap-south-1"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            endpoint_url=os.getenv("S3_ENDPOINT_URL"),
        )
        
        # Generate presigned URL valid for 1 hour
        signed_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': settings.S3_BUCKET_NAME,
                'Key': invoice.invoice_pdf_url
            },
            ExpiresIn=3600  # 1 hour
        )
        
        logger.info(f"Invoice download link generated for order {order_id} by user {current_user.id}")
        
        return {
            "invoice_number": invoice.invoice_number,
            "download_url": signed_url,
            "expires_in_seconds": 3600,
            "created_at": invoice.created_at
        }
    
    except Exception as e:
        logger.error(f"Error generating invoice download link: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate download link"
        )


@router.get("/admin/invoice/{order_id}")
async def download_invoice_admin(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Download invoice PDF for an order (Admin only)"""
    order = await ecommerce_crud.get_order_by_id(db, order_id)
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    
    # Get invoice
    invoice = await ecommerce_crud.get_invoice_by_order(db, order_id)
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not available for this order"
        )
    
    try:
        # Generate S3 signed URL for direct download
        import boto3
        import os
        from botocore.exceptions import ClientError
        
        s3_client = boto3.client(
            "s3",
            region_name=os.getenv("AWS_REGION", "ap-south-1"),
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            endpoint_url=os.getenv("S3_ENDPOINT_URL"),
        )
        
        # Generate presigned URL valid for 1 hour
        signed_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': settings.S3_BUCKET_NAME,
                'Key': invoice.invoice_pdf_url
            },
            ExpiresIn=3600  # 1 hour
        )
        
        logger.info(f"Invoice download link generated for order {order_id} by admin {current_admin.id}")
        
        return {
            "invoice_number": invoice.invoice_number,
            "download_url": signed_url,
            "expires_in_seconds": 3600,
            "created_at": invoice.created_at
        }
    
    except Exception as e:
        logger.error(f"Error generating invoice download link: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate download link"
        )


@router.post("/admin/orders/{order_id}/mark-delivered", response_model=OrderApprovalResponse)
async def mark_order_delivered(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Mark order as delivered and send delivery email (Admin only)"""
    order = await ecommerce_crud.get_order_by_id(db, order_id)
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    
    if order.status != OrderStatus.PAYMENT_APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot mark order as delivered in {order.status.value} status. Only approved orders can be marked as delivered."
        )
    
    try:
        # Update order status to DELIVERED
        updated_order = await ecommerce_crud.update_order_status(
            db, order_id, OrderStatus.DELIVERED, current_admin.id
        )
        
        # Refresh to get updated relationships
        await db.refresh(updated_order, ['user', 'items'])
        
        # Get recipient email - prioritize stored customer_email from checkout
        recipient_email = updated_order.customer_email or (updated_order.user.email if updated_order.user else None)
        recipient_name = updated_order.user.name if updated_order.user else "Customer"
        delivery_address = updated_order.delivery_address or "Your delivery address"
        
        logger.info(f"Order {order_id} marked as delivered. Sending delivery email to {recipient_email}")
        
        # Send delivery email
        if recipient_email and recipient_name:
            try:
                await EmailService.send_order_delivered(
                    recipient_email=recipient_email,
                    recipient_name=recipient_name,
                    order_number=updated_order.order_number,
                    delivery_address=delivery_address
                )
                logger.info(f"✓ Delivery email sent to {recipient_email}")
            except Exception as email_error:
                logger.error(f"✗ Failed to send delivery email: {str(email_error)}")
                # Continue anyway - order is marked as delivered even if email fails
        else:
            logger.error(f"Order {order_id}: Cannot send delivery email - no recipient email found")
        
        return {
            "message": "Order marked as delivered",
            "order": _build_order_response(updated_order)
        }
    except Exception as e:
        logger.error(f"Error marking order as delivered: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark order as delivered: {str(e)}"
        )


# ============================================================
# SEND ORDER ITEMS TO VENDORS VIA EMAIL
# ============================================================

class VendorItemAssignment(BaseModel):
    item_id: UUID
    vendor_id: int


class SendToVendorsRequest(BaseModel):
    assignments: List[VendorItemAssignment]


@router.post("/admin/orders/{order_id}/send-to-vendors")
async def send_order_to_vendors(
    order_id: UUID,
    body: SendToVendorsRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Send assigned order items to the selected vendors via email.
    Groups items by vendor and sends one email per vendor.
    """
    order = await ecommerce_crud.get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    await db.refresh(order, ["user", "items"])

    # Build item map: item_id -> item object
    item_map = {item.id: item for item in order.items}

    # Group assignments by vendor_id
    vendor_items: dict[int, list] = {}
    for assignment in body.assignments:
        if assignment.item_id not in item_map:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Item {assignment.item_id} not found in order",
            )
        vendor_items.setdefault(assignment.vendor_id, []).append(item_map[assignment.item_id])

    if not vendor_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No item-vendor assignments provided",
        )

    customer_name = order.user.name if order.user else "Customer"
    customer_email = order.customer_email or (order.user.email if order.user else "")

    emails_sent = 0
    errors = []

    for vendor_id, items in vendor_items.items():
        vendor = await vendor_crud.get_vendor(db, vendor_id)
        if not vendor:
            errors.append(f"Vendor {vendor_id} not found")
            continue

        item_dicts = [
            {
                "product_name": item.product_name,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "line_total": float(item.line_total),
            }
            for item in items
        ]
        vendor_total = sum(i["line_total"] for i in item_dicts)

        try:
            sent = await EmailService.send_vendor_order_notification(
                vendor_email=vendor.email,
                vendor_name=vendor.name,
                order_number=order.order_number,
                customer_name=customer_name,
                customer_email=customer_email,
                delivery_address=order.delivery_address or "",
                delivery_city=order.delivery_city or "",
                delivery_pincode=order.delivery_pincode or "",
                items=item_dicts,
                total_amount=vendor_total,
            )
            if sent:
                emails_sent += 1
            else:
                errors.append(f"Failed to send email to vendor {vendor.name}")
        except Exception as e:
            logger.error(f"Error sending email to vendor {vendor_id}: {str(e)}")
            errors.append(f"Error sending to vendor {vendor.name}: {str(e)}")

    if emails_sent == 0 and errors:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"All vendor emails failed: {'; '.join(errors)}",
        )

    return {
        "message": f"Emails sent to {emails_sent} vendor(s)",
        "emails_sent": emails_sent,
        "errors": errors,
    }
