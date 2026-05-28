# Payment Instructions Email - Checkout Flow

## Overview

When customers proceed to checkout, they can choose between **UPI QR Code** or **Bank Transfer** payment methods. After placing an order, they automatically receive an email with detailed payment instructions sent to their registered email address.

---

## Feature Details

### 1. Email Fetching & Verification

**Automatic Email Retrieval**:
- When user visits checkout page, their email is automatically fetched from their profile
- Email is pre-populated in a dedicated "Email for Payment Instructions" field
- Field shows green checkmark (✓) if email is already verified from profile

**Manual Email Entry**:
- If user doesn't have email in profile or wants to use a different email
- They can manually enter/change email in the input field
- Email validation ensures valid format (must be valid email address)
- Shows yellow warning (⚠️) until email is manually entered and validated

---

## Checkout Page Email Section

### Location
```
Checkout Page → Top Section → "📧 Email for Payment Instructions"
```

### Visual Design
```
┌──────────────────────────────────────────────────────┐
│ 📧 Email for Payment Instructions                     │
│ ──────────────────────────────────────────────────   │
│ Payment instructions will be sent to this email.      │
│                                                       │
│ [your.email@example.com                            ] │
│                                                       │
│ ✓ Email verified from your profile                   │
│ (Or: ⚠️ Please enter or verify your email)            │
└──────────────────────────────────────────────────────┘
```

### States

