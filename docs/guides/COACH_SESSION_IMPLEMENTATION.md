# Coach Appointment Sessions Implementation

## Overview
Implemented one-on-one video conferencing sessions between coaches and clients based on confirmed appointments. This implementation **reuses the existing WebRTC infrastructure** from training sessions (trainer-learner), extending it to support coach-client sessions.

## Architecture

### Key Design Decisions
1. **Reused WebRTC Logic**: The existing WebSocket endpoints (`/ws/rtc` and `/ws/whiteboard`) now support both:
   - Training sessions: `trainer` ↔ `learner` 
   - Coach sessions: `coach` ↔ `client`

2. **Appointment-Based**: Sessions are created from confirmed appointments, maintaining the link via `appointment_id`

3. **Guest Support**: Supports both registered users and guest bookings (when `client_user_id` is NULL)

## Implementation Details

### 1. Database Model
**File**: `app/models/coach_session_model.py`

```python
class CoachAppointmentSession(Base):
    __tablename__ = "coach_appointment_sessions"
    
    # Key fields:
    - session_id: Unique identifier (e.g., "coach_session_abc123")
    - appointment_id: Link to appointment (one-to-one, unique)
    - coach_id: Coach conducting the session
    - client_user_id: Registered user (NULL for guests)
    - client_name, client_email: Cached client info
    - status: scheduled → active → ended/cancelled
    - recording_url, recording_status: Video recording support
```

**Migration**: `alembic/versions/s8t9u0v1w2x3_add_coach_appointment_sessions_table.py`

### 2. Schemas
**File**: `app/schemas/coach_session.py`

- `CoachSessionCreate`: Create session from appointment
- `CoachSessionUpdate`: Update scheduled sessions
- `CoachSessionEnd`: End session with notes
- `CoachSessionResponse`: Full session details
- `CoachSessionListItem`: Simplified list view

### 3. CRUD Operations
**File**: `app/crud/coach_appointment_session_crud.py`

**Key Functions**:
- `create_session_from_appointment()`: Auto-populate from appointment data
- `get_session_by_id()`: Fetch by session_id string
- `get_coach_sessions()`: All sessions for a coach
- `get_client_sessions()`: All sessions for a client
- `start_session()`: Move from scheduled → active
- `end_session()`: Move from active → ended with notes
- `cancel_session()`: Cancel scheduled session

### 4. API Endpoints
**File**: `app/api/endpoints/coach_appointment_sessions.py`
**Prefix**: `/api/coach-sessions`

#### Coach Endpoints
- `POST /create`: Create session from appointment
- `GET /coach/sessions`: List all coach's sessions
- `GET /{session_id}`: Get session details
- `POST /{session_id}/start`: Start session
- `POST /{session_id}/end`: End session with notes
- `PUT /{session_id}`: Update scheduled session
- `DELETE /{session_id}`: Cancel session

#### Client Endpoints
- `GET /client/sessions`: List client's sessions
- `POST /{session_id}/join`: Join active session

#### Recording Endpoints
- `POST /recordings/upload`: Upload recorded video
- `GET /{session_id}/recording-url`: Get playback URL

### 5. WebSocket Integration
**File**: `app/api/endpoints/websocket.py`

#### Updated Endpoints

**`/ws/rtc/{session_id}`** - WebRTC Signaling
- Now supports 4 roles: `trainer`, `learner`, `coach`, `client`
- Auto-detects session type from role
- Routes messages between: trainer↔learner OR coach↔client
- Initiator selection: `trainer` for training sessions, `coach` for coach sessions

**`/ws/whiteboard/{session_id}`** - Whiteboard & Media Sharing
- Supports same 4 roles
- Controller roles (can control media): `trainer`, `coach`
- Participant roles (receive updates): `learner`, `client`
- Media sync works identically for both session types

#### Media Control Handler Updates
```javascript
// Controllers (can control media)
controller_roles = ["trainer", "coach"]

// Participants (receive media state)
participant_roles = ["learner", "client"]
```

## Usage Flow

### 1. Appointment Confirmation → Session Creation
When a coach confirms an appointment:
```python
POST /api/coach-sessions/create
{
  "appointment_id": 123,
  "duration": 60
}
```

This auto-populates:
- Client info from appointment (user or guest)
- Scheduled date/time from appointment
- Session type from appointment
- Creates unique `session_id`

