# Guest Booking Flow - Complete Implementation Map

## Flow Overview

```
Step 1: Guest OTP Verification (GUEST_INTENT)
   ↓
Step 2: Guest Creates Booking Intent
   ↓
Step 3: Coach Receives Email → Dashboard Approval/Rejection
   ↓
Step 4: If Approved → Upload Token Generated + Payment Link Email
   ↓
Step 5: Guest Uploads Payment Receipt (PAYMENT_PENDING)
   ↓
Step 6: Coach Reviews Payment → Dashboard Confirmation (VERIFICATION_PENDING → CONFIRMED)
```

---

## 1️⃣ GUEST OTP VERIFICATION (Step 1)

**Endpoint:** `POST /api/booking/guest/send-otp`
- Guest enters email
- System generates 6-digit OTP
- OTP sent via email

**Endpoint:** `POST /api/booking/guest/verify-otp`
- Guest enters OTP (Step 1 verification only - doesn't mark as used)
- Returns success/error

---

## 2️⃣ GUEST CREATES BOOKING INTENT (Step 2)

**Endpoint:** `POST /api/booking/guest/verify-otp-and-create-intent`
- Guest submits: guest_name, email, phone, coach_id, scheduled_date, scheduled_time, session_type, notes
- Creates `Appointment` with **status = GUEST_INTENT**
- Marks OTP as used (one-time only)

**Database State:**
```
appointments table:
- id: auto
- coach_id: selected coach
- user_id: NULL (no authenticated user)
- user_role: NULL
- guest_name: "John Doe"
- guest_email: "john@example.com"
- guest_phone: "7507425042"
- scheduled_date: "2025-12-26"
- scheduled_time: "10am"
- status: "GUEST_INTENT" ← Coach needs to review
- upload_token: NULL (not yet generated)
- session_type: "initial_consultation"
```

**Email Sent to Coach:**
- Subject: "New Guest Booking Request"
- Contains: Guest details, appointment details
- **ACTION LINK:** "View on Dashboard" → Coach Dashboard

---

## 3️⃣ COACH APPROVES/REJECTS GUEST INTENT (Dashboard)

**Where?** → **Coach Dashboard at `/coach/dashboard`**

**Location in Code:** [app/api/endpoints/coach.py](app/api/endpoints/coach.py#L344)

**Endpoint (Approve):** `PATCH /api/coaches/appointments/{appointment_id}`
```
Request Body:
{
  "status": "CONFIRMED"  ← Change from GUEST_INTENT → CONFIRMED
}

What Happens:
1. System generates secure upload_token (UUID)
2. Sets upload_token_expires_at (24 hours from now)
3. Saves to database
4. Sends email to guest with payment upload link
```

**Endpoint (Reject):** `POST /api/coaches/appointments/{appointment_id}/reject`
```
Request Body:
{
  "rejection_reason": "Schedule conflict",
  "refund_receipt_url": (optional file upload)
}

What Happens:
1. Sets status = "REJECTED"
2. Saves rejection reason
3. Sends email to guest with rejection notice
```

---

## 4️⃣ COACH APPROVES → GUEST GETS UPLOAD TOKEN

**What the Coach Dashboard Shows (for GUEST_INTENT appointments):**
- Guest name, email, phone
- Requested date/time
- Status badge: "Guest Intent Pending Review"
- Buttons: "Approve" | "Reject"

**When Coach Clicks "Approve":**

1. **Upload Token Generated:**
   ```python
   upload_token = str(uuid.uuid4())  # e.g., "a1b2c3d4-e5f6-g7h8..."
   upload_token_expires_at = datetime.utcnow() + timedelta(hours=24)
   ```

2. **Email Sent to Guest:**
   - Subject: "Your Appointment is Approved! Upload Payment Receipt"
   - Contains: Payment upload link with secure token
   - Link: `http://localhost:5173/booking/upload-payment?token={upload_token}&appointment_id={appointment_id}`
   - Note: Token valid for 24 hours only

3. **Database Updated:**
   ```
   status: "CONFIRMED"
   upload_token: "a1b2c3d4-e5f6-g7h8..."
   upload_token_expires_at: "2025-12-24 10:12:00"
   ```

---

## 5️⃣ GUEST UPLOADS PAYMENT RECEIPT (Step 3)

**Endpoint:** `POST /api/booking/guest/upload-payment-receipt`
- Guest opens email link with secure token
- Guest uploads payment screenshot/receipt
- System validates token (not expired, correct appointment)

**Endpoint Code Location:** [app/api/endpoints/booking.py](app/api/endpoints/booking.py) (needs implementation)

**What Happens:**
1. Validates token hasn't expired
2. Saves payment screenshot to local uploads or S3
3. Updates appointment: status = "PAYMENT_PENDING"
4. Sends email to coach: "Guest Uploaded Payment - Review Required"

**Database State After Upload:**
```
appointments table:
- status: "PAYMENT_PENDING" ← Coach needs to review receipt
- payment_receipt_url: "uploads/payment_screenshots/uuid.jpg"
- upload_token: still set (for reference)
```

---

## 6️⃣ COACH REVIEWS PAYMENT (Dashboard)

**Where?** → **Coach Dashboard - Payment Review Tab**

**Endpoint:** `PATCH /api/coaches/appointments/{appointment_id}`
```
Request Body:
{
  "status": "CONFIRMED"  ← Change from PAYMENT_PENDING → CONFIRMED
}

OR for rejection:

POST /api/coaches/appointments/{appointment_id}/reject
{
  "rejection_reason": "Payment details unclear, please resubmit"
}
```

**What Coach Sees in Dashboard:**
- Appointment details
- Guest payment screenshot (clickable thumbnail)
- Status badge: "Payment Pending Review"
- Buttons: "Confirm Payment" | "Reject & Request Resubmission"

**When Coach Clicks "Confirm Payment":**
1. Status changes: PAYMENT_PENDING → CONFIRMED
2. Email sent to guest: "Appointment Confirmed! Session Details..."
3. Appointment is now CONFIRMED and ready

---

## Current Implementation Status

✅ **Implemented:**
- Guest OTP send & verify
- Guest booking intent creation (GUEST_INTENT)
- Coach receives email with dashboard link
- Coach update endpoint (approve/reject)
- Coach reject endpoint with reason

⏳ **Needs Implementation:**
- Coach Dashboard UI to display GUEST_INTENT appointments separately
- Guest payment upload endpoint
- Payment receipt validation by coach
- Email with secure payment upload link (when coach approves)

---

## Database Status Values for Guest Bookings

| Status | Triggered By | Next Step | Where in Dashboard |
|--------|-------------|-----------|-------------------|
| GUEST_INTENT | Guest submits booking | Coach approves/rejects | "Pending Guest Reviews" |
| CONFIRMED | Coach approves GUEST_INTENT | Guest receives upload link | - (awaiting payment) |
| PAYMENT_PENDING | Guest uploads receipt | Coach reviews payment | "Payment Reviews" |
| CONFIRMED | Coach confirms payment | Appointment locked | Scheduled |
| REJECTED | Coach rejects at any stage | Guest receives reason | - (booking cancelled) |

---

## Email Notifications Sequence

```
1. OTP Email → Guest
   "Verify your email with 6-digit code"

2. Guest Intent Email → Coach
   "New booking request from {guest_name}"
   Link: Dashboard approval/rejection

3. Approval Confirmation → Guest
   "Your appointment approved! Upload payment receipt"
   Link: Secure upload link with token

4. Payment Request → Coach
   "Guest uploaded payment receipt - review needed"
   Link: Dashboard to review

5. Final Confirmation → Guest
   "Appointment confirmed! Here are your details..."
```

---

## API Summary for Coach Dashboard

**All endpoints authenticated** (coach login required)

### View Guest Intent Appointments
- GET `/api/coaches/appointments` 
- Returns all appointments including GUEST_INTENT status
- Filter by `status=GUEST_INTENT` on frontend

### Approve Guest Booking
- PATCH `/api/coaches/appointments/{appointment_id}`
- Body: `{ "status": "CONFIRMED" }`
- Generates upload_token automatically

### Reject Guest Booking
- POST `/api/coaches/appointments/{appointment_id}/reject`
- Body: `{ "rejection_reason": "...", "refund_receipt_url": ... }`

### Review Payment
- GET `/api/coaches/appointments/{appointment_id}`
- Shows payment_receipt_url for viewing
- PATCH to confirm or reject payment

---

## Next Steps to Complete Flow

1. **Create guest payment upload endpoint** 
   - Validate token and expiry
   - Save payment receipt
   - Update status to PAYMENT_PENDING

2. **Update coach dashboard** 
   - Filter appointments by GUEST_INTENT
   - Show payment screenshots in payment review tab
   - Add "Confirm Payment" button

3. **Send email with upload token**
   - Modify coach approval email template
   - Include secure guest upload link
   - Show token validity (24 hours)
