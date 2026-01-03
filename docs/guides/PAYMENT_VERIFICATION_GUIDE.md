# Payment Verification Flow - Admin Dashboard Guide

## Overview
The admin payment verification system allows administrators to review customer payment receipts and approve/reject payments before processing orders for shipping.

## Payment Verification Workflow

### Step 1: Customer Checkout & Payment Upload
1. Customer places order at `/store/checkout`
2. Provides delivery details:
   - Address (minimum 10 characters)
   - City (minimum 2 characters)
   - Pincode (6-10 characters)
3. Selects payment method:
   - **UPI_QR**: Quick response code payment
   - **BANK_TRANSFER**: Direct bank transfer
4. Receives payment instructions with order number
5. Makes payment and uploads receipt (JPG, PNG, PDF)
6. Order status: **PAYMENT_UPLOADED** (Pending Admin Review)

### Step 2: Admin Verification Dashboard
Navigate to: **Admin Dashboard → Payment Verification**

#### Dashboard Features:
- **Filter by Status**:
  - Pending (PAYMENT_UPLOADED) - Awaiting verification
  - Approved (PAYMENT_APPROVED) - Verified, ready to ship
  - Rejected (PAYMENT_REJECTED) - Payment issues

- **Order Card Display**:
  - Order number and customer name
  - Total amount and payment method
  - Item count and order date
  - Status badge with visual indicator

#### For Each Pending Order:

**Option 1: Quick Approval**
- Click "Approve" button on the order card
- Confirms payment immediately
- Status changes to PAYMENT_APPROVED
- Proceeds to shipping preparation

**Option 2: Detailed Review**
- Click "View Details" button
- Opens modal with full order information:
  - Customer details (name, email, delivery address)
  - Order items with quantities and prices
  - Payment summary (subtotal, discount, total)
  - For rejection: add reason in text area

**Option 3: Rejection**
- Click "Reject" button (requires reason)
- Enter rejection reason:
  - Duplicate payment
  - Incorrect amount
  - Invalid receipt
  - Customer request
  - Other (specify)
- Status changes to PAYMENT_REJECTED
- Customer notified via email with reason
- Customer can resubmit payment

### Step 3: Post-Approval Actions

#### After Approval:
1. Order status: **PAYMENT_APPROVED**
2. Order moves to shipping queue
3. Admin can:
   - View approved orders
   - Track shipping status
   - Generate shipping labels (future feature)
   - Update tracking information

#### After Rejection:
1. Order status: **PAYMENT_REJECTED**
2. Rejection reason stored in order
3. Customer receives notification email
4. Customer can:
   - Place new order
   - Contact support for clarification

## API Endpoints Used

### Get Pending Orders (Admin)
```
GET /api/orders/admin/orders?status=PAYMENT_UPLOADED
```
**Response**: List of orders with user details, items, and payment info

### Approve Payment
```
POST /api/orders/admin/orders/{order_id}/approve
```
**Response**: Order details with PAYMENT_APPROVED status

### Reject Payment
```
POST /api/orders/admin/orders/{order_id}/reject
Body: {
  "rejection_reason": "Reason for rejection"
}
```
**Response**: Order details with PAYMENT_REJECTED status and reason

## Order Statuses

| Status | Description | Next Action |
|--------|-------------|------------|
| PENDING | Cart items, not checked out | - |
| PAYMENT_UPLOADED | Payment receipt submitted | Admin approval/rejection |
| PAYMENT_APPROVED | Payment verified, ready to ship | Prepare shipping |
| PAYMENT_REJECTED | Payment declined | Customer resubmits |
| PROCESSING | Order being prepared | Update tracking |
| COMPLETED | Order delivered | Archive |
| CANCELLED | Order cancelled | Refund (if needed) |

## Best Practices for Admins

1. **Verify Payment Details**:
   - Check amount matches order total
   - Verify receipt shows correct date/time
   - Confirm payment method matches order
   - Look for duplicate payments

2. **Quick Review Process**:
   - Batch review similar payment methods together
   - Approve straightforward cases first
   - Flag suspicious payments for detailed review

3. **Communication**:
   - Clear rejection reasons help customers
   - Include specific issues (e.g., "Receipt amount is 500 less than order total")
   - Suggest resubmission or contact support

4. **Record Keeping**:
   - All rejections logged with reasons
   - Audit trail available for each order
   - Payment history preserved

## Security Notes

- Only admins can access payment verification dashboard
- All actions logged with admin ID and timestamp
- Payment details encrypted in database
- Receipt files stored securely (S3 or local)
- Sensitive data masked in displays (e.g., partial account numbers)

## Troubleshooting

**Issue**: Order not appearing in pending list
- **Solution**: Check order status, verify user payment receipt was uploaded

**Issue**: Cannot reject - reason field disabled
- **Solution**: Reason is required for rejection. Click modal to add reason first

**Issue**: Approval fails with error
- **Solution**: Verify order status is PAYMENT_UPLOADED, check network connection

## Future Enhancements

1. **Automated Verification**:
   - OCR-based receipt scanning
   - Auto-verify standard bank transfers
   - Fraud detection algorithms

2. **Payment Gateway Integration**:
   - Direct API verification with UPI providers
   - Instant payment confirmation
   - Automated approval for verified payments

3. **Shipping Integration**:
   - Auto-generate shipping labels
   - Integrate with courier APIs
   - Track shipments in dashboard

4. **Analytics**:
   - Payment approval metrics
   - Average review time
   - Rejection reasons analysis
   - Revenue tracking

---
**Last Updated**: December 29, 2025
**Version**: 1.0
