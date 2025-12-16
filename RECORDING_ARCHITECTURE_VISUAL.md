# Recording Storage System - Visual Architecture

## 📊 Complete File Structure

```
hurshbintech/
├── hurshbintech-backend/
│   ├── app/
│   │   ├── api/endpoints/
│   │   │   └── sessions.py ⭐ [MODIFIED]
│   │   │       ├── JanusWebhookPayload schema
│   │   │       ├── POST /recordings/webhook/complete
│   │   │       ├── GET /recordings/local/{session_id}/{filename}
│   │   │       └── GET /{session_id}/recording-url
│   │   │
│   │   ├── core/
│   │   │   └── config.py ⭐ [MODIFIED]
│   │   │       └── RECORDING_STORAGE_MODE: str = "local"
│   │   │
│   │   ├── models/
│   │   │   └── session_model.py ⭐ [MODIFIED]
│   │   │       ├── recording_url: Column(String(500))
│   │   │       ├── recording_status: Column(String(50))
│   │   │       └── recording_uploaded_at: Column(DateTime)
│   │   │
│   │   ├── schemas/
│   │   │   └── session.py ⭐ [MODIFIED]
│   │   │       └── SessionResponse with recording fields
│   │   │
│   │   ├── services/
│   │   │   └── recording_storage/ ✨ [NEW PACKAGE]
│   │   │       ├── __init__.py (252 bytes)
│   │   │       ├── base.py (2,675 bytes)
│   │   │       │   └── RecordingStorage (ABC)
│   │   │       ├── local_storage.py (5,333 bytes)
│   │   │       │   └── LocalRecordingStorage
│   │   │       ├── s3_storage.py (6,216 bytes)
│   │   │       │   └── S3RecordingStorage
│   │   │       └── factory.py (2,548 bytes)
│   │   │           └── get_recording_storage()
│   │   │
│   │   └── workers/
│   │       └── recording_retention.py ✨ [NEW]
│   │           ├── cleanup_old_recordings()
│   │           └── cleanup_failed_recordings()
│   │
│   └── alembic/versions/
│       └── add_recording_fields.py ✨ [NEW]
│           ├── upgrade(): Add recording columns
│           └── downgrade(): Remove recording columns
│
└── Documentation/ ✨ [NEW]
    ├── RECORDING_STORAGE_GUIDE.md (16,252 bytes)
    ├── RECORDING_SETUP_QUICKSTART.md (6,577 bytes)
    ├── RECORDING_IMPLEMENTATION_SUMMARY.md (11,827 bytes)
    └── JANUS_INTEGRATION_GUIDE.md
```

**Total:** 9 new files, 4 modified files, 3 comprehensive guides

---

## 🔄 Request Flow Diagram

### Recording Completion Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SESSION IN PROGRESS                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Frontend (React)          Janus Gateway                      │
│   └─ Video Call ──────────► Records to:                        │
│                              /var/janus/recordings/             │
│                              session-123-timestamp.webm         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ Recording Complete
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. WEBHOOK NOTIFICATION                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Janus / File Watcher / Frontend                              │
│   │                                                             │
│   └─► POST /api/sessions/recordings/webhook/complete           │
│       {                                                         │
│         "session_id": 123,                                      │
│         "file_path": "/var/janus/recordings/...",              │
│         "recording_id": "abc123",                               │
│         "duration": 3600                                        │
│       }                                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ Webhook Handler
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. FASTAPI WEBHOOK HANDLER                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   sessions.py::janus_recording_webhook()                       │
│   │                                                             │
│   ├─ Validate token (optional)                                 │
│   ├─ Verify session exists                                     │
│   ├─ Set status = "processing"                                 │
│   └─ Queue background task ───────────────────┐                │
│                                                │                │
│   Returns {"status": "accepted"} immediately  │                │
│                                                │                │
└────────────────────────────────────────────────┼────────────────┘
                                                 │
                                                 │ Background Task
                                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. BACKGROUND PROCESSING                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   process_recording(session_id, file_path, db)                 │
│   │                                                             │
│   ├─► get_recording_storage()  ◄──┐                            │
│   │                                │ Factory Pattern            │
│   │   Decision Point (ONLY HERE)  │                            │
│   │   if RECORDING_STORAGE_MODE:  │                            │
│   │      local → LocalStorage     │                            │
│   │      s3 → S3Storage           │                            │
│   │                                │                            │
│   └─► storage.save(file_path, session_id)                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                     │                       │
        ┌────────────┴────────┐   ┌──────────┴──────────┐
        │ Local Storage       │   │ S3 Storage          │
        ▼                     │   ▼                     │
