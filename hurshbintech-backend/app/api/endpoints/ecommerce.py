"""API endpoints for E-Commerce Orders and Payments
"""
import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_current_admin, get_db
from app.core.config import settings
from app.crud import ecommerce_crud
from app.models.user_model import User
from app.models.ecommerce_model import OrderStatus
from app.schemas.ecommerce import (
    OrderCreate, OrderResponse, OrderCreateResponse, OrderListResponse,
    PaymentReceiptResponse, OrderApprove, OrderReject, OrderApprovalResponse,
    OrderWithUserResponse, OrderAuditLogList
)
from app.utils.s3_utils import S3Manager
from app.utils.file_handler import upload_file
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("/checkout", response_model=OrderCreateResponse, status_code=status.HTTP_201_CREATED)
async def checkout(
    order_data: OrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create order from cart (checkout)"""
    # Get cart with items
    cart = await ecommerce_crud.get_cart_with_items(db, current_user.id)
    
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
    
    try:
        # Create order
        order = await ecommerce_crud.create_order(db, current_user.id, order_data, cart.items)
        
        # Clear cart after order creation
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
                "account_number": "XXXX XXXX 1234",
                "ifsc_code": "HDFC0001234",
                "account_holder": "HurshBintech Pvt Ltd"
            }
        
        # Send payment instructions email
        recipient_email = order_data.email or current_user.email
        recipient_name = current_user.name
        
        await EmailService.send_payment_instructions(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            order_number=order.order_number,
            payment_method=order_data.payment_method,
            total_amount=float(order.total_amount),
            upi_details=payment_details if order_data.payment_method == "UPI_QR" else None,
            bank_details=payment_details if order_data.payment_method == "BANK_TRANSFER" else None,
        )
        
        # Build response
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
            "order_id": order.id,
            "order_number": order.order_number,
            "status": order.status.value if isinstance(order.status, OrderStatus) else order.status,
            "total_amount": order.total_amount,
            "payment_method": order.payment_method.value if hasattr(order.payment_method, 'value') else order.payment_method,
            "payment_details": payment_details,
            "items": items_response,
            "delivery_address": order.delivery_address,
            "created_at": order.created_at
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create order: {str(e)}"
        )


@router.get("", response_model=OrderListResponse)
async def get_orders(
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get user's orders with optional status filter"""
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
    
    return {
        "orders": orders_response,
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": total_pages
        }
    }


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get order details"""
    order = await ecommerce_crud.get_order_by_id(db, order_id)
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    
    # Verify order belongs to user
    if order.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")
    
    return {
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


@router.post("/{order_id}/payment-receipt", response_model=PaymentReceiptResponse, status_code=status.HTTP_201_CREATED)
async def upload_payment_receipt(
    order_id: UUID,
    receipt: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload payment receipt for order"""
    # Verify order exists and belongs to user
    order = await ecommerce_crud.get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    
    if order.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")
    
    # Verify order status is CREATED
    if order.status != OrderStatus.CREATED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot upload receipt for order in {order.status.value} status"
        )
    
    # Check if receipt already exists
    existing_receipt = await ecommerce_crud.get_receipt_by_order(db, order_id)
    if existing_receipt:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Payment receipt already uploaded for this order"
        )
    
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
            db, order_id, s3_path, receipt.filename, len(contents), file_type, current_user.id
        )
        
        return {
            "receipt_id": payment_receipt.id,
            "order_id": payment_receipt.order_id,
            "s3_path": payment_receipt.s3_path,
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
@router.get("/admin/orders", response_model=OrderListResponse)
async def get_admin_orders(
    status: Optional[str] = "PAYMENT_UPLOADED",
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    """Get all orders for admin review (Admin only)"""
    orders, total = await ecommerce_crud.get_orders_for_admin(db, status, page, limit)
    
    total_pages = (total + limit - 1) // limit
    
    # Build response with user details
    orders_response = []
    for order in orders:
        order_dict = {
            "order_id": order.id,
            "order_number": order.order_number,
            "status": order.status.value if isinstance(order.status, OrderStatus) else order.status,
            "user_id": order.user_id,
            "user_name": order.user.name if order.user else "Unknown",
            "user_email": order.user.email if order.user else None,
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
    
    try:
        updated_order = await ecommerce_crud.update_order_status(
            db, order_id, OrderStatus.PAYMENT_APPROVED, current_admin.id
        )
        
        # Refresh to get updated relationships
        await db.refresh(updated_order, ['user', 'items'])
        
        # Get recipient email - prioritize stored customer_email from checkout
        recipient_email = updated_order.customer_email or (updated_order.user.email if updated_order.user else None)
        recipient_name = updated_order.user.name if updated_order.user else "Customer"
        
        logger.info(f"Order {order_id} approved. Sending approval email to {recipient_email}")
        
        # Send confirmation email only if email is available
        if recipient_email and recipient_name:
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
                    delivery_address=updated_order.delivery_address
                )
                logger.info(f"✓ Approval confirmation email sent to {recipient_email}")
            except Exception as email_error:
                logger.error(f"✗ Failed to send approval email: {str(email_error)}")
        else:
            logger.error(f"Order {order_id}: Cannot send email - no recipient email found. customer_email: {updated_order.customer_email}, user.email: {updated_order.user.email if updated_order.user else 'NO USER'}")
        
        return {
            "message": "Payment approved",
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
                    rejection_reason=reject_data.reason
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
