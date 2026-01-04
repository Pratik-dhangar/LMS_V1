# Guest User Session Implementation Guide

## Overview
This document describes the complete implementation for allowing guest users (non-authenticated users) to join coach sessions via a secure token-based link sent in their confirmation email.

## Problem Statement
Previously, only registered users could join coach sessions. Guest users who booked appointments received confirmation emails but had no way to join the actual video session with their coach.

## Solution Architecture

### High-Level Flow
1. **Guest Books Appointment** → Creates appointment with status `GUEST_INTENT`
2. **Coach Approves** → Status stays `GUEST_INTENT`, payment upload link sent
3. **Guest Uploads Payment** → Status changes to `VERIFICATION_PENDING`
4. **Coach Confirms Payment** → Status changes to `CONFIRMED`, **guest_session_token generated**, email sent with session join link
5. **Coach Starts Session** → Creates `CoachAppointmentSession` record
6. **Guest Clicks Link** → Authenticates with token, joins video session

---

## Backend Implementation

### 1. Database Changes

#### Migration File
**Location:** `alembic/versions/guest_session_001_add_guest_session_token.py`

**Purpose:** Add guest session authentication tokens to appointments table

**Fields Added:**
- `guest_session_token` (String, unique): Secure UUID token for guest to access session
- `guest_session_token_expires_at` (DateTime): Token expiration timestamp

#### Model Update
**File:** `app/models/user_model.py` → `Appointment` model

**Added Fields:**
```python
guest_session_token = Column(String(100), nullable=True, unique=True, index=True)
guest_session_token_expires_at = Column(DateTime, nullable=True)
```

### 2. API Schemas

**File:** `app/schemas/guest_session.py` (NEW FILE)

**Purpose:** Define request/response schemas for guest session authentication

**Key Schemas:**
- `GuestSessionAuthRequest`: Contains token for authentication
- `GuestSessionDetails`: Returns session details after successful authentication
- `GuestSessionTokenResponse`: Used when generating token (not currently exposed)

### 3. Guest Session Endpoints

**File:** `app/api/endpoints/guest_sessions.py` (NEW FILE)

**Router Prefix:** `/api/guest-sessions`

**Endpoints:**

#### POST `/api/guest-sessions/auth`
- **Purpose:** Authenticate guest user and return session details
- **Authentication:** None (public endpoint - uses token in request body)
- **Request Body:**
  ```json
  {
    "token": "uuid-token-from-email"
  }
  ```
- **Response:**
  ```json
  {
    "session_id": "string",
    "coach_name": "string",
    "client_name": "string",
    "scheduled_date": "2026-01-05",
    "scheduled_time": "10am",
    "duration": 60,
    "status": "scheduled",
    "appointment_id": 123,
    "guest_email": "guest@example.com",
    "guest_name": "Guest User"
  }
  ```
- **Validation Checks:**
  - Token exists in database
  - Token hasn't expired
  - Appointment is for a guest user
  - Appointment status is `CONFIRMED`
  - Session exists and is active/scheduled

#### GET `/api/guest-sessions/validate/{token}`
- **Purpose:** Quick validation without full session details
- **Authentication:** None
- **Response:**
  ```json
  {
    "valid": true,
    "guest_name": "Guest User",
    "scheduled_date": "2026-01-05",
    "scheduled_time": "10am"
  }
  ```

### 4. Token Generation Logic

**File:** `app/api/endpoints/coach.py` → `update_appointment` function

**When:** Coach changes guest appointment status from `VERIFICATION_PENDING` to `CONFIRMED`

**Implementation:**
```python
# Generate secure token (UUID v4)
guest_session_token = str(uuid.uuid4())
updated.guest_session_token = guest_session_token
updated.guest_session_token_expires_at = datetime.utcnow() + timedelta(days=7)

# Build session link
guest_session_link = f"{settings.FRONTEND_URL}/guest-session/{guest_session_token}"

# Send email with link
await EmailService.send_guest_appointment_confirmed_with_session_link(...)
```

**Security Features:**
- Cryptographically secure UUID
- 7-day expiration (configurable)
- One-time use per appointment
- Tied to specific appointment record

### 5. Email Service Update

**File:** `app/services/email_service.py`

**New Method:** `send_guest_appointment_confirmed_with_session_link()`

**Purpose:** Send confirmation email to guest users with embedded session join link

**Key Features:**
- Professional HTML email template
- Prominent "Join Session" button
- Session details table (coach, date, time, type, reference ID)
- Security notice about unique link
- Instructions for joining

**Template Highlights:**
```html
<div class="session-link-box">
  <h3>🎥 Join Your Video Session</h3>
  <a href="{session_link}" class="btn">Join Session</a>
</div>
```

---

## Frontend Implementation

### 1. Guest Session Component

**File:** `src/pages/guest/GuestSession.jsx` (NEW FILE)

