# Email System - Order & Payment Notifications

## Overview

The HurshBin platform uses **Brevo API** (formerly Sendinblue) to send automated emails to customers for order confirmations and payment updates. All emails are HTML-formatted with professional styling.

---

## Email Service Architecture

### 1. **Email Service Location**
```
hurshbintech-backend/app/services/email_service.py
```

### 2. **Email Provider**
- **Provider**: Brevo (Sendinblue)
- **API**: SMTP Email API v3
- **Endpoint**: `https://api.brevo.com/v3/smtp/email`
- **Authentication**: API Key (stored in `.env` as `BREVO_API_KEY`)

### 3. **Configuration**
Email settings are configured in `app/core/config.py`:

```python
# Email Configuration (Brevo API)
BREVO_API_KEY: Optional[str] = None  # Brevo API key
SENDER_NAME: str = "Hurshbintech"
SENDER_EMAIL: str = "noreply@hurshbintech.com"
ENABLE_EMAIL: bool = True  # Toggle email sending on/off
```

**Set these in your `.env` file:**
```
BREVO_API_KEY=your_brevo_api_key_here
SENDER_NAME=Hurshbintech
SENDER_EMAIL=noreply@hurshbintech.com
ENABLE_EMAIL=true
```

---

## Email Types & Triggers

### 1. **Order Confirmation Email** 📧✅

**Trigger**: When admin approves payment (`PAYMENT_UPLOADED` → `PAYMENT_APPROVED`)

**Function**:
```python
async def send_order_confirmation(
    recipient_email: str,
    recipient_name: str,
    order_number: str,
    order_items: list,
    subtotal: float,
    discount: float,
    total: float,
    delivery_address: str,
) -> bool
```

**Called From**: `app/api/endpoints/ecommerce.py` - `/admin/orders/{order_id}/approve` endpoint

**Email Content**:
- ✓ Success badge: "Payment Verified ✓"
- Order ID and detailed items table
- Item names, quantities, prices, and totals
- Subtotal, discount, and final total amount
- Delivery address
- Next steps: "Your order is ready to ship"
- Tracking information notice
- Support contact information

