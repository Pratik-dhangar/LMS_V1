# Subscription Management System - Testing Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Test Environment Setup](#test-environment-setup)
3. [Backend API Testing](#backend-api-testing)
4. [Frontend UI Testing](#frontend-ui-testing)
5. [End-to-End Test Scenarios](#end-to-end-test-scenarios)
6. [Database Verification](#database-verification)
7. [Background Workers Testing](#background-workers-testing)
8. [Common Issues & Troubleshooting](#common-issues--troubleshooting)

---

## Prerequisites

### Required Tools
- **Postman** or **Thunder Client** (VS Code extension) for API testing
- **PostgreSQL** client (pgAdmin or psql) for database verification
- **Browser DevTools** for frontend debugging
- **Python 3.10+** with all backend dependencies installed
- **Node.js 18+** with all frontend dependencies installed

### Test Accounts
Create these test users in your database:
- **Admin**: For managing discount codes and verifying payments
- **Head (Coach)**: For creating subscription packages and managing learner subscriptions
- **Learner**: For testing learner subscription assignment

---

## Test Environment Setup

### 1. Start Backend Server
```bash
cd hurshbintech-backend
uvicorn main:app --reload
```
Server runs on: `http://127.0.0.1:8000`

### 2. Start Frontend Development Server
```bash
cd hurshbintech-frontend
npm run dev
```
Frontend runs on: `http://localhost:5173`

### 3. Verify Database Migration
```bash
cd hurshbintech-backend
alembic upgrade head
```

Check tables created:
- `subscription_packages`
- `learner_subscriptions`
- `subscription_payment_receipts`
- `subscription_discounts`
- `session_adjustment_logs`
- `subscription_event_logs`

### 4. Verify Background Workers
Background tasks should be running for:
- Expired subscription checks (every 6 hours)
- Pause/Freeze expiration checks (daily)
- Session reminder notifications

---

## Backend API Testing

### A. Manage Learning Packages (HEAD Endpoints)

#### 1. Create Manage Learning Package
**Endpoint**: `POST /api/head/subscriptions/packages`

**Headers**:
```json
{
  "Authorization": "Bearer <HEAD_JWT_TOKEN>",
  "Content-Type": "application/json"
}
```

**Request Body**:
```json
{
  "package_name": "Premium Monthly Package",
  "description": "30 sessions valid for 30 days",
  "sessions_count": 30,
  "validity_days": 30,
  "price": 5000.00,
  "is_active": true
}
```

**Expected Response** (201):
```json
{
  "id": 1,
  "head_id": 2,
  "package_name": "Premium Monthly Package",
  "description": "30 sessions valid for 30 days",
  "sessions_count": 30,
  "validity_days": 30,
  "price": "5000.00",
  "is_active": true,
  "created_at": "2026-01-17T12:00:00",
  "updated_at": "2026-01-17T12:00:00"
}
```

#### 2. Get All Packages (HEAD)
**Endpoint**: `GET /api/head/subscriptions/packages?page=1&per_page=10`

**Test Cases**:
- ✅ Returns paginated list of packages created by HEAD
- ✅ Filter by `is_active=true`
- ✅ Search by package name

#### 3. Update Package
**Endpoint**: `PUT /api/head/subscriptions/packages/{package_id}`

**Request Body**:
```json
{
  "package_name": "Premium Monthly Package - Updated",
  "price": 4500.00,
  "is_active": false
}
```

#### 4. Delete Package
**Endpoint**: `DELETE /api/head/subscriptions/packages/{package_id}`

**Expected**: 204 No Content

---

### B. Learner Subscriptions (HEAD Endpoints)

#### 1. Create Learner Subscription
**Endpoint**: `POST /api/head/subscriptions/learners`

**Request Body**:
```json
{
  "learner_id": 5,
  "package_id": 1,
  "discount_code": "WELCOME20",
  "notes": "Trial subscription for new learner"
}
```

**Expected Response** (201):
```json
{
  "id": 1,
  "learner_id": 5,
  "package_id": 1,
  "created_by_head_id": 2,
  "current_head_id": 2,
  "package_name": "Premium Monthly Package",
  "package_sessions": 30,
  "package_validity_days": 30,
  "package_original_price": "5000.00",
  "start_date": "2026-01-17",
  "expiry_date": "2026-02-16",
  "status": "ACTIVE",
  "sessions_total": 30,
  "sessions_completed": 0,
  "sessions_remaining": 30,
  "discount_code": "WELCOME20",
  "discount_amount": "1000.00",
  "net_price_paid": "4000.00",
  "notes": "Trial subscription for new learner",
  "created_at": "2026-01-17T12:00:00"
}
```

**Test Cases**:
- ✅ Without discount code
- ✅ With valid discount code
- ✅ With invalid/expired discount code (should fail)
- ✅ Check automatic session calculation
- ✅ Verify expiry date calculation

#### 2. Get Learner Subscriptions
**Endpoint**: `GET /api/head/subscriptions/learners?page=1&per_page=10`

**Query Parameters**:
- `learner_id`: Filter by specific learner
- `status`: Filter by status (ACTIVE, EXPIRED, CANCELLED, etc.)
- `search`: Search by learner name or email

#### 3. Get Single Subscription Details
**Endpoint**: `GET /api/head/subscriptions/learners/{subscription_id}`

**Expected**: Full subscription details with:
- Learner information
- Package details
- Payment receipts list
- Session adjustment logs
- Event logs

#### 4. Cancel Subscription
**Endpoint**: `POST /api/head/subscriptions/learners/{subscription_id}/cancel`

**Request Body**:
```json
{
  "reason": "Learner requested cancellation",
  "refund_type": "PRORATED",
  "refund_amount": 2000.00
}
```

#### 5. Pause Subscription
**Endpoint**: `POST /api/head/subscriptions/learners/{subscription_id}/pause`

**Request Body**:
```json
{
  "pause_days": 15,
  "reason": "Medical leave"
}
```

**Validations to Test**:
- ✅ Cannot pause for more than 90 days (MAX_PAUSE_DAYS)
- ✅ Status changes to PAUSED
- ✅ Expiry date extends by pause days

#### 6. Resume Subscription
**Endpoint**: `POST /api/head/subscriptions/learners/{subscription_id}/resume`

**Expected**:
- Status changes back to ACTIVE
- Event log created

#### 7. Freeze Subscription
**Endpoint**: `POST /api/head/subscriptions/learners/{subscription_id}/freeze`

**Request Body**:
```json
{
  "freeze_days": 30,
  "reason": "Extended break"
}
```

#### 8. Renew Subscription
**Endpoint**: `POST /api/head/subscriptions/learners/{subscription_id}/renew`

**Request Body**:
```json
{
  "package_id": 1,
  "discount_code": "RENEW10"
}
```

**Expected**:
- New subscription created
- `renewed_to_subscription_id` set on old subscription

---

### C. Payment Receipts (HEAD Endpoints)

#### 1. Upload Payment Receipt
**Endpoint**: `POST /api/head/subscriptions/learners/{subscription_id}/receipts`

**Request Type**: `multipart/form-data`

**Form Data**:
- `file`: Image file (PNG, JPG, PDF)
- `payment_date`: "2026-01-17"
- `amount_paid`: 4000.00
- `payment_method`: "BANK_TRANSFER"
- `transaction_reference`: "TXN123456"
- `notes`: "Payment for January subscription"

**Expected Response** (201):
```json
{
  "id": 1,
  "subscription_id": 1,
  "uploaded_by_head_id": 2,
  "file_name": "receipt_20260117_123045.jpg",
  "file_path": "uploads/subscription_receipts/receipt_20260117_123045.jpg",
  "file_size": 245678,
  "storage_type": "local",
  "payment_date": "2026-01-17",
  "amount_paid": "4000.00",
  "payment_method": "BANK_TRANSFER",
  "transaction_reference": "TXN123456",
  "payment_status": "PENDING",
  "notes": "Payment for January subscription",
  "uploaded_at": "2026-01-17T12:00:00"
}
```

#### 2. Get Subscription Receipts
**Endpoint**: `GET /api/head/subscriptions/learners/{subscription_id}/receipts`

#### 3. Download Receipt
**Endpoint**: `GET /api/head/subscriptions/receipts/{receipt_id}/download`

**Expected**: File download with correct content-type

---

### D. Session Adjustments (HEAD Endpoints)

#### 1. Add Sessions
**Endpoint**: `POST /api/head/subscriptions/learners/{subscription_id}/sessions/add`

**Request Body**:
```json
{
  "sessions_to_add": 5,
  "reason": "Bonus sessions for consistent attendance"
}
```

**Validations**:
- ✅ Cannot add more than 10 sessions at once (MAX_SESSION_ADJUSTMENT)
- ✅ Sessions_remaining increases
- ✅ Event log created

#### 2. Subtract Sessions
**Endpoint**: `POST /api/head/subscriptions/learners/{subscription_id}/sessions/subtract`

**Request Body**:
```json
{
  "sessions_to_subtract": 2,
  "reason": "Correction for missed recording"
}
```

#### 3. Complete Session
**Endpoint**: `POST /api/head/subscriptions/learners/{subscription_id}/sessions/complete`

**Expected**:
- `sessions_completed` increments
- `sessions_remaining` decrements
- Event log created

#### 4. Get Session Adjustment History
**Endpoint**: `GET /api/head/subscriptions/learners/{subscription_id}/sessions/history`

---

### E. Admin Endpoints

#### 1. Create Discount Code (ADMIN)
**Endpoint**: `POST /api/admin/subscriptions/discounts`

**Headers**:
```json
{
  "Authorization": "Bearer <ADMIN_JWT_TOKEN>",
  "Content-Type": "application/json"
}
```

**Request Body**:
```json
{
  "code": "WELCOME20",
  "description": "20% off for new learners",
  "discount_type": "PERCENTAGE",
  "discount_value": 20,
  "valid_from": "2026-01-01",
  "valid_until": "2026-12-31",
  "max_usage_count": 100,
  "eligibility_criteria": {
    "min_package_price": 1000,
    "first_time_learners_only": true
  },
  "is_active": true
}
```

#### 2. Get All Discount Codes (ADMIN)
**Endpoint**: `GET /api/admin/subscriptions/discounts?page=1&per_page=20`

**Query Parameters**:
- `is_active`: Filter active/inactive codes
- `search`: Search by code

#### 3. Get Pending Payment Receipts (ADMIN)
**Endpoint**: `GET /api/admin/subscriptions/receipts/pending?page=1&per_page=20`

**Expected**: List of all pending payment receipts across all subscriptions

#### 4. Verify Payment Receipt (ADMIN)
**Endpoint**: `POST /api/admin/subscriptions/receipts/{receipt_id}/verify`

**Request Body**:
```json
{
  "status": "APPROVED",
  "notes": "Payment verified with bank"
}
```

**Test Cases**:
- ✅ Approve receipt: status changes to APPROVED
- ✅ Reject receipt: status changes to REJECTED
- ✅ Verify `verified_by_admin_id` and `verified_at` are set

#### 5. Get Subscription Statistics (ADMIN)
**Endpoint**: `GET /api/admin/subscriptions/statistics`

**Expected Response**:
```json
{
  "total_subscriptions": 150,
  "active_subscriptions": 120,
  "expired_subscriptions": 20,
  "cancelled_subscriptions": 10,
  "total_revenue": "750000.00",
  "pending_receipts": 15,
  "discount_codes_active": 8
}
```

---

## Frontend UI Testing

### 1. Manage Learning Package Manager (HEAD)
**URL**: `http://localhost:5173/head/subscriptions/packages`

**Test Scenarios**:

#### Create Package
1. Click "Add New Package" button
2. Fill form:
   - Package Name: "Basic Package"
   - Description: "15 sessions for beginners"
   - Sessions Count: 15
   - Validity Days: 30
   - Price: 3000
3. Click "Create Package"
4. ✅ Success notification appears
5. ✅ New package appears in list
6. ✅ Check sorting by creation date

#### Edit Package
1. Click edit icon on a package
2. Modify price to 3500
3. Click "Update Package"
4. ✅ Changes reflected immediately
5. ✅ Updated timestamp changes

#### Toggle Active Status
1. Click toggle switch on active package
2. ✅ Status changes to inactive
3. ✅ Visual indication of inactive state

#### Delete Package
1. Click delete icon
2. Confirm deletion
3. ✅ Package removed from list
4. ✅ Cannot delete if subscriptions exist (should show error)

#### Search & Filter
1. Enter package name in search box
2. ✅ List filters in real-time
3. Filter by active status
4. ✅ Only active/inactive packages shown

---

### 2. Learner Subscription Manager (HEAD)
**URL**: `http://localhost:5173/head/subscriptions/learners`

#### Create Subscription
1. Click "Assign New Subscription"
2. Select learner from dropdown
3. Select package
4. Enter discount code (optional): "WELCOME20"
5. Add notes
6. Click "Assign Subscription"
7. ✅ Subscription created with correct calculations
8. ✅ Discount applied correctly
9. ✅ Expiry date calculated correctly

#### View Subscription Details
1. Click "View Details" on a subscription
2. ✅ Modal/page shows:
   - Full subscription info
   - Learner details
   - Package details
   - Payment receipts
   - Session history
   - Event logs

#### Manage Subscription Status
1. Open subscription details
2. Click "Pause" button
3. Enter pause duration: 15 days
4. Enter reason
5. Click "Confirm Pause"
6. ✅ Status changes to PAUSED
7. ✅ Resume button appears
8. Click "Resume"
9. ✅ Status back to ACTIVE

#### Upload Payment Receipt
1. Open subscription details
2. Click "Upload Receipt"
3. Select image file
4. Fill payment details:
   - Payment Date
   - Amount Paid: 4000
   - Payment Method: Bank Transfer
   - Transaction Reference
5. Click "Upload"
6. ✅ Receipt appears in list with PENDING status
7. ✅ File preview available

#### Session Management
1. Click "Add Sessions"
2. Enter number: 5
3. Enter reason
4. ✅ Sessions remaining increases
5. ✅ History log updated
6. Click "Complete Session"
7. ✅ Sessions completed increments
8. ✅ Sessions remaining decrements

#### Renew Subscription
1. Open expired/near-expiry subscription
2. Click "Renew Subscription"
3. Select new package
4. Apply discount code
5. ✅ New subscription created
6. ✅ Old subscription linked to new one

---

### 3. Payment Verification (ADMIN)
**URL**: `http://localhost:5173/admin/subscriptions/receipts`

#### View Pending Receipts
1. Navigate to payment verification page
2. ✅ List shows all pending receipts
3. ✅ Learner name, subscription info visible
4. ✅ Amount and upload date shown

#### Verify Receipt
1. Click receipt to view details
2. Click "Download Receipt" to view file
3. Verify payment details
4. Click "Approve"
5. Enter verification notes
6. ✅ Status changes to APPROVED
7. ✅ Receipt moves out of pending list

#### Reject Receipt
1. Click "Reject" on suspicious receipt
2. Enter rejection reason
3. ✅ Status changes to REJECTED
4. ✅ HEAD notified (if notification system exists)

---

### 4. Discount Code Manager (ADMIN)
**URL**: `http://localhost:5173/admin/subscriptions/discounts`

#### Create Discount Code
1. Click "Create Discount Code"
2. Fill form:
   - Code: "NEWYEAR2026"
   - Discount Type: Percentage
   - Discount Value: 25
   - Valid From: 2026-01-01
   - Valid Until: 2026-01-31
   - Max Usage: 50
3. Set eligibility criteria (JSON)
4. Click "Create"
5. ✅ Code created and appears in list

#### Edit Discount Code
1. Click edit on code
2. Modify max usage to 100
3. Extend valid_until date
4. ✅ Changes saved

#### Deactivate Code
1. Toggle "Is Active" switch
2. ✅ Code becomes inactive
3. ✅ Cannot be used in new subscriptions

#### View Usage Statistics
1. Click on discount code
2. ✅ Shows usage count
3. ✅ Shows subscriptions using this code

---

### 5. Manage Payment Records (HEAD/ADMIN)
**URL**: `http://localhost:5173/subscriptions/records`

#### View All Subscriptions
1. ✅ Paginated list of subscriptions
2. ✅ Status badges (Active, Expired, Cancelled, etc.)
3. ✅ Learner names and emails
4. ✅ Package details

#### Advanced Filters
1. Filter by status: ACTIVE
2. ✅ Only active subscriptions shown
3. Filter by learner name
4. ✅ Search works correctly
5. Filter by date range
6. ✅ Results within range

#### Export Functionality (if implemented)
1. Click "Export to CSV"
2. ✅ CSV file downloads with subscription data

---

## End-to-End Test Scenarios

### Scenario 1: Complete Subscription Lifecycle

**Steps**:
1. **HEAD** creates a subscription package (30 sessions, 30 days, ₹5000)
2. **ADMIN** creates discount code "LAUNCH20" (20% off)
3. **HEAD** assigns subscription to learner with discount code
4. ✅ Verify net price: ₹4000 (20% discount applied)
5. ✅ Verify expiry date: 30 days from start
6. **HEAD** uploads payment receipt
7. ✅ Receipt status: PENDING
8. **ADMIN** approves payment receipt
9. ✅ Receipt status: APPROVED
10. **HEAD** marks 5 sessions as complete
11. ✅ Sessions remaining: 25
12. **HEAD** pauses subscription for 10 days
13. ✅ Expiry date extends by 10 days
14. **HEAD** resumes subscription
15. ✅ Status back to ACTIVE
16. Complete all remaining sessions
17. Wait for expiry date or manually expire
18. ✅ Status changes to EXPIRED (via background worker)
19. **HEAD** renews subscription with different package
20. ✅ New subscription created, linked to old one

---

### Scenario 2: Refund Flow

**Steps**:
1. Create active subscription
2. Learner completes 10 sessions out of 30
3. **HEAD** cancels subscription
4. Choose refund type: PRORATED
5. Calculate refund: (20 remaining / 30 total) × ₹5000 = ₹3333.33
6. Enter refund amount: ₹3333
7. ✅ Status changes to REFUNDED
8. ✅ Refund details recorded in database
9. ✅ Cannot perform any actions on refunded subscription

---

### Scenario 3: Session Adjustment

**Steps**:
1. Create subscription with 20 sessions
2. **HEAD** adds 5 bonus sessions
3. ✅ Total sessions: 25
4. ✅ Adjustment log created with reason
5. **HEAD** realizes mistake, subtracts 2 sessions
6. ✅ Total sessions: 23
7. ✅ Both adjustments visible in history
8. Try to add 15 sessions at once
9. ✅ Error: Maximum 10 sessions can be adjusted at once

---

### Scenario 4: Multiple Discount Code Validation

**Steps**:
1. **ADMIN** creates "WELCOME20" (20% off, first-time only)
2. **ADMIN** creates "RENEW10" (10% off, renewal only)
3. **HEAD** assigns first subscription to new learner with "WELCOME20"
4. ✅ Discount applied successfully
5. **HEAD** tries to use "WELCOME20" again for same learner
6. ✅ Error: Code only for first-time learners
7. After expiry, renew with "RENEW10"
8. ✅ 10% discount applied on renewal

---

## Database Verification

### Check Subscription Creation
```sql
-- View all subscriptions with learner details
SELECT 
    ls.id,
    ls.learner_id,
    u.full_name AS learner_name,
    ls.package_name,
    ls.status,
    ls.start_date,
    ls.expiry_date,
    ls.sessions_total,
    ls.sessions_completed,
    ls.sessions_remaining,
    ls.net_price_paid
FROM learner_subscriptions ls
JOIN users u ON ls.learner_id = u.id
ORDER BY ls.created_at DESC;
```

### Check Payment Receipts
```sql
-- View pending payment receipts
SELECT 
    spr.id,
    spr.subscription_id,
    ls.package_name,
    spr.file_name,
    spr.amount_paid,
    spr.payment_status,
    spr.uploaded_at
FROM subscription_payment_receipts spr
JOIN learner_subscriptions ls ON spr.subscription_id = ls.id
WHERE spr.payment_status = 'PENDING'
ORDER BY spr.uploaded_at DESC;
```

### Check Event Logs
```sql
-- View all events for a subscription
SELECT 
    id,
    event_type,
    event_data,
    created_by_role,
    created_at
FROM subscription_event_logs
WHERE subscription_id = 1
ORDER BY created_at DESC;
```

### Check Session Adjustments
```sql
-- View session adjustment history
SELECT 
    id,
    subscription_id,
    adjustment_type,
    adjustment_amount,
    reason,
    sessions_before,
    sessions_after,
    adjusted_by_role,
    created_at
FROM session_adjustment_logs
WHERE subscription_id = 1
ORDER BY created_at DESC;
```

### Check Discount Codes Usage
```sql
-- View discount code statistics
SELECT 
    sd.code,
    sd.discount_type,
    sd.discount_value,
    sd.usage_count,
    sd.max_usage_count,
    sd.is_active,
    COUNT(ls.id) AS actual_usage
FROM subscription_discounts sd
LEFT JOIN learner_subscriptions ls ON ls.discount_code = sd.code
GROUP BY sd.id
ORDER BY sd.created_at DESC;
```

---

## Background Workers Testing

### Test Expired Subscription Check

**Manual Trigger** (for testing):
```python
# In Python shell or test script
from app.workers.subscription_tasks import check_expired_subscriptions
import asyncio

asyncio.run(check_expired_subscriptions())
```

**Verification**:
1. Create subscription with expiry_date in past
2. Run worker task
3. ✅ Check database: status changed to EXPIRED
4. ✅ Check event logs: "subscription_expired" event created

### Test Pause/Freeze Expiration

**Setup**:
1. Create subscription with status PAUSED
2. Set `pause_until` date in past
3. Run worker task
4. ✅ Status changes back to ACTIVE

**Test Grace Period**:
1. Create subscription with expiry_date 6 days ago
2. Run worker task
3. ✅ Status still ACTIVE (within 7-day grace period)
4. Set expiry_date to 8 days ago
5. Run worker task
6. ✅ Status changes to EXPIRED

---

## Common Issues & Troubleshooting

### Issue 1: "Multiple classes found for path 'PaymentReceipt'"
**Cause**: Class name collision between subscription and ecommerce models  
**Solution**: Renamed subscription model to `SubscriptionPaymentReceipt`

### Issue 2: Migration fails with "type already exists"
**Cause**: Enum types left from previous failed migrations  
**Solution**: 
```bash
python drop_enums.py
alembic upgrade head
```

### Issue 3: Cannot upload payment receipt
**Cause**: File upload directory doesn't exist  
**Solution**: Ensure `uploads/subscription_receipts/` directory exists and has write permissions

### Issue 4: Discount code not applying
**Check**:
- Code is active (`is_active=true`)
- Current date within valid range
- Usage count < max_usage_count
- Eligibility criteria met (check `eligibility_criteria` JSON)

### Issue 5: Frontend shows 500 errors
**Check**:
- Backend server running
- CORS settings correct
- JWT token valid and not expired
- User has correct role/permissions

### Issue 6: Sessions not completing
**Verify**:
- Subscription status is ACTIVE
- Sessions remaining > 0
- User has HEAD role
- Subscription belongs to HEAD's learners

### Issue 7: Background workers not running
**Solution**:
- For development: Workers run automatically with FastAPI
- For production: Set up proper task scheduler (Celery, APScheduler, or cron jobs)

---

## Test Checklist

### Backend API
- [ ] All package CRUD operations work
- [ ] All subscription CRUD operations work
- [ ] Payment receipt upload/download works
- [ ] Session adjustments work correctly
- [ ] Discount code validation works
- [ ] Admin endpoints accessible only by admins
- [ ] HEAD endpoints accessible only by heads
- [ ] Proper error messages for validation failures
- [ ] Pagination works on all list endpoints
- [ ] Search and filter work correctly

### Frontend UI
- [ ] All forms validate input correctly
- [ ] Success/error notifications appear
- [ ] Tables show correct data
- [ ] Pagination controls work
- [ ] Search filters work
- [ ] File upload shows progress
- [ ] Download links work
- [ ] Modal dialogs open/close properly
- [ ] Responsive design on mobile
- [ ] Loading states show during API calls

### Business Logic
- [ ] Discount calculations correct
- [ ] Session tracking accurate
- [ ] Date calculations correct (expiry, pause, freeze)
- [ ] Status transitions valid
- [ ] Refund calculations accurate
- [ ] Event logs created for all actions
- [ ] Cannot exceed system limits (MAX_PAUSE_DAYS, etc.)

### Database
- [ ] All foreign keys valid
- [ ] Cascading deletes work
- [ ] Indexes created for performance
- [ ] Enum types correct
- [ ] Constraints enforced

### Security
- [ ] JWT authentication required
- [ ] Role-based authorization works
- [ ] File uploads validated (type, size)
- [ ] SQL injection prevented
- [ ] XSS protection in place

---

## Performance Testing

### Load Testing (Optional)

**Using Apache Bench or similar**:
```bash
# Test package listing
ab -n 1000 -c 10 -H "Authorization: Bearer <token>" \
  http://127.0.0.1:8000/api/head/subscriptions/packages

# Test subscription creation
ab -n 100 -c 5 -p subscription.json -T "application/json" \
  -H "Authorization: Bearer <token>" \
  http://127.0.0.1:8000/api/head/subscriptions/learners
```

**Benchmarks**:
- List packages: < 100ms
- Create subscription: < 200ms
- Upload receipt: < 500ms
- Search/filter: < 150ms

---

## Conclusion

This testing guide covers comprehensive testing of the Subscription Management System. Follow the scenarios in order, and use the checklist to ensure all features work correctly before deployment.

For any issues not covered here, check:
1. Backend logs: `hurshbintech-backend/logs/`
2. Browser console for frontend errors
3. PostgreSQL logs for database issues
4. FastAPI automatic docs: `http://127.0.0.1:8000/docs`

**Happy Testing! 🚀**