**State 1: Email from Profile (Verified)**
- Background: Green (#d4edda)
- Border: Green (#28a745)
- Icon: Mail icon (green)
- Message: "✓ Email verified from your profile"
- User can still change it if needed

**State 2: Manual Email Entry (Not Yet Entered)**
- Background: Yellow (#fff3cd)
- Border: Yellow (#ffc107)
- Icon: Mail icon (orange)
- Message: "⚠️ Please enter or verify your email"
- Required before checkout

**State 3: Manual Email Entered (Valid)**
- Background: Green (#d4edda)
- Border: Green (#28a745)
- Icon: Mail icon (green)
- Message: "✓ Email entered - Valid"
- Ready for checkout

---

## Payment Instructions Email

### When Sent
**Trigger**: Immediately after order creation (during checkout)

### Email Content by Payment Method

#### UPI QR Code Payment Email
```
Subject: Payment Instructions for Order HB001234

Content:
┌─────────────────────────────────────────────┐
│ 💳 Payment Instructions                     │
│ Please complete your payment to proceed     │
├─────────────────────────────────────────────┤
│                                              │
│ Order Number: HB001234                      │
│ Amount Due: ₹5,000.00                       │
│                                              │
│ 📱 UPI Payment Instructions                 │
│ ─────────────────────────────────────────  │
│                                              │
│ Step 1: Scan the QR Code                    │
│ [QR Code Image Here]                        │
│                                              │
│ OR manually enter UPI ID:                   │
│ hurshbintech@upi                            │
│                                              │
│ Step 2: Enter Amount & Reference            │
│ • Amount: ₹5,000.00                         │
│ • Reference: HB001234 (Order ID)            │
│                                              │
│ Step 3: Complete Payment                    │
│ Confirm and submit from your UPI app        │
│                                              │
│ ⏱️ What Happens Next:                       │
│ 1. Complete the payment                     │
│ 2. Upload receipt on order page             │
│ 3. We verify within 24 hours                │
│ 4. Order prepared and shipped               │
│ 5. Track via email                          │
│                                              │
│ ❓ Questions?                                │
│ support@hurshbintech.com                    │
│                                              │
│ ⏰ Complete payment within 24 hours         │
└─────────────────────────────────────────────┘
```

#### Bank Transfer Payment Email
```
Subject: Payment Instructions for Order HB001234

Content:
┌──────────────────────────────────────────────┐
│ 💳 Payment Instructions                      │
│ Please complete your payment to proceed      │
├──────────────────────────────────────────────┤
│                                               │
│ Order Number: HB001234                       │
│ Amount Due: ₹5,000.00                        │
│                                               │
│ 🏦 Bank Transfer Instructions                │
│ ──────────────────────────────────────────  │
│                                               │
│ Bank Account Details:                        │
│ ┌─────────────────────────────────────────┐ │
│ │ Bank Name: HDFC Bank                   │ │
│ │ Account Holder: HurshBin Pvt Ltd   │ │
│ │ Account Number: XXXX XXXX 1234         │ │
│ │ IFSC Code: HDFC0001234                 │ │
│ │ Amount to Pay: ₹5,000.00               │ │
│ └─────────────────────────────────────────┘ │
│                                               │
│ ⚠️ Important: Use HB001234 as payment        │
│    reference/narration for quick verify     │
│                                               │
│ ⏱️ What Happens Next:                        │
│ 1. Complete the payment                      │
│ 2. Upload receipt on order page              │
│ 3. We verify within 24 hours                 │
│ 4. Order prepared and shipped                │
│ 5. Track via email                           │
│                                               │
│ ❓ Questions?                                 │
│ support@hurshbintech.com                     │
│                                               │
│ ⏰ Complete payment within 24 hours          │
└──────────────────────────────────────────────┘
```

---

## Implementation Details

### Frontend Changes

**File**: `src/pages/store/Checkout.jsx`

**New Imports**:
```jsx
import axiosInstance from '../../api/axios';
import { Mail, AlertCircle } from 'lucide-react';
```

**New State**:
```jsx
const [currentUser, setCurrentUser] = useState(null);
const [emailVerified, setEmailVerified] = useState(false);

const [formData, setFormData] = useState({
    delivery_address: '',
    delivery_city: '',
    delivery_pincode: '',
    payment_method: 'UPI_QR',
    email: ''  // NEW: Email for payment instructions
});
```

**New Effect Hook**:
```jsx
useEffect(() => {
    loadCart();
    loadUserData();  // NEW: Fetch user email from profile
}, []);
```

**New Function**:
```jsx
const loadUserData = async () => {
    try {
        const response = await axiosInstance.get('/profile');
        setCurrentUser(response.data);
        setFormData(prev => ({
            ...prev,
            email: response.data.email || ''
        }));
        if (response.data.email) {
            setEmailVerified(true);
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
};
```

**Updated Validation**:
```jsx
const handleCheckout = async () => {
    // ... existing validation ...
    
    if (!formData.email) {
        toast.error('Please provide your email address');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
        toast.error('Please enter a valid email address');
        return;
    }
    
    // ... rest of checkout ...
};
```

### Backend Changes

**File**: `app/schemas/ecommerce.py`

**Updated OrderCreate Schema**:
```python
class OrderCreate(BaseModel):
    delivery_address: str = Field(..., min_length=10, max_length=1000)
    delivery_city: str = Field(..., min_length=2, max_length=100)
    delivery_pincode: str = Field(..., min_length=6, max_length=10)
    payment_method: str  # UPI_QR or BANK_TRANSFER
    email: Optional[str] = Field(None, description="Customer email for payment instructions")
    
    @field_validator('payment_method')
    @classmethod
    def validate_payment_method(cls, v):
        if v not in ["UPI_QR", "BANK_TRANSFER"]:
            raise ValueError("Invalid payment method")
        return v
```

**File**: `app/api/endpoints/ecommerce.py`

**Updated Checkout Endpoint**:
```python
@router.post("/checkout")
async def checkout(order_data: OrderCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    # ... create order ...
    
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
```

**File**: `app/services/email_service.py`

**New Method**:
```python
@staticmethod
async def send_payment_instructions(
    recipient_email: str,
    recipient_name: str,
    order_number: str,
    payment_method: str,
    total_amount: float,
    upi_details: Optional[dict] = None,
    bank_details: Optional[dict] = None,
) -> bool:
    """Send payment instructions email after order creation"""
    # Builds HTML email with payment details
    # Sends via Brevo API
```

---

## User Workflow

### Step-by-Step Flow

```
1. USER VISITS CHECKOUT
   ↓
2. SYSTEM AUTO-FETCHES EMAIL FROM PROFILE
   ├─ If email exists → Green verified state
   └─ If no email → Yellow warning state
   ↓
3. USER ENTERS/CONFIRMS EMAIL (IF NEEDED)
   └─ Validates email format
   ↓
4. USER FILLS DELIVERY DETAILS
   └─ Address, city, pincode
   ↓
5. USER SELECTS PAYMENT METHOD
   └─ UPI QR or Bank Transfer
   ↓
6. USER UPLOADS PAYMENT RECEIPT
   └─ JPG, PNG, or PDF format
   ↓
7. USER CLICKS "PLACE ORDER"
   ↓
8. SYSTEM CREATES ORDER
   ├─ Calculates total amount
   ├─ Generates order number
   └─ Sets status: PENDING → PAYMENT_UPLOADED
   ↓
9. SYSTEM SENDS EMAIL WITH PAYMENT INSTRUCTIONS
   ├─ Email sent to: formData.email or current_user.email
   ├─ Subject: "Payment Instructions for Order HB001234"
   └─ Content: Personalized with order details and payment method
   ↓
10. USER RECEIVES EMAIL
    ├─ Opens email with payment instructions
    ├─ Either:
    │  ├─ Scans QR code (UPI)
    │  └─ Transfers via bank details
    └─ Uploads payment receipt
    ↓
11. ADMIN VERIFIES PAYMENT
    └─ Approves or rejects
    ↓
12. USER RECEIVES CONFIRMATION/REJECTION EMAIL
```

---

## Email Configuration

### Brevo API Settings

Ensure these are set in `.env`:
```
BREVO_API_KEY=xkeysib_xxx...
SENDER_NAME=Hurshbintech
SENDER_EMAIL=noreply@hurshbintech.com
ENABLE_EMAIL=true
FRONTEND_URL=http://localhost:3000  (or production URL)
```

### Email Template Customization

**Colors Used**:
- Primary (Header): `#2196f3` (Blue)
- UPI Success: `#27ae60` (Green)
- Bank Details: `#2196f3` (Blue)
- Amount: `#27ae60` (Green)
- Warning: `#f39c12` (Orange)

**Font**:
- Font Family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
- Header Size: 26px
- Heading Size: 18px
- Body Size: 14px
- Small Text: 12-13px

---

## Error Handling

### Email Sending Failures

**If Email Fails to Send**:
1. Error logged in backend
2. Order still created successfully
3. User can:
   - Contact support for manual email
   - Log in and view order details
   - Find payment instructions on order page

**Disable Email for Testing**:
```env
ENABLE_EMAIL=false
```

---

## Testing Checklist

- [ ] Email auto-fetches from user profile
- [ ] User can manually enter/change email
- [ ] Email validation works (rejects invalid formats)
- [ ] Payment instructions email sent for UPI QR
- [ ] Payment instructions email sent for Bank Transfer
- [ ] Email contains correct order number
- [ ] Email contains correct amount
- [ ] Email contains correct payment method details
- [ ] User receives email within seconds of order creation
- [ ] Email renders properly in Gmail, Outlook, Yahoo
- [ ] Links in email work correctly
- [ ] Can test with: `ENABLE_EMAIL=true` and valid `BREVO_API_KEY`

---

## Security Notes

- Email field validated on frontend and backend
- User must be authenticated to checkout
- Email only sent to verified user
- Order created before email (async, non-blocking)
- Email contains no sensitive payment data
- Links are generic (no tokens/secrets in URL)

---

## Future Enhancements

1. **Email Preview**: Show preview of email on checkout page
2. **Resend Email**: Allow user to resend instructions from order page
3. **SMS Option**: Send payment instructions via SMS too
4. **Email History**: Track all sent emails in admin panel
5. **Template Customization**: Allow admin to customize email templates
6. **Payment Reminder**: Automatic reminder email after 12 hours
7. **WhatsApp Integration**: Send via WhatsApp Business API

---

## Summary

✅ **Features Implemented**:
- Auto-fetch email from user profile
- Manual email entry with validation
- Visual verification status (green/yellow)
- Payment instructions email for UPI
- Payment instructions email for Bank Transfer
- Professional HTML email templates
- Async email sending (non-blocking checkout)
- Error handling and logging
- Brevo API integration

**Current Status**: Ready for production after configuring `BREVO_API_KEY`

---
**Last Updated**: December 29, 2025
**Version**: 1.0