┌───────────────────────┐    │   ┌────────────────────┐│
│ 5A. LOCAL BACKEND     │    │   │ 5B. S3 BACKEND     ││
├───────────────────────┤    │   ├────────────────────┤│
│                       │    │   │                    ││
│ LocalRecordingStorage │    │   │ S3RecordingStorage ││
│ │                     │    │   │ │                  ││
│ ├─ Move file to:     │    │   │ ├─ Upload to S3:  ││
│ │  /var/recordings/  │    │   │ │  recordings/123/ ││
│ │  123/recording.webm│    │   │ │  uuid.webm       ││
│ │                     │    │   │ │                  ││
│ └─ Return:           │    │   │ └─ Return:         ││
│    /var/recordings/  │    │   │    recordings/123/ ││
│    123/recording.webm│    │   │    abc123.webm     ││
│                       │    │   │                    ││
└───────────────────────┘    │   └────────────────────┘│
        │                    │            │             │
        └────────────────────┴────────────┘             │
                             │                          │
                             ▼                          │
┌─────────────────────────────────────────────────────────────────┐
│ 6. DATABASE UPDATE                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   UPDATE training_sessions                                      │
│   SET recording_url = 'path_from_storage',                      │
│       recording_status = 'completed',                           │
│       recording_uploaded_at = NOW()                             │
│   WHERE id = 123;                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎬 Playback Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER REQUESTS PLAYBACK                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Frontend (Dashboard.jsx)                                     │
│   │                                                             │
│   └─► GET /api/sessions/123/recording-url                      │
│       Authorization: Bearer <token>                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. FASTAPI ENDPOINT                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   sessions.py::get_recording_playback_url()                    │
│   │                                                             │
│   ├─ Verify authentication                                     │
│   ├─ Check user access (trainer/learner/creator)               │
│   ├─ Verify recording_status = "completed"                     │
│   │                                                             │
│   └─► storage = get_recording_storage()                        │
│       playback_url = storage.get_playback_url(recording_url)   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                     │                       │
        ┌────────────┴────────┐   ┌──────────┴──────────┐
        │ Local Storage       │   │ S3 Storage          │
        ▼                     │   ▼                     │
┌───────────────────────┐    │   ┌────────────────────┐│
│ 3A. LOCAL URL         │    │   │ 3B. S3 PRESIGNED   ││
├───────────────────────┤    │   ├────────────────────┤│
│                       │    │   │                    ││
│ Return:               │    │   │ Generate:          ││
│ /api/recordings/      │    │   │ https://s3...      ││
│ local/123/file.webm   │    │   │ ?X-Amz-Signature=  ││
│                       │    │   │ &Expires=3600      ││
│                       │    │   │                    ││
└───────────────────────┘    │   └────────────────────┘│
        │                    │            │             │
        └────────────────────┴────────────┘             │
                             │                          │
                             ▼                          │
┌─────────────────────────────────────────────────────────────────┐
│ 4. RESPONSE TO FRONTEND                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   {                                                             │
│     "playback_url": "<url>",                                    │
│     "storage_mode": "local" or "s3",                            │
│     "expires_in": 3600 or null                                  │
│   }                                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. VIDEO PLAYBACK                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   LOCAL:                        S3:                             │
│   ├─ GET /api/recordings/      ├─ GET https://s3...            │
│   │  local/123/file.webm       │                               │
│   │                             │                               │
│   ├─ FileResponse with         ├─ Direct from S3               │
│   │  Range support             │  with presigned auth           │
│   │                             │                               │
│   └─ <video> element           └─ <video> element              │
│      with seeking support         with seeking support          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧹 Retention Job Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ SCHEDULED TRIGGER (Daily at 2 AM)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   APScheduler / Celery Beat / Cron                              │
│   │                                                             │
│   └─► cleanup_old_recordings()                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. QUERY OLD RECORDINGS                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   SELECT * FROM training_sessions                               │
│   WHERE recording_uploaded_at < (NOW() - INTERVAL '30 days')   │
│   AND recording_url IS NOT NULL                                 │
│   AND recording_status = 'completed';                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. DELETE FROM STORAGE                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   FOR EACH session WITH old recording:                          │
│   │                                                             │
│   ├─► storage = get_recording_storage()                        │
│   │                                                             │
│   └─► storage.delete(session.recording_url)                    │
│                                                                 │
│        ┌──────────────────┬──────────────────┐                 │
│        │ Local Storage    │ S3 Storage       │                 │
│        │ Delete file      │ Delete object    │                 │
│        │ from disk        │ from bucket      │                 │
│        └──────────────────┴──────────────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. UPDATE DATABASE                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   UPDATE training_sessions                                      │
│   SET recording_url = NULL,                                     │
│       recording_status = 'deleted'                              │
│   WHERE id IN (old_sessions);                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. LOG RESULTS                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   {                                                             │
│     "status": "completed",                                      │
│     "deleted": 15,                                              │
│     "failed": 0,                                                │
│     "cutoff_date": "2025-11-15T02:00:00Z"                       │
│   }                                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Class Hierarchy

