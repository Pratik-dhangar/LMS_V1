# Payment Verification - System Flow Diagram

## Complete Order & Payment Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CUSTOMER SIDE                                  │
└─────────────────────────────────────────────────────────────────────────┘

1. CHECKOUT
   ┌─────────────────────────────────┐
   │ Add items to cart                │
   │ Proceed to checkout              │
   │ Enter delivery details:          │
   │  - Address (min 10 chars)        │
   │  - City (min 2 chars)            │
   │  - Pincode (6-10 chars)          │
   └─────────────────────────────────┘
            │
            ▼
   ┌─────────────────────────────────┐
   │ SELECT PAYMENT METHOD            │
   │ ─────────────────────────────   │
   │ □ UPI_QR                        │
   │ □ BANK_TRANSFER                 │
   └─────────────────────────────────┘
            │
            ▼
   ┌─────────────────────────────────┐
   │ PAYMENT SCREEN                   │
   │ ─────────────────────────────   │
   │ View Order Summary:              │
   │ - Items & Prices                 │
   │ - Total Amount                   │
   │ - Delivery Address               │
   │                                  │
   │ Payment Instructions:            │
   │ - UPI: Show QR code              │
   │ - Bank: Show account details     │
   │ - Order #: Reference number      │
   └─────────────────────────────────┘
            │
            ▼
   ┌─────────────────────────────────┐
   │ MAKE PAYMENT                     │
   │ (Customer uses UPI/Bank app)     │
   └─────────────────────────────────┘
            │
            ▼
   ┌─────────────────────────────────┐
   │ UPLOAD RECEIPT                   │
   │ ─────────────────────────────   │
   │ File: JPG, PNG, PDF              │
   │ Shows: Payment confirmation      │
   │        Receipt number            │
   │        Timestamp                 │
   │        Amount                    │
   └─────────────────────────────────┘
            │
            ▼
   ┌─────────────────────────────────┐
   │ ✓ ORDER SUBMITTED                │
   │ ─────────────────────────────   │
   │ Status: PAYMENT_UPLOADED         │
   │ Message: "Awaiting admin review" │
   └─────────────────────────────────┘
            │
            ▼
        WAIT FOR ADMIN...


┌─────────────────────────────────────────────────────────────────────────┐
│                           ADMIN SIDE                                      │
└─────────────────────────────────────────────────────────────────────────┘

2. PAYMENT VERIFICATION DASHBOARD

   ┌──────────────────────────────────────────────────────────────┐
   │                                                                │
   │  PAYMENT VERIFICATION                                         │
   │  ──────────────────────────────────────────────────────────  │
   │                                                                │
   │  Filter: [Pending] [Approved] [Rejected]                      │
   │                                                                │
   │  ┌─────────────────────────────────────────────────────────┐ │
   │  │ Order #HB001234                                          │ │
   │  │ ───────────────────────────────────────────────────────  │ │
   │  │ Customer: John Doe                                        │ │
   │  │ Amount: ₹15,000                                           │ │
   │  │ Method: BANK_TRANSFER                                     │ │
   │  │ Items: 5                                                  │ │
   │  │ Status: ⚠️ PENDING APPROVAL                               │ │
   │  │                                                            │ │
   │  │ [View Details] [✓ Approve] [✗ Reject]                    │ │
   │  └─────────────────────────────────────────────────────────┘ │
   │                                                                │
   │  ┌─────────────────────────────────────────────────────────┐ │
   │  │ Order #HB001233                                          │ │
   │  │ ───────────────────────────────────────────────────────  │ │
   │  │ Customer: Jane Smith                                      │ │
   │  │ Amount: ₹8,500                                            │ │
   │  │ Method: UPI_QR                                            │ │
   │  │ Items: 3                                                  │ │
   │  │ Status: ⚠️ PENDING APPROVAL                               │ │
   │  │                                                            │ │
   │  │ [View Details] [✓ Approve] [✗ Reject]                    │ │
   │  └─────────────────────────────────────────────────────────┘ │
   │                                                                │
   └──────────────────────────────────────────────────────────────┘