**Template Styling**:
- Header: Green background (#10b981) with "Order Confirmed!" title
- Items table with proper formatting
- Totals summary box
- Delivery address highlighted
- Professional footer with copyright

---

### 2. **Payment Rejection Email** 📧❌

**Trigger**: When admin rejects payment with reason

**Function**:
```python
async def send_order_rejection(
    recipient_email: str,
    recipient_name: str,
    order_number: str,
    rejection_reason: str,
) -> bool
```

**Called From**: `app/api/endpoints/ecommerce.py` - `/admin/orders/{order_id}/reject` endpoint

**Email Content**:
- Alert header: "Payment Verification Needed"
- Order number
- **Rejection reason** (specified by admin):
  - Duplicate payment
  - Incorrect amount
  - Invalid receipt
  - Custom reason
- Action items for customer:
  1. Review the rejection reason
  2. Contact support if clarification needed
  3. Resubmit with correct payment details
- Links to:
  - Dashboard to resubmit payment
  - Support contact

**Template Styling**:
- Header: Red background (#dc2626) for alert
- Reason box with highlighted background
- Clear call-to-action buttons
- Support contact information

---

## Email Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CUSTOMER CHECKOUT                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                ┌─────────────────────────────┐
                │ POST /orders/checkout        │
                │ ─────────────────────────   │
                │ Create order                 │
                │ Status: PENDING              │
                │ (Cart cleared)               │
                └─────────────────────────────┘
                              │
                              ▼
                ┌─────────────────────────────┐
                │ Customer sees:              │
                │ - Payment instructions      │
                │ - UPI QR or Bank Details    │
                │ - Order number              │
                └─────────────────────────────┘
                              │
                              ▼
                ┌─────────────────────────────┐
                │ Customer makes payment      │
                │ and uploads receipt         │
                │ (JPG, PNG, PDF)             │
                │                             │
                │ Status: PAYMENT_UPLOADED    │
                └─────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN PAYMENT VERIFICATION                    │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴──────────────────────┐
        │                                            │
        ▼                                            ▼
   ┌──────────────┐                         ┌──────────────┐
   │   APPROVE    │                         │   REJECT     │
   │   PAYMENT    │                         │   PAYMENT    │
   └──────────────┘                         └──────────────┘
        │                                            │
        ▼                                            ▼
┌─────────────────────────┐              ┌─────────────────────────┐
│ POST /admin/orders/     │              │ POST /admin/orders/     │
│ {id}/approve            │              │ {id}/reject             │
│ ─────────────────────   │              │ ─────────────────────   │
│ Status: PAYMENT_APPROVED│              │ Add rejection_reason    │
│                         │              │ Status: PAYMENT_REJECTED│
└─────────────────────────┘              └─────────────────────────┘
        │                                            │
        ▼                                            ▼
┌─────────────────────────────┐         ┌──────────────────────────────┐
│ EmailService.               │         │ EmailService.                │
│ send_order_confirmation()   │         │ send_order_rejection()       │
│ ────────────────────────    │         │ ──────────────────────────   │
│ Email Type: Brevo SMTP      │         │ Email Type: Brevo SMTP       │
│ Subject: "Order Confirmed"  │         │ Subject: "Payment Verification
│ To: customer@email.com      │         │ To: customer@email.com       │
└─────────────────────────────┘         └──────────────────────────────┘
        │                                            │
        ▼                                            ▼
   ┌─────────────┐                            ┌──────────────┐
   │             │                            │              │
   │ BREVO API   │                            │ BREVO API    │
   │             │                            │              │
   │ Sends Email │                            │ Sends Email  │
   │             │                            │              │
   └─────────────┘                            └──────────────┘
        │                                            │
        ▼                                            ▼
┌─────────────────────────┐              ┌──────────────────────────┐
│ CUSTOMER RECEIVES:      │              │ CUSTOMER RECEIVES:       │
│                         │              │                          │
│ ✓ Order Confirmed Email │              │ ❌ Payment Rejection Email│
│                         │              │                          │
│ - Order number          │              │ - Order number           │
│ - Item list             │              │ - Rejection reason       │
│ - Total amount          │              │ - How to resubmit        │
│ - Delivery address      │              │ - Support contact        │
│ - "Ready to ship"       │              │ - Dashboard link         │
│                         │              │                          │
│ Status: PAYMENT_APPROVED│              │ Status: PAYMENT_REJECTED │
│ Next: Shipping process  │              │ Next: Resubmit payment   │
└─────────────────────────┘              └──────────────────────────┘
```

---

## Email Implementation Code

### Backend Integration Point (ecommerce.py)

```python
# After payment approval
@router.post("/admin/orders/{order_id}/approve")
async def approve_payment(order_id: UUID, ...):
    # ... update order status to PAYMENT_APPROVED ...
    
    # Send confirmation email
    await EmailService.send_order_confirmation(
        recipient_email=order.user.email,           # Customer email
        recipient_name=order.user.name,             # Customer name
        order_number=updated_order.order_number,    # Order ID
        order_items=[                               # Items list
            {
                "product_name": item.product_name,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "line_total": float(item.line_total)
            }
            for item in updated_order.items
        ],
        subtotal=float(updated_order.subtotal),     # Subtotal
        discount=float(updated_order.discount_total),# Discount
        total=float(updated_order.total_amount),    # Final total
        delivery_address=updated_order.delivery_address  # Address
    )
```

### After Payment Rejection

```python
@router.post("/admin/orders/{order_id}/reject")
async def reject_payment(order_id: UUID, order_data: OrderReject, ...):
    # ... update order status to PAYMENT_REJECTED ...
    
    # Send rejection email
    await EmailService.send_order_rejection(
        recipient_email=order.user.email,
        recipient_name=order.user.name,
        order_number=order.order_number,
        rejection_reason=order_data.rejection_reason  # Admin's reason
    )
```

---

## Email Service Core Method

```python
@staticmethod
async def _send_email(
    recipient_email: str,
    recipient_name: str,
    subject: str,
    html_body: str,
    email_type: str = "general"
) -> bool:
    """Core method that sends email via Brevo API"""
    
    if not settings.ENABLE_EMAIL or not recipient_email:
        logger.warning(f"Email sending disabled")
        return False
    
    payload = {
        "sender": {
            "name": settings.SENDER_NAME,
            "email": settings.SENDER_EMAIL
        },
        "to": [
            {
                "email": recipient_email,
                "name": recipient_name
            }
        ],
        "subject": subject,
        "htmlContent": html_body
    }
    
    headers = {
        "accept": "application/json",
        "api-key": settings.BREVO_API_KEY,
        "content-type": "application/json"
    }
    
    # Send via Brevo API
    async with aiohttp.ClientSession() as session:
        async with session.post(
            BREVO_API_URL,
            json=payload,
            headers=headers
        ) as response:
            # Log and return result
            return response.status == 201
```

---

## Email Customization

### Modify Email Templates

Edit email templates in `app/services/email_service.py`:
- **Order Confirmation**: Lines 1122-1302
- **Payment Rejection**: Lines 1304+

### Colors Used
- **Success Green**: `#10b981`
- **Alert Red**: `#dc2626`
- **Text Dark**: `#2c3e50`
- **Background Light**: `#f9fafb`

### Sender Information
Change in `.env`:
```
SENDER_NAME=Your Company Name
SENDER_EMAIL=noreply@yourcompany.com
```

---

## Setup Instructions

### 1. Get Brevo API Key
1. Sign up at [Brevo.com](https://www.brevo.com)
2. Go to Settings → API
3. Copy your API Key (Mailer API Key)
4. Add to `.env`:
   ```
   BREVO_API_KEY=xkeysib_xxx...
   ```

### 2. Verify Sender Email
1. In Brevo dashboard, verify sender email: `noreply@hurshbintech.com`
2. Add to Verified Senders list
3. Update in config if using different email

### 3. Test Email Sending
```python
# Run this in Python terminal
import asyncio
from app.services.email_service import EmailService

asyncio.run(EmailService.send_order_confirmation(
    recipient_email="test@example.com",
    recipient_name="Test User",
    order_number="HB001234",
    order_items=[
        {
            "product_name": "Test Item",
            "quantity": 1,
            "unit_price": 100.0,
            "line_total": 100.0
        }
    ],
    subtotal=100.0,
    discount=0.0,
    total=100.0,
    delivery_address="123 Test St, City 12345"
))
```

### 4. Enable/Disable Emails
Toggle in `.env`:
```
ENABLE_EMAIL=true   # Enable emails
ENABLE_EMAIL=false  # Disable emails (testing)
```

---

## Email Status & Monitoring

### Check Email Logs
Emails are logged in:
- **Backend logs**: `hurshbintech-backend/logs/app.log`
- **Brevo dashboard**: View delivery status and bounces

### Common Issues

| Issue | Solution |
|-------|----------|
| Emails not sending | Check `ENABLE_EMAIL=true` in .env |
| "API Key not found" | Set `BREVO_API_KEY` in .env |
| "Invalid sender email" | Verify email in Brevo dashboard |
| "Rate limit exceeded" | Brevo rate limit hit (check plan) |
| Emails in spam | Add to sender whitelist in Brevo |

---

## Email Variables Reference

### Order Confirmation Email Variables
- `recipient_name`: Customer's full name
- `order_number`: Order ID (e.g., "HB001234")
- `order_items`: List of ordered items with details
- `subtotal`: Total before discount
- `discount`: Total discount amount
- `total`: Final amount to be paid
- `delivery_address`: Full delivery address

### Rejection Email Variables
- `recipient_name`: Customer's full name
- `order_number`: Order ID
- `rejection_reason`: Admin-provided rejection reason

---

## Frontend Integration

### Order Confirmation
After admin approves payment, the frontend order list automatically updates:
- Order status changes to "PAYMENT_APPROVED"
- Customer receives email confirmation
- Order moves to "Approved" tab (if filtering by status)

### Rejection Handling
After admin rejects with reason:
- Order status changes to "PAYMENT_REJECTED"
- Rejection reason stored and displayable
- Customer can resubmit with new receipt

---

## Future Enhancements

1. **Email Templates in Database**: Store templates as records for easy editing
2. **Email History**: Track all sent emails with delivery status
3. **SMS Notifications**: Add SMS for payment updates
4. **Webhook Integration**: Set up Brevo webhooks for bounce/delivery tracking
5. **Template Variables**: Support more dynamic variables (tracking ID, etc.)
6. **Batch Email Sending**: For admin notifications
7. **Email Scheduling**: Delayed send for follow-ups

---

## Summary

✅ **System is fully implemented with:**
- Automated email sending via Brevo API
- Professional HTML email templates
- Payment approval notifications
- Payment rejection notifications with reasons
- Configurable sender information
- Easy enable/disable via environment variable
- Proper error handling and logging

**Current Status**: Ready for production use after setting `BREVO_API_KEY` in `.env`

---
**Last Updated**: December 29, 2025
**Version**: 1.0
