# Coach API - Quick Reference Guide

## Authentication
All coach endpoints require JWT token in Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

The token must have `role: "coach"` claim.

---

## Profile Picture Upload

### Upload Coach Profile Picture
**POST** `/api/coaches/profile-picture/upload`

**Content-Type:** `multipart/form-data`

**Parameters:**
- `file` (required): Image file (JPEG, PNG, GIF, WebP, etc.)
  - Max size: 5MB
  - Stored in: `uploads/profile_pictures/` (dev) or S3 (production)

**Response:**
```json
{
  "message": "Profile picture uploaded successfully",
  "profile_picture_url": "/uploads/profile_pictures/coach_1_5.jpg"
}
```

**Example cURL:**
```bash
curl -X POST "http://localhost:8000/api/coaches/profile-picture/upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/image.jpg"
```

---

## Appointments

### Create Appointment
**POST** `/api/coaches/appointments`

**Body:**
```json
{
  "coach_id": 1,
  "scheduled_date": "2025-12-20",
  "scheduled_time": "10am",
  "notes": "Optional notes about the appointment"
}
```

**Response:**
```json
{
  "id": 1,
  "coach_id": 1,
  "user_id": 5,
  "user_role": "learner",
  "scheduled_date": "2025-12-20",
  "scheduled_time": "10am",
  "status": "scheduled",
  "notes": "Optional notes...",
  "created_at": "2025-12-17T10:00:00",
  "updated_at": "2025-12-17T10:00:00"
}
```

### Get All Coach Appointments
**GET** `/api/coaches/appointments`

**Response:**
```json
[
  {
    "id": 1,
    "coach_id": 1,
    "user_id": 5,
    "user_role": "learner",
    "scheduled_date": "2025-12-20",
    "scheduled_time": "10am",
    "status": "scheduled",
    "notes": "Optional notes...",
    "created_at": "2025-12-17T10:00:00",
    "updated_at": "2025-12-17T10:00:00"
  }
]
```

### Get Appointment Details
**GET** `/api/coaches/appointments/{appointment_id}`

### Update Appointment
**PATCH** `/api/coaches/appointments/{appointment_id}`

**Body (all optional):**
```json
{
  "scheduled_date": "2025-12-21",
  "scheduled_time": "1pm",
  "status": "confirmed",
  "notes": "Updated notes"
}
```

### Delete Appointment
**DELETE** `/api/coaches/appointments/{appointment_id}`

**Response:**
```json
{
  "message": "Appointment deleted successfully"
}
```

---

## Coach Sessions

### Create Session
**POST** `/api/coaches/sessions`

**Body:**
```json
{
  "session_date": "2025-12-20",
  "session_time": "10am",
  "session_title": "Advanced Coaching Session",
  "learning_content_id": 3,
  "description": "Session focused on skill development",
  "notes": "Additional notes"
}
```

**Response:**
```json
{
  "id": 1,
  "coach_id": 1,
  "session_date": "2025-12-20",
  "session_time": "10am",
  "session_title": "Advanced Coaching Session",
  "learning_content_id": 3,
  "description": "Session focused on skill development",
  "status": "scheduled",
  "notes": "Additional notes",
  "participants": [],
  "created_at": "2025-12-17T10:00:00",
  "updated_at": "2025-12-17T10:00:00"
}
```

### Get All Coach Sessions
**GET** `/api/coaches/sessions`

**Response:**
```json
[
  {
    "id": 1,
    "coach_id": 1,
    "session_date": "2025-12-20",
    "session_time": "10am",
    "session_title": "Advanced Coaching Session",
    "learning_content_id": 3,
    "description": "Session focused on skill development",
    "status": "scheduled",
    "notes": "Additional notes",
    "participants": [],
    "created_at": "2025-12-17T10:00:00",
    "updated_at": "2025-12-17T10:00:00"
  }
]
```

### Get Session Details
**GET** `/api/coaches/sessions/{session_id}`

### Update Session
**PATCH** `/api/coaches/sessions/{session_id}`

**Body (all optional):**
```json
{
  "session_date": "2025-12-21",
  "session_time": "3pm",
  "session_title": "Updated Title",
  "status": "ongoing",
  "description": "Updated description"
}
```

### Delete Session
**DELETE** `/api/coaches/sessions/{session_id}`

---

## Session Participants

### Add Participant to Session
**POST** `/api/coaches/sessions/{session_id}/participants`

**Body:**
```json
{
  "user_id": 5,
  "participant_role": "learner"
}
```

**Response:**
```json
{
  "id": 1,
  "session_id": 1,
  "user_id": 5,
  "participant_role": "learner",
  "status": "invited",
  "created_at": "2025-12-17T10:00:00"
}
```

### Update Participant Status
**PATCH** `/api/coaches/sessions/{session_id}/participants/{user_id}`

**Query Parameters:**
- `status` (required): One of: `invited`, `accepted`, `declined`, `attended`

**Response:**
```json
{
  "message": "Participant status updated to accepted"
}
```

### Remove Participant
**DELETE** `/api/coaches/sessions/{session_id}/participants/{user_id}`

**Response:**
```json
{
  "message": "Participant removed successfully"
}
```

---

## Status Values Reference

### Appointment Status
- `scheduled` - Initial state when appointment is created
- `confirmed` - Confirmed by coach
- `cancelled` - Appointment cancelled
- `completed` - Appointment completed

### Session Status
- `scheduled` - Session not yet started
- `ongoing` - Session is currently happening
- `completed` - Session has ended
- `cancelled` - Session was cancelled

### Participant Status
- `invited` - Invitation sent, awaiting response
- `accepted` - Participant accepted the invitation
- `declined` - Participant declined the invitation
- `attended` - Participant attended the session

---

## Available Time Slots
- `10am`
- `1pm`
- `3pm`
- `5pm`

---

## Error Responses

### Not Authorized
**Status:** 403
```json
{
  "detail": "Not authorized as coach"
}
```

### Not Found
**Status:** 404
```json
{
  "detail": "Appointment not found"
}
```

### Invalid File
**Status:** 400
```json
{
  "detail": "File must be an image"
}
```

### File Too Large
**Status:** 400
```json
{
  "detail": "File size exceeds 5 MB limit"
}
```

---

## Common Use Cases

### Schedule an Appointment with Multiple Slots
```bash
# Check coach availability and schedule
POST /api/coaches/appointments
{
  "coach_id": 1,
  "scheduled_date": "2025-12-20",
  "scheduled_time": "10am",
  "notes": "Weekly session"
}
```

### Create a Group Session
```bash
# Create session
POST /api/coaches/sessions
{
  "session_date": "2025-12-20",
  "session_time": "10am",
  "session_title": "Group Coaching"
}

# Add participants
POST /api/coaches/sessions/1/participants
{
  "user_id": 5,
  "participant_role": "learner"
}

POST /api/coaches/sessions/1/participants
{
  "user_id": 6,
  "participant_role": "learner"
}

# Update session status as it progresses
PATCH /api/coaches/sessions/1
{
  "status": "ongoing"
}
```

### Manage Session Attendance
```bash
# Accept invitations
PATCH /api/coaches/sessions/1/participants/5?status=accepted

# Mark as attended after session
PATCH /api/coaches/sessions/1/participants/5?status=attended
```

---

## Rate Limits
- No specific rate limit for coach endpoints (configured globally)
- Refer to main API documentation for global rate limits

---

## Support
For issues or questions, contact the development team.