### 2. Starting a Session (Coach)
```python
POST /api/coach-sessions/{session_id}/start
```
- Changes status: `scheduled` → `active`
- Records `started_at` timestamp

### 3. WebRTC Connection (Both Participants)

**Coach connects**:
```javascript
const ws = new WebSocket(`wss://api.example.com/ws/rtc/${sessionId}`)
ws.send(JSON.stringify({ type: 'join', role: 'coach' }))
```

**Client connects**:
```javascript
const ws = new WebSocket(`wss://api.example.com/ws/rtc/${sessionId}`)
ws.send(JSON.stringify({ type: 'join', role: 'client' }))
```

**When both connected**, server signals coach to initiate WebRTC offer:
```javascript
// Coach receives:
{ type: 'peer_ready', role: 'both_connected' }
```

### 4. Whiteboard & Media Sharing
```javascript
const whiteboardWs = new WebSocket(`wss://api.example.com/ws/whiteboard/${sessionId}`)

// Coach controls media
whiteboardWs.send({
  type: 'media_control',
  data: {
    action: 'open',
    mediaId: 123,
    mediaType: 'video',
    mediaUrl: 's3://bucket/video.mp4'
  }
})

// Client receives synchronized media state
```

### 5. Ending Session (Coach)
```python
POST /api/coach-sessions/{session_id}/end
{
  "notes": "Great progress today..."
}
```
- Changes status: `active` → `ended`
- Records `ended_at` timestamp
- Broadcasts end message to client via WebSocket

### 6. Recording Upload
Browser MediaRecorder uploads recording:
```python
POST /api/coach-sessions/recordings/upload
FormData:
  - file: recorded.webm
  - session_id: 123
  - recording_id: "abc123"
  - duration: 3600
```

### 7. Recording Playback
```python
GET /api/coach-sessions/{session_id}/recording-url

Response:
{
  "playback_url": "https://...",
  "storage_mode": "s3",
  "expires_in": 3600
}
```

## Frontend Integration Points

### Session UI Components
You'll need to create frontend components similar to training sessions:

1. **CoachSessionList**: Display coach's upcoming/past sessions
2. **ClientSessionList**: Display client's booked sessions
3. **CoachSessionRoom**: Video conferencing UI (coach view)
4. **ClientSessionRoom**: Video conferencing UI (client view)

### WebRTC Connection
Reuse existing `sessionService.js` logic, but update roles:

```javascript
// For training sessions
const role = isTrainer ? 'trainer' : 'learner'

// For coach sessions  
const role = isCoach ? 'coach' : 'client'
```

### Media Player
The existing whiteboard media player should work as-is. Just ensure:
- Coach can control media (play/pause/seek)
- Client receives synchronized playback

## Configuration

### Environment Variables
No new environment variables needed. Uses existing:
- `RECORDING_STORAGE_MODE`: "local" or "s3"
- `S3_BUCKET_NAME`: If using S3 storage
- `AWS_REGION`: If using S3 storage

## Testing Checklist

### Backend
- [ ] Create session from appointment
- [ ] Coach can start session
- [ ] Coach can end session with notes
- [ ] Client can join active session
- [ ] WebSocket connections for coach/client roles
- [ ] Media control (coach controls, client receives)
- [ ] Recording upload
- [ ] Recording playback URL generation

### Frontend (Next Steps)
- [ ] Session list views (coach & client)
- [ ] Session room UI with video
- [ ] WebRTC peer connection with coach/client roles
- [ ] Whiteboard integration
- [ ] Media player sync
- [ ] Recording playback

## Database Migration

Run migration to create table:
```bash
cd hurshbintech-backend
alembic upgrade head
```

Or using Python:
```bash
python -m alembic upgrade head
```

## API Documentation
Once server is running, view API docs at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

Look for "Coach Appointment Sessions" tag.

## Next Steps

1. **Run Migration**: Apply database changes
2. **Test Backend**: Use Swagger UI to test endpoints
3. **Frontend Implementation**: 
   - Create coach session components
   - Update WebRTC connection logic to support coach/client roles
   - Test video conferencing flow
4. **Automatic Session Creation**: Add logic to create session when coach confirms appointment

## Notes

- Session creation is currently manual via API. Consider adding automatic creation when appointment status changes to `CONFIRMED`
- Guest sessions work but guests can't use `/client/sessions` endpoint (requires authentication). They'll receive session link via email
- Recording storage follows same pattern as training sessions (local or S3)
- WebSocket connections are stateless - reconnection logic needed on frontend
