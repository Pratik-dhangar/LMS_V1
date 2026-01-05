# Coach-Client-Guest Session Implementation Guide

## Overview

The coach appointment session system enables one-on-one video conferencing between coaches and their clients (registered users or guest users). The implementation reuses the WebRTC and whiteboard infrastructure from training sessions but adapts it for appointment-based scheduling.

## Architecture

### Key Components

1. **Appointment Model** - Scheduled time slot with optional guest booking
2. **CoachAppointmentSession** - Video session linked to an appointment
3. **WebSocket Services** - Real-time communication for WebRTC signaling and whiteboard sync
4. **Guest Token System** - Secure access for non-authenticated guest users

## Data Flow

### 1. Appointment Creation → Session Creation → Guest Access

```
Coach Creates Appointment
    ↓
Guest Books via Email Link (Optional)
    ↓
Coach Confirms Appointment
    ↓
System Creates CoachAppointmentSession
    ↓
Guest Session Token Generated
    ↓
Guest Receives Email with Access Link
    ↓
Guest Joins Session via Token
```

## Database Models

### Appointment Model
Located in [app/models/user_model.py](app/models/user_model.py)

```python
class Appointment(Base):
    __tablename__ = "appointments"
    
    id: int (Primary Key)
    coach_id: int (FK to CoachProfile)
    user_id: Optional[int] (FK to User - NULL for guest bookings)
    scheduled_date: Date (e.g., 2024-01-15)
    scheduled_time: String (e.g., "10am", "1pm", "3pm", "5pm")
    duration: int (in minutes, default 60)
    
    # Guest booking fields
    guest_name: Optional[str]
    guest_email: Optional[str]
    
    # Session access
    guest_session_token: Optional[str] (UUID for guest access)
    guest_session_token_expires_at: Optional[DateTime]
    
    # Relationships
    appointment_session: Optional[CoachAppointmentSession] (1-to-1)
    coach: CoachProfile
    user: Optional[User] (for registered user appointments)
    
    status: AppointmentStatus (PENDING, CONFIRMED, COMPLETED, CANCELLED)
```

**Key Fields:**
- `scheduled_date + scheduled_time` - Combined for datetime (NOT `appointment_time`)
- `guest_session_token` - Unique token for guest access (like UUID)
- `user_id` is NULL for guest bookings, populated for registered user bookings

### CoachAppointmentSession Model
Located in [app/models/coach_session_model.py](app/models/coach_session_model.py)

```python
class CoachAppointmentSession(Base):
    __tablename__ = "coach_appointment_sessions"
    
    id: int (Primary Key)
    session_id: str (Unique - format: "coach_session_XXXX")
    appointment_id: int (FK to Appointment)
    
    # Participants
    coach_id: int (FK to CoachProfile)
    client_user_id: Optional[int] (FK to User - NULL for guest sessions)
    client_name: str (from User.name or guest_name)
    client_email: str (from User.email or guest_email)
    
    # Session info
    title: str (auto-generated)
    description: Optional[str]
    scheduled_date: DateTime (combined date + time)
    duration: int (minutes, default 60)
    session_type: Optional[str] (e.g., "coaching", "training")
    
    # Status and timing
    status: str (scheduled, active, ended, cancelled)
    started_at: Optional[DateTime]
    ended_at: Optional[DateTime]
    notes: Optional[str]
    
    # Recording
    recording_url: Optional[str]
    recording_status: Optional[str]
    recording_uploaded_at: Optional[DateTime]
    
    # Relationships
    appointment: Appointment (1-to-1)
    coach: CoachProfile
    client_user: Optional[User] (nullable)
```

## Session Lifecycle