```
RecordingStorage (ABC)
├── Methods:
│   ├── save(local_path, session_id) → storage_path
│   ├── delete(storage_path) → None
│   ├── get_playback_url(storage_path, expires_in) → url
│   └── get_file_size(storage_path) → int | None
│
├── LocalRecordingStorage
│   ├── __init__(base_dir="/var/recordings")
│   ├── save() → "/var/recordings/123/file.webm"
│   ├── delete() → Removes file + empty dirs
│   ├── get_playback_url() → "/api/recordings/local/..."
│   └── get_file_size() → os.path.getsize()
│
└── S3RecordingStorage
    ├── __init__()  # Uses S3Manager
    ├── save() → "recordings/123/uuid.webm"
    ├── delete() → s3_manager.delete_file()
    ├── get_playback_url() → presigned URL
    └── get_file_size() → head_object()['ContentLength']
```

---

## 🔀 Factory Pattern

```
get_recording_storage()
│
├─ Read: settings.RECORDING_STORAGE_MODE
│
├─ if mode == "local":
│  └─► return LocalRecordingStorage()
│
├─ elif mode == "s3":
│  └─► return S3RecordingStorage()
│
└─ else:
   └─► raise RuntimeError("Invalid mode")

⚠️ This is the ONLY place where branching occurs!
   All other code uses the RecordingStorage interface.
```

---

## 💾 Database Schema Changes

```sql
-- Before
training_sessions
├── id (PK)
├── session_id (VARCHAR)
├── title (VARCHAR)
├── status (VARCHAR)
├── trainer_id (FK)
├── learner_id (FK)
├── ...existing fields...
└── ended_at (TIMESTAMP)

-- After (Added 3 columns)
training_sessions
├── ...existing fields...
├── recording_url (VARCHAR 500)           ✨ NEW
├── recording_status (VARCHAR 50)         ✨ NEW
│   └─ Values: pending, processing, completed, failed, deleted
└── recording_uploaded_at (TIMESTAMP)     ✨ NEW

-- Index Added
CREATE INDEX ix_training_sessions_recording_status 
ON training_sessions(recording_status);
```

---

## 🌐 API Endpoints Summary

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/api/sessions/recordings/webhook/complete` | Janus webhook | Token (opt) |
| GET | `/api/sessions/recordings/local/{session_id}/{filename}` | Serve local files | Public |
| GET | `/api/sessions/{session_id}/recording-url` | Get playback URL | Required |

---

## 📦 Dependencies

```
Existing (No new dependencies required):
├── boto3 (for S3)
├── Pillow (for thumbnails - optional)
├── opencv-python (for video thumbnails - optional)
└── FastAPI + SQLAlchemy + Alembic

Optional (for file watcher):
└── watchdog==3.0.0
```

---

## 🎯 Configuration Decision Tree

```
                     Start
                       │
                       ▼
           ┌───────────────────────┐
           │ What environment?     │
           └───────────────────────┘
                │           │
        ┌───────┴───┐   ┌───┴──────┐
        │           │   │          │
        ▼           ▼   ▼          ▼
    Local Dev   Testing Staging Production
        │           │   │          │
        ▼           ▼   ▼          ▼
    ┌───────┐   ┌───────┐ ┌──────────┐
    │ local │   │ local │ │   s3     │
    └───────┘   └───────┘ └──────────┘
        │           │           │
        ▼           ▼           ▼
    No AWS      No AWS      AWS Required
    credentials credentials credentials
        │           │           │
        ▼           ▼           ▼
    Files in    Files in    Files in
    /var/       /var/       S3 bucket
    recordings  recordings
```

---

## 🚀 Deployment Sequence

```
1. Pre-deployment
   ├─ Set RECORDING_STORAGE_MODE env var
   ├─ For S3: Create bucket + IAM
   └─ Review configuration

2. Database Migration
   ├─ Run: alembic upgrade head
   └─ Verify: SELECT recording_url FROM training_sessions LIMIT 1;

3. Deploy Backend
   ├─ docker-compose build backend
   └─ docker-compose up -d backend

4. Verify Storage
   ├─ Check: docker-compose logs backend | grep "RecordingStorage"
   └─ Test: Call webhook endpoint manually

5. Configure Janus
   ├─ Option A: Setup event handlers
   ├─ Option B: Deploy file watcher
   └─ Option C: Frontend-triggered webhooks

6. Monitor
   ├─ Watch logs for "Recording saved"
   ├─ Query database for recording_status
   └─ Test playback URL generation

7. Setup Retention
   └─ Add cleanup job to APScheduler
```

---

## 📊 Metrics to Monitor

```
Recording Success Rate
─────────────────────
completed / (completed + failed) × 100

Storage Usage (Local)
─────────────────────
du -sh /var/recordings

Storage Usage (S3)
──────────────────
aws s3 ls --recursive s3://bucket/recordings/ --summarize

Webhook Latency
───────────────
Time from POST to recording_status=completed

Cleanup Efficiency
──────────────────
Recordings deleted per job run
```

---

This visual guide provides a complete overview of the recording storage architecture, flows, and deployment process!