**Based On:** `ClientSession.jsx` (maintains UI/UX consistency)

**Key Differences from ClientSession:**
- **No localStorage user_data check** - uses token from URL
- **Authentication via API call** instead of auth context
- **Uses 'client' role for WebRTC** (compatible with existing backend)
- **Error screen for invalid/expired tokens**
- **Welcome screen shows guest name and coach name**

**Component Structure:**

```jsx
const GuestSession = () => {
  const { token } = useParams(); // Get token from URL
  
  // Same state as ClientSession (webRTC, streams, whiteboard, etc.)
  
  // NEW: Guest-specific state
  const [guestInfo, setGuestInfo] = useState(null);
  const [authError, setAuthError] = useState(null);
  
  // Authenticate on mount
  useEffect(() => {
    authenticateGuestSession();
  }, [token]);
  
  const authenticateGuestSession = async () => {
    const response = await axios.post('/api/guest-sessions/auth', { token });
    setSessionInfo(response.data);
    setGuestInfo({
      name: response.data.guest_name,
      email: response.data.guest_email
    });
    await initializeWebRTC(response.data.session_id);
  };
  
  // Rest of component identical to ClientSession
}
```

**Authentication Flow:**
1. Extract token from URL params
2. Call `/api/guest-sessions/auth` endpoint
3. If valid: Store session info, initialize WebRTC
4. If invalid: Show error screen with return home button

**WebRTC Initialization:**
- Uses same `VideoConferenceService` and `WhiteboardService` as authenticated clients
- Role set to `'client'` for backend compatibility
- No changes needed to existing WebSocket infrastructure

**UI Features:**
- Same whiteboard, video, and controls as authenticated clients
- Waiting screen when coach hasn't joined
- Connection status indicator
- Mic/camera toggle buttons
- Leave session button (redirects to homepage)

### 2. Routing Configuration

**File:** `src/App.jsx`

**Route Added:**
```jsx
<Route path="/guest-session/:token" element={<GuestSession />} />
```

**Location:** In the public routes section (no `ProtectedRoute` wrapper)

**Import Added:**
```jsx
import GuestSession from './pages/guest/GuestSession';
```

---

## Security Considerations

### Token Security
1. **UUID v4 Tokens:** Cryptographically secure, unpredictable
2. **Unique Constraint:** Each token can only be used for one appointment
3. **Expiration:** Tokens expire after 7 days
4. **Single Use:** Token tied to specific appointment
5. **No PII in Token:** Token is random, doesn't contain personal info

### Access Control
1. **Public Endpoint:** Guest auth endpoint requires no authentication
2. **Validation Checks:** Multiple checks before granting access:
   - Token exists
   - Token not expired
   - Appointment is guest appointment
   - Appointment status is CONFIRMED
   - Session exists and is active
3. **No Persistence:** Guest info not stored in browser (session-only)

### Email Security
1. **Unique Links:** Each guest gets unique link
2. **Security Notice:** Email warns not to share link
3. **HTTPS Only:** Session links use HTTPS in production

---

## User Journey

### Guest User Perspective

1. **Booking:**
   - Fill out booking form on website
   - Enter email, verify with OTP
   - Submit appointment request

2. **Approval:**
   - Receive email: "Coach approved your booking, upload payment"
   - Upload payment screenshot

3. **Confirmation:** ✨ **NEW**
   - Receive email: "Appointment Confirmed - Join Your Session"
   - Email contains:
     - Appointment details (date, time, coach)
     - Big "Join Session" button with unique link
     - Instructions to save email

4. **Joining Session:**
   - Click "Join Session" link on scheduled date
   - Browser opens to `/guest-session/{token}`
   - Page authenticates token automatically
   - Shows waiting screen if coach hasn't joined
   - Joins video session when coach starts

5. **During Session:**
   - See coach's video feed
   - Share own camera/mic
   - View whiteboard and learning materials
   - Send messages to coach
   - Same experience as registered users

6. **End Session:**
   - Click "Leave Session" button
   - Redirected to homepage

### Coach Perspective

1. **Review Guest Appointment:**
   - See guest booking in dashboard
   - Status: `VERIFICATION_PENDING`

2. **Confirm Payment:**
   - Review payment screenshot
   - Change status to `CONFIRMED`
   - ✨ **NEW:** Guest automatically receives email with session link

3. **Start Session:**
   - Click "Start Session" on appointment
   - Creates session, joins video call
   - Guest joins using their link
   - **No difference between guest and registered clients during session**

---

## Testing Checklist

### Backend Tests
- [ ] Token generation creates valid UUID
- [ ] Token expiration is set correctly
- [ ] Auth endpoint rejects invalid token
- [ ] Auth endpoint rejects expired token
- [ ] Auth endpoint rejects non-CONFIRMED appointments
- [ ] Auth endpoint returns correct session details
- [ ] Email service sends guest confirmation email