3. APPROVAL DECISION

   Option A: Quick Approve
   ┌──────────────────────────────────────────┐
   │ Click "Approve" button on order card      │
   │                 │                         │
   │                 ▼                         │
   │ Order Status: PAYMENT_APPROVED           │
   │                 │                         │
   │                 ▼                         │
   │ ✓ Proceed to Shipping                    │
   └──────────────────────────────────────────┘

   Option B: Detailed Review
   ┌──────────────────────────────────────────┐
   │ Click "View Details"                     │
   │          │                                │
   │          ▼                                │
   │ ┌──────────────────────────────────────┐ │
   │ │ MODAL: Full Order Details            │ │
   │ │                                       │ │
   │ │ CUSTOMER INFO:                        │ │
   │ │ Name: John Doe                        │ │
   │ │ Email: john@example.com               │ │
   │ │ Address: 123 Main St, Apt 4B          │ │
   │ │ City: Mumbai                          │ │
   │ │ Pincode: 400001                       │ │
   │ │                                       │ │
   │ │ ORDER ITEMS:                          │ │
   │ │ □ Item 1 × 2 = ₹5,000                │ │
   │ │ □ Item 2 × 1 = ₹3,500                │ │
   │ │ □ Item 3 × 2 = ₹4,000                │ │
   │ │ □ Item 4 × 1 = ₹2,000                │ │
   │ │ □ Item 5 × 1 = ₹500                  │ │
   │ │                                       │ │
   │ │ PAYMENT SUMMARY:                      │ │
   │ │ Subtotal: ₹15,000                    │ │
   │ │ Discount: -₹0                         │ │
   │ │ Total: ₹15,000                       │ │
   │ │                                       │ │
   │ │ Payment Method: BANK_TRANSFER         │ │
   │ │ Receipt Uploaded: Yes                 │ │
   │ │                                       │ │
   │ │ [✓ Approve] [✗ Reject]               │ │
   │ └──────────────────────────────────────┘ │
   └──────────────────────────────────────────┘

   Option C: Reject with Reason
   ┌──────────────────────────────────────────┐
   │ Click "Reject" button                    │
   │          │                                │
   │          ▼                                │
   │ ┌──────────────────────────────────────┐ │
   │ │ ENTER REJECTION REASON:               │ │
   │ │                                       │ │
   │ │ ┌────────────────────────────────┐   │ │
   │ │ │ Reason:                         │   │ │
   │ │ │ • Duplicate payment            │   │ │
   │ │ │ • Incorrect amount             │   │ │
   │ │ │ • Invalid receipt              │   │ │
   │ │ │ • Other: _______________       │   │ │
   │ │ │                                 │   │ │
   │ │ │ Details:                        │   │ │
   │ │ │ ┌────────────────────────────┐ │   │ │
   │ │ │ │ Payment amount is ₹500     │ │   │ │
   │ │ │ │ less than order total      │ │   │ │
   │ │ │ │                             │ │   │ │
   │ │ │ │                             │ │   │ │
   │ │ │ │                             │ │   │ │
   │ │ │ └────────────────────────────┘ │   │ │
   │ │ │                                 │   │ │
   │ │ │ [Cancel] [✗ Reject]            │   │ │
   │ │ └────────────────────────────────┘   │ │
   └──────────────────────────────────────────┘


4. ORDER STATUS CHANGES

   Approval Path:
   PAYMENT_UPLOADED ──[Approve]──► PAYMENT_APPROVED ──► PROCESSING ──► SHIPPED ──► DELIVERED
                                        ▲
                                        │
                                    Ready for:
                                    - Generate shipping label
                                    - Assign to delivery partner
                                    - Update tracking info

   Rejection Path:
   PAYMENT_UPLOADED ──[Reject]──► PAYMENT_REJECTED
                                        ▲
                                        │
                                    Customer can:
                                    - Place new order
                                    - Contact support
                                    - Ask clarification


┌─────────────────────────────────────────────────────────────────────────┐
│                          CUSTOMER NOTIFICATION                           │
└─────────────────────────────────────────────────────────────────────────┘

Email Notification (After Approval):
┌─────────────────────────────────────────────────────────┐
│ Subject: Payment Approved! Order #HB001234             │
│                                                         │
│ Dear John Doe,                                          │
│                                                         │
│ Your payment has been verified and approved! ✓         │
│                                                         │
│ Order Details:                                          │
│ Order #: HB001234                                       │
│ Total Amount: ₹15,000                                  │
│ 5 Items                                                │
│                                                         │
│ Your order is now being prepared for shipping.         │
│ You'll receive tracking details shortly.               │
│                                                         │
│ Best regards,                                           │
│ HurshBin Team                                           │
└─────────────────────────────────────────────────────────┘

Email Notification (After Rejection):
┌─────────────────────────────────────────────────────────┐
│ Subject: Payment Needs Attention - Order #HB001234    │
│                                                         │
│ Dear John Doe,                                          │
│                                                         │
│ Your payment could not be verified at this time.       │
│                                                         │
│ Order #: HB001234                                       │
│ Reason: Payment amount is ₹500 less than order total   │
│                                                         │
│ Please resubmit with the correct amount.              │
│ You can upload a new receipt from your account.        │
│                                                         │
│ [Resubmit Payment] [Contact Support]                   │
│                                                         │
│ Best regards,                                           │
│ HurshBin Team                                           │
└─────────────────────────────────────────────────────────┘
```

## Key Points

✅ **For Customers:**
- Clear payment instructions with UPI/Bank details
- Receipt upload confirmation
- Email notifications after admin decision
- Easy resubmission for rejected payments

✅ **For Admins:**
- Quick access to pending orders
- Full order and customer details
- One-click approval/rejection
- Clear rejection reasons
- Audit trail of all actions

✅ **System Benefits:**
- Secure payment verification process
- Prevents fraud and duplicate payments
- Fast order processing once approved
- Clear communication with customers
- Complete order tracking and history