### 1. Session Creation (Appointment → Session)
**Endpoint:** `POST /api/coach-sessions/create`
**Handler:** [coach_appointment_sessions.py#L103](coach_appointment_sessions.py#L103)
**CRUD:** [coach_appointment_session_crud.py#L65](coach_appointment_session_crud.py#L65)

```python
async def create_session_from_appointment(
    db: AsyncSession,
    session_data: CoachSessionCreate,
    coach_id: int
) -> CoachAppointmentSession:
    """
    Automatically called when coach confirms an appointment
    """
    # 1. Validate appointment exists and is confirmed
    appointment = await db.get(Appointment, session_data.appointment_id)
    if not appointment or appointment.status != AppointmentStatus.CONFIRMED:
        raise ValueError("Appointment not confirmed")
    
    # 2. Check if session already exists (prevent duplicates)
    existing = await get_session_by_appointment(db, session_data.appointment_id)
    if existing:
        return existing
    
    # 3. Determine client info (registered user or guest)
    if appointment.user_id:
        # Registered user booking
        client_user_id = appointment.user_id
        client_name = user.name
        client_email = user.email
    else:
        # Guest booking
        client_user_id = None  # Important: NULL for guests
        client_name = appointment.guest_name
        client_email = appointment.guest_email
    
    # 4. Parse appointment time into datetime
    time_mapping = {
        "10am": time(10, 0),
        "1pm": time(13, 0),
        "3pm": time(15, 0),
        "5pm": time(17, 0)
    }
    scheduled_time = time_mapping.get(appointment.scheduled_time, time(10, 0))
    scheduled_datetime = datetime.combine(appointment.scheduled_date, scheduled_time)
    
    # 5. Create session
    session_id = f"coach_session_{str(uuid.uuid4())[:8]}"
    new_session = CoachAppointmentSession(
        session_id=session_id,
        appointment_id=appointment.id,
        coach_id=coach_id,
        client_user_id=client_user_id,
        client_name=client_name,
        client_email=client_email,
        title=f"Coaching Session with {client_name}",
        scheduled_date=scheduled_datetime,
        duration=session_data.duration,
        status="scheduled"
    )
    
    # 6. Generate guest session token if guest
    if not appointment.user_id:
        appointment.guest_session_token = str(uuid.uuid4())
        appointment.guest_session_token_expires_at = datetime.utcnow() + timedelta(days=7)
    
    db.add(new_session)
    await db.commit()
    return new_session
```

**Key Points:**
- Session is created in "scheduled" status
- `client_user_id` is NULL for guest sessions (important for authorization)
- Time is parsed from "10am"/"1pm"/"3pm"/"5pm" format
- Guest token generated with 7-day expiry

### 2. Session Start (Time Window Validation)
**Endpoint:** `POST /api/coach-sessions/{session_id}/start`
**Handler:** [coach_appointment_sessions.py#L186](coach_appointment_sessions.py#L186)
**CRUD:** [coach_appointment_session_crud.py#L190](coach_appointment_session_crud.py#L190)

```python
async def start_session(db: AsyncSession, session_id: str) -> CoachAppointmentSession:
    """
    Coach starts a scheduled session
    - Validates time window (must be within 2 hours of scheduled time)
    - Transitions status from 'scheduled' to 'active'
    """
    session = await get_session_by_id(db, session_id)
    
    if session.status == "active":
        # Resume active session (coach rejoining)
        return session
    
    if session.status == "scheduled":
        # Check time window
        appointment = await db.get(Appointment, session.appointment_id)
        
        # Parse scheduled datetime
        time_mapping = {
            "10am": time(10, 0),
            "1pm": time(13, 0),
            "3pm": time(15, 0),
            "5pm": time(17, 0)
        }
        scheduled_time = time_mapping.get(appointment.scheduled_time, time(10, 0))
        scheduled_datetime = datetime.combine(appointment.scheduled_date, scheduled_time)
        
        # Calculate expiry (2 hours after scheduled time)
        expiry_time = scheduled_datetime + timedelta(hours=2)
        
        # Verify current time is within window
        if datetime.now() > expiry_time:
            raise ValueError("Session window has expired. Must start within 2 hours of scheduled time.")
        
        # Start session
        session.status = "active"
        session.started_at = datetime.now()
        await db.commit()
        return session
    
    raise ValueError(f"Cannot start session in {session.status} state")
```

**Time Window Example:**
- Scheduled: 2024-01-15 10:00 AM
- Window Opens: 2024-01-15 10:00 AM
- Window Closes: 2024-01-15 12:00 PM (2 hours later)
- Session must start before 12:00 PM

### 3. Session End
**Endpoint:** `POST /api/coach-sessions/{session_id}/end`
**Handler:** [coach_appointment_sessions.py#L207](coach_appointment_sessions.py#L207)
**CRUD:** [coach_appointment_session_crud.py#L254](coach_appointment_session_crud.py#L254)

```python
async def end_session(db: AsyncSession, session_id: str, notes: Optional[str] = None):
    """
    - Changes status from 'active' to 'ended'
    - Updates associated appointment to COMPLETED
    """
    session.status = "ended"
    session.ended_at = datetime.now()
    
    # Update appointment
    appointment.status = AppointmentStatus.COMPLETED
    
    await db.commit()
```

## Guest Appointment Payment Workflow

### Status Flow (Fixed)
```
Guest sends appointment request
    ↓
PENDING → GUEST_INTENT (initial state)
    ↓
Coach sends payment link ("Approve" button)
    ↓
VERIFICATION_PENDING (payment link sent, waiting for guest upload)
    ↓
Guest uploads payment screenshot via link
    ↓
VERIFICATION_PENDING (coach reviews receipt)
    ↓
Coach verifies and confirms payment
    ↓
CONFIRMED (appointment confirmed, guest can join session)
    ↓
Session starts and completes
    ↓
COMPLETED (appointment finished)
```

### Previous Issue (FIXED)
**Before:** When coach sent payment link, status stayed at GUEST_INTENT
**After:** When coach sends payment link, status changes to VERIFICATION_PENDING

This allows the coach to easily see:
- PENDING: New appointment request (authenticated user)
- GUEST_INTENT: New guest booking, awaiting coach review
- VERIFICATION_PENDING: Coach sent payment link, waiting for guest upload ← Guest should upload payment now
- CONFIRMED: Payment verified, appointment confirmed
- COMPLETED: Appointment finished
**Endpoint:** `POST /api/guest-sessions/auth` (PUBLIC)
**Handler:** [guest_sessions.py#L23](guest_sessions.py#L23)

```python
async def authenticate_guest_session(request: GuestSessionAuthRequest):
    """
    Public endpoint - no authentication required
    
    Security checks:
    1. Token exists in database
    2. Token hasn't expired
    3. Appointment is confirmed
    4. Is guest appointment (guest_name set)
    5. Session exists
    """
    # 1. Find appointment by token
    appointment = await db.execute(
        select(Appointment)
        .where(Appointment.guest_session_token == request.token)
    )
    
    if not appointment:
        raise HTTPException(404, "Invalid session link")
    
    # 2. Check token expiration
    if datetime.utcnow() > appointment.guest_session_token_expires_at:
        raise HTTPException(403, "Session link expired")
    
    # 3. Verify appointment confirmed
    if appointment.status != AppointmentStatus.CONFIRMED:
        raise HTTPException(403, "Appointment not confirmed")
    
    # 4. Get session
    session = appointment.appointment_session
    if not session:
        raise HTTPException(404, "Session not created yet")
    
    # 5. Verify session is active or scheduled
    if session.status not in ["scheduled", "active"]:
        raise HTTPException(403, f"Session is {session.status}")
    
    return GuestSessionDetails(
        session_id=session.session_id,
        coach_name=appointment.coach.user.name,
        client_name=appointment.guest_name,
        duration=session.duration,
        status=session.status,
        # ... other fields
    )
```

### 2. Guest Token Validation
**Endpoint:** `GET /api/guest-sessions/validate/{token}` (PUBLIC)

Quick validation without full session details. Used to verify link validity before showing session page.

## WebSocket Communication

### WebRTC Signaling
**Endpoint:** `ws://localhost:8000/ws/rtc/{session_id}`
**Handler:** [websocket.py#L152](websocket.py#L152)

```
Coach connects with role="coach"
Client/Guest connects with role="client" or "guest"

Role Mapping:
- Training sessions: trainer ↔ learner
- Coach sessions: coach ↔ client (or guest)

Message Flow:
1. Coach sends: {"type": "join", "role": "coach"}
2. Client sends: {"type": "join", "role": "client"}
3. When both connected, server signals coach to create offer
4. Coach sends SDP offer
5. Client sends SDP answer
6. Exchange ICE candidates
7. WebRTC connection established
```

**Key Code:**
- Join handling: [websocket.py#L165-L185](websocket.py#L165-L185)
- Peer ready signal: [websocket.py#L190-L200](websocket.py#L190-L200)
- Role mapping: [websocket.py#L225-L235](websocket.py#L225-L235)

### Whiteboard Sync
**Endpoint:** `ws://localhost:8000/ws/whiteboard/{session_id}`
**Handler:** [websocket.py#L292](websocket.py#L292)

Messages sent between coach and client:

```json
// Drawing
{"type": "draw", "data": {"x": 100, "y": 200, "...": "..."}}

// Text box
{"type": "text_box_added", "data": {"id": "txt_123", "x": 50, "y": 100, "text": "Hello"}}

// Bucket fill
{"type": "bucket_added", "data": {"id": "bucket_456", "x": 100, "y": 100, "color": "#FF0000"}}

// Erase
{"type": "erase", "data": {"...": "..."}}

// Clear canvas
{"type": "clear"}

// Media control (shared media)
{"type": "media_control", "data": {"action": "play", "mediaId": "...", "...": "..."}}
```

**Message Routing:**
```
Coach sends draw → Client receives draw
Client sends text_box_added → Coach receives text_box_added
Either side can control media (but with session-level control lock)

Role mapping for broadcast:
- coach → client (and vice versa)
- trainer → learner (and vice versa)
```

**Key Code:**
- Join handling: [websocket.py#L320-L340](websocket.py#L320-L340)
- Message forwarding: [websocket.py#L375-L395](websocket.py#L375-L395)
- Media state sync: [websocket.py#L355-L365](websocket.py#L355-L365)

## Frontend Implementation

### GuestSession Component
Located in [src/pages/guest/GuestSession.jsx](src/pages/guest/GuestSession.jsx)

```jsx
// URL format: /guest-session/:token
// Example: /guest-session/550e8400-e29b-41d4-a716-446655440000

const GuestSession = () => {
  const { token } = useParams(); // From URL
  
  // 1. Authenticate guest
  const authenticateGuestSession = async () => {
    const response = await axios.post(
      `${API_BASE_URL}/guest-sessions/auth`,
      { token }
    );
    const sessionData = response.data;
    // sessionData contains:
    // - session_id (used for WebSocket connections)
    // - coach_name, client_name
    // - scheduled_date, scheduled_time, duration
    // - status (scheduled/active/ended/cancelled)
    
    // 2. Initialize WebRTC with role="guest"
    await initializeWebRTC(sessionData.session_id);
  };
  
  // 3. Connect to WebSocket endpoints
  const initializeWebRTC = async (sessionId) => {
    // RTC signaling
    webRTC = new VideoConferenceService(
      sessionId,
      `${WS_BASE_URL}/ws/rtc/${sessionId}`,
      "guest" // role parameter
    );
    
    // Whiteboard sync
    whiteboard = new WhiteboardService(
      sessionId,
      `${WS_BASE_URL}/ws/whiteboard/${sessionId}`,
      "guest" // role parameter
    );
  };
  
  // 4. Same UI as ClientSession
  // - Video conferencing (receive coach's video)
  // - Whiteboard drawing/tools
  // - Text messages (if implemented)
  // - Media playback (shared by coach)
};
```

### ClientSession Component
Located in [src/pages/coach/ClientSession.jsx](src/pages/coach/ClientSession.jsx)

Registered user client joining a coach session:

```jsx
// URL format: /coach-session/:sessionId
// Example: /coach-session/coach_session_a1b2c3d4

const ClientSession = () => {
  const { sessionId } = useParams();
  
  // 1. Fetch session details
  const response = await axios.get(`${API_BASE_URL}/coach-sessions/${sessionId}`);
  
  // 2. Connect to WebSocket with role="client"
  webRTC = new VideoConferenceService(
    sessionId,
    `${WS_BASE_URL}/ws/rtc/${sessionId}`,
    "client" // role parameter
  );
  
  whiteboard = new WhiteboardService(
    sessionId,
    `${WS_BASE_URL}/ws/whiteboard/${sessionId}`,
    "client" // role parameter
  );
  
  // 3. Same UI as GuestSession
  // - Receive coach's video
  // - Whiteboard drawing
  // - Real-time sync
};
```

### CoachSession Component
Located in [src/pages/coach/CoachSession.jsx](src/pages/coach/CoachSession.jsx)

Coach initiating the session:

```jsx
// URL format: /coach-session/:sessionId
// Example: /coach-session/coach_session_a1b2c3d4

const CoachSession = () => {
  const { sessionId } = useParams();
  
  // 1. Fetch session details
  const response = await axios.get(`${API_BASE_URL}/coach-sessions/${sessionId}`);
  // Returns: client_name, client_email, status, etc.
  
  // 2. Start session (within time window)
  await axios.post(`${API_BASE_URL}/coach-sessions/${sessionId}/start`);
  
  // 3. Connect to WebSocket with role="coach"
  webRTC = new VideoConferenceService(
    sessionId,
    `${WS_BASE_URL}/ws/rtc/${sessionId}`,
    "coach" // role parameter (initiator)
  );
  
  whiteboard = new WhiteboardService(
    sessionId,
    `${WS_BASE_URL}/ws/whiteboard/${sessionId}`,
    "coach" // role parameter (can control media)
  );
  
  // 4. UI includes all whiteboard tools (pen, eraser, text, clear, bucket)
  // 5. Can start/end session
  // 6. Can play/share media to client
};
```

## Key Implementation Details

### 1. Role-Based WebSocket Routing
The WebSocket endpoints support both training and coaching sessions:

```python
valid_roles = ["trainer", "learner", "coach", "client"]

role_mapping = {
    "trainer": "learner",    # Training sessions
    "learner": "trainer",
    "coach": "client",        # Coaching sessions
    "client": "coach"
}

# When coach sends message, client receives it (1-to-1)
# Messages only sent to opposite role in same session
```

### 2. Guest Access Security
- Token stored in database with expiry time
- Token path: `Appointment.guest_session_token`
- Validation on each request, not cached
- Email contains full URL with token (public link)

### 3. Session Identification
- **Training sessions:** `session_XXXX` format
- **Coach sessions:** `coach_session_XXXX` format
- Both use same WebSocket infrastructure
- Session ID determines the participant mapping

### 4. Time Parsing
- Appointment stores `scheduled_date` (Date) and `scheduled_time` (String)
- Supported times: "10am", "1pm", "3pm", "5pm"
- Must combine date + time for datetime calculations
- 2-hour window allows late start (coach has flexibility)

### 5. Client Type Detection
```python
# In session model and CRUD operations:
if appointment.user_id:
    # Registered user - has User model linked
    is_registered = True
    client_user_id = appointment.user_id
else:
    # Guest user - only has guest_name/guest_email
    is_registered = False
    client_user_id = None
```

### 6. Whiteboard Tool Access
Coach (instructor role) controls:
- Whiteboard tool selection
- Media playback controls
- Session recording

Client/Guest (learner role) can:
- Receive drawings/annotations
- Participate in drawing (if allowed by tool access control)
- View shared media

## API Endpoints Summary

### Coach Endpoints (Authenticated)
```
POST   /api/coach-sessions/create              # Create session from appointment
GET    /api/coach-sessions/coach/sessions      # List all sessions for coach
GET    /api/coach-sessions/{session_id}        # Get session details
POST   /api/coach-sessions/{session_id}/start  # Start session (within time window)
POST   /api/coach-sessions/{session_id}/end    # End session
```

### Client Endpoints (Authenticated)
```
GET    /api/coach-sessions/client/sessions     # List all sessions for client
GET    /api/coach-sessions/{session_id}        # Get session details (if authorized)
```

### Guest Endpoints (Public)
```
POST   /api/guest-sessions/auth                # Authenticate with token
GET    /api/guest-sessions/validate/{token}    # Quick token validation
```

### WebSocket Endpoints (All Roles)
```
ws:///ws/rtc/{session_id}                      # WebRTC signaling
ws:///ws/whiteboard/{session_id}               # Whiteboard & media sync
```

## Common Patterns

### Authorization Checks
```python
# Endpoint verifies user's role in session
if session.coach_id == current_coach.id:
    # Allow coach operations
elif session.client_user_id == current_user.id:
    # Allow client operations
else:
    # Reject with 403 Forbidden
```

### Error Handling
```python
# Time window validation
if current_time > expiry_time:
    raise ValueError("Session window has expired")

# Session state validation
if session.status not in ["scheduled", "active"]:
    raise ValueError(f"Cannot start session in {session.status} state")

# Guest token validation
if not appointment.guest_session_token:
    raise HTTPException(404, "Invalid token")
```

## Files Reference

- **Models:**
  - [app/models/user_model.py](app/models/user_model.py) - Appointment model
  - [app/models/coach_session_model.py](app/models/coach_session_model.py) - CoachAppointmentSession model

- **CRUD:**
  - [app/crud/coach_appointment_session_crud.py](app/crud/coach_appointment_session_crud.py) - Session operations

- **API Endpoints:**
  - [app/api/endpoints/coach_appointment_sessions.py](app/api/endpoints/coach_appointment_sessions.py) - Coach/client endpoints
  - [app/api/endpoints/guest_sessions.py](app/api/endpoints/guest_sessions.py) - Guest authentication
  - [app/api/endpoints/websocket.py](app/api/endpoints/websocket.py) - WebSocket infrastructure

- **Frontend:**
  - [src/pages/guest/GuestSession.jsx](src/pages/guest/GuestSession.jsx) - Guest session page
  - [src/pages/coach/ClientSession.jsx](src/pages/coach/ClientSession.jsx) - Client session page
  - [src/pages/coach/CoachSession.jsx](src/pages/coach/CoachSession.jsx) - Coach session page
  - [src/components/common/Whiteboard.jsx](src/components/common/Whiteboard.jsx) - Shared whiteboard component

## Testing Scenarios

### 1. Registered User Coaching
1. Coach books appointment with registered user
2. Coach confirms appointment
3. Session automatically created with `client_user_id` set
4. Registered user logs in
5. Joins via `/coach-session/:sessionId` (authenticated)
6. Both connect WebSocket with roles: coach ↔ client

### 2. Guest Coaching
1. Coach books appointment for guest
2. Sets `guest_name` and `guest_email`
3. Coach confirms appointment
4. Session created with `client_user_id = NULL`
5. Guest token generated and emailed
6. Guest clicks link `/guest-session/:token` (no auth)
7. Guest authenticates with token
8. Both connect WebSocket with roles: coach ↔ guest

### 3. Time Window Validation
1. Appointment scheduled for 2024-01-15 10:00 AM
2. Window: 10:00 AM - 12:00 PM
3. Coach starts at 11:00 AM → ✓ Success
4. Coach starts at 12:05 PM → ✗ Error: "Session window expired"
5. Can resume active session anytime (no time check if status="active")

## Troubleshooting

### Issue: "Invalid session link"
- Guest token not found in database
- Solution: Verify appointment.guest_session_token is set

### Issue: "Session link expired"
- Token expiration time passed
- Solution: Request new link from coach (regenerate token)

### Issue: "Session not created yet"
- Appointment not confirmed by coach
- Solution: Wait for coach to confirm appointment

### Issue: "Cannot start session in scheduled state"
- Session status not "scheduled" or "active"
- Solution: Verify session wasn't already ended/cancelled

### Issue: "Session window has expired"
- Current time > scheduled_time + 2 hours
- Solution: Coach must start within 2-hour window
- Debug: Check server time matches appointment time parsing

### Issue: WebSocket connection fails
- Verify session_id format matches (coach_session_XXXX)
- Verify role is one of: trainer, learner, coach, client
- Check CORS settings for WebSocket
- Verify backend WebSocket service is running

## Future Enhancements

1. **Recording** - Automatic recording during sessions, storage in S3
2. **Session Notes** - Coach can add notes after session
3. **Rescheduling** - Allow rescheduling confirmed appointments
4. **Cancellation** - Guest/coach can cancel with notification
5. **Reminders** - Email reminders before session start
6. **Chat Messages** - Persistent chat during session
7. **Screen Sharing** - Additional to whiteboard
8. **Session Replay** - Guests can watch recording after
9. **Ratings** - Post-session feedback and ratings
10. **Analytics** - Session duration, attendance, engagement metrics