### Frontend Tests
- [ ] Guest session page loads with valid token
- [ ] Error screen shows for invalid token
- [ ] Error screen shows for expired token
- [ ] WebRTC initializes correctly
- [ ] Whiteboard syncs with coach
- [ ] Video/audio controls work
- [ ] Leave session redirects properly

### Integration Tests
- [ ] End-to-end guest booking → payment → confirmation → session join
- [ ] Coach can see guest in session
- [ ] Guest can interact with whiteboard
- [ ] Session recordings capture guest participant

---

## Deployment Steps

### 1. Database Migration
```bash
cd hurshbintech-backend
alembic upgrade head
```

### 2. Backend Deployment
- Deploy updated backend code
- Verify new endpoint is accessible
- Test email sending in production

### 3. Frontend Deployment
- Build frontend with new component
- Deploy to production
- Verify route is accessible

### 4. Environment Variables
Ensure these are set:
- `FRONTEND_URL`: Base URL for generating session links
- `ENABLE_EMAIL`: Set to `true`
- `BREVO_API_KEY`: For sending emails

### 5. Verification
1. Create test guest appointment
2. Confirm payment as coach
3. Check email received with link
4. Click link and verify session loads
5. Test video/whiteboard functionality

---

## Future Enhancements

### Potential Improvements
1. **SMS Notifications:** Send session link via SMS in addition to email
2. **Reminder Emails:** Send reminder 24h and 1h before session
3. **Token Refresh:** Allow guest to request new link if expired
4. **Session History:** Allow guest to view past session recordings
5. **Guest Feedback:** Collect post-session feedback from guests
6. **Auto-Invalidation:** Invalidate token immediately after session ends
7. **Rate Limiting:** Limit authentication attempts per token
8. **Logging:** Enhanced logging for security audits

### Mobile App Support
- Generate deep links for mobile app
- Add "Open in App" button in email
- Support native video on mobile

---

## Troubleshooting

### Common Issues

**Issue:** "Invalid session link" error
- **Cause:** Token expired or doesn't exist
- **Solution:** Guest should contact coach for new appointment

**Issue:** "Appointment not confirmed yet"
- **Cause:** Coach hasn't approved payment
- **Solution:** Wait for coach to confirm, or contact coach

**Issue:** "Session not started yet" waiting screen
- **Cause:** Coach hasn't started the session
- **Solution:** Wait for scheduled time, coach will start session

**Issue:** Video/audio not working
- **Cause:** Browser permissions or network issues
- **Solution:** Check browser permissions, refresh page, try different browser

**Issue:** Email not received
- **Cause:** Email in spam, incorrect email address
- **Solution:** Check spam folder, verify email with coach

---

## API Reference

### Guest Session Authentication
```
POST /api/guest-sessions/auth
Content-Type: application/json

Request:
{
  "token": "550e8400-e29b-41d4-a716-446655440000"
}

Response (200 OK):
{
  "session_id": "12345",
  "coach_name": "John Doe",
  "client_name": "Jane Smith",
  "scheduled_date": "2026-01-05",
  "scheduled_time": "10am",
  "duration": 60,
  "status": "scheduled",
  "appointment_id": 456,
  "guest_email": "jane@example.com",
  "guest_name": "Jane Smith"
}

Errors:
404 - Token not found
403 - Token expired or appointment not confirmed
400 - Not a guest appointment
```

### Token Validation
```
GET /api/guest-sessions/validate/{token}

Response (200 OK):
{
  "valid": true,
  "guest_name": "Jane Smith",
  "scheduled_date": "2026-01-05",
  "scheduled_time": "10am"
}

OR

{
  "valid": false,
  "message": "Token expired"
}
```

---

## File Changes Summary

### New Files Created
1. `backend/app/schemas/guest_session.py` - Pydantic schemas
2. `backend/app/api/endpoints/guest_sessions.py` - API endpoints
3. `backend/alembic/versions/guest_session_001_add_guest_session_token.py` - DB migration
4. `frontend/src/pages/guest/GuestSession.jsx` - Guest session component
5. `docs/GUEST_SESSION_IMPLEMENTATION.md` - This documentation

### Modified Files
1. `backend/app/models/user_model.py` - Added token fields to Appointment
2. `backend/app/api/endpoints/coach.py` - Token generation on confirmation
3. `backend/app/services/email_service.py` - New email template
4. `backend/main.py` - Registered guest_sessions router
5. `frontend/src/App.jsx` - Added guest session route

---

## Contact & Support

For questions or issues with this implementation:
- Backend: Check logs in `backend/logs/`
- Frontend: Check browser console
- Email: Verify Brevo API logs
- Database: Check appointments table for token values

**Implementation Date:** January 4, 2026
**Last Updated:** January 4, 2026
**Version:** 1.0.0
