# Recording Storage System - Implementation Guide

## Overview

This system implements a unified recording storage abstraction that supports both local filesystem and AWS S3 storage backends, controlled by a single environment variable. Janus WebRTC always records locally first, and FastAPI decides where to persist the final recording.

## Architecture

### Design Principles

1. **Environment-Based Selection**: Storage mode is determined by `RECORDING_STORAGE_MODE` env var (`local` or `s3`)
2. **Single Decision Point**: Storage backend branching occurs only in the factory pattern
3. **Consistent Interface**: All storage operations use the same `RecordingStorage` interface
4. **Janus Isolation**: Janus configuration remains unchanged regardless of storage mode

### Components

```
app/
├── services/
│   └── recording_storage/
│       ├── __init__.py          # Package exports
│       ├── base.py              # RecordingStorage abstract base class
│       ├── local_storage.py     # LocalRecordingStorage implementation
│       ├── s3_storage.py        # S3RecordingStorage implementation
│       └── factory.py           # get_recording_storage() factory
├── api/endpoints/
│   └── sessions.py              # Webhook & playback endpoints
├── workers/
│   └── recording_retention.py  # 30-day cleanup job
└── models/
    └── session_model.py         # recording_url, recording_status fields
```

## Configuration

### Environment Variables

Add to `.env` or `.env.production`:

```bash
# Recording Storage Mode (REQUIRED)
RECORDING_STORAGE_MODE=local   # Options: local | s3

# AWS S3 Configuration (required if RECORDING_STORAGE_MODE=s3)
USE_S3=true
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-south-1
S3_BUCKET_NAME=hurshbintech-media-bucket

# Optional: Webhook security token
JANUS_WEBHOOK_TOKEN=your_shared_secret
```

### Environment Setup Matrix

| Environment | RECORDING_STORAGE_MODE | AWS Credentials | Use Case |
|-------------|------------------------|-----------------|----------|
| Local Dev   | `local`                | Not required    | Development, testing |
| Staging     | `s3`                   | Required        | Pre-production testing |
| Production  | `s3`                   | Required        | Live deployment |

## Database Migration

Run the Alembic migration to add recording fields:

```bash
cd hurshbintech-backend

# Review the migration
alembic history

# Apply the migration
alembic upgrade head

# Verify columns were added
psql -d hurshbintech -c "\d training_sessions"
```

The migration adds:
- `recording_url` (VARCHAR 500) - Storage path/key
- `recording_status` (VARCHAR 50) - Status: pending/processing/completed/failed
- `recording_uploaded_at` (TIMESTAMP) - Upload completion timestamp

## API Endpoints

### 1. Janus Webhook (Recording Completion)

**POST** `/api/sessions/recordings/webhook/complete`

Janus calls this endpoint when recording finishes.

**Request:**
```json
{
  "session_id": 123,
  "file_path": "/var/janus/recordings/rec-abc123.webm",
  "recording_id": "abc123",
  "duration": 3600
}
```

**Headers:**
```
Content-Type: application/json
X-Webhook-Token: your_shared_secret  (optional)
```

**Response:**
```json
{
  "status": "accepted",
  "message": "Recording processing queued for session 123"
}
```

**Process Flow:**
1. Validates webhook token (if configured)
2. Verifies session exists
3. Updates `recording_status` to "processing"
4. Queues background task for upload
5. Background task:
   - Calls `storage.save(file_path, session_id)`
   - Updates `recording_url` and `recording_status` to "completed"
   - Sets `recording_uploaded_at` timestamp

### 2. Local Playback Route

**GET** `/api/sessions/recordings/local/{session_id}/{filename}`

Serves local recordings with HTTP Range support for video seeking.

**Used When:** `RECORDING_STORAGE_MODE=local`

**Response:** FileResponse with video/webm content type

**Features:**
- Supports HTTP Range requests (video seeking)
- Cache-Control headers for performance
- Path validation to prevent directory traversal

### 3. Get Playback URL

**GET** `/api/sessions/{session_id}/recording-url`

Returns playback URL based on storage mode.

**Authentication:** Required (trainer, learner, or session creator)

**Response:**
```json
{
  "playback_url": "https://s3.amazonaws.com/...",  // or /api/sessions/recordings/local/...
  "storage_mode": "s3",
  "expires_in": 3600  // seconds (S3 only, null for local)
}
```

## Storage Implementations

### Local Storage

**Class:** `LocalRecordingStorage`

**Directory Structure:**
```
/var/recordings/
├── 123/
│   ├── recording_2025-12-15_14-30-00.webm
│   └── recording_2025-12-15_15-45-00.webm
└── 124/
    └── recording_2025-12-15_16-00-00.webm
```

**Operations:**
- `save()`: Moves file from Janus temp dir to `/var/recordings/{session_id}/`
- `delete()`: Removes file and empty session directories
- `get_playback_url()`: Returns `/api/recordings/local/{path}` endpoint

**Requirements:**
- Ensure `/var/recordings/` is writable by FastAPI user
- Configure Nginx to proxy playback requests
- Mount volume in Docker Compose for persistence

### S3 Storage

**Class:** `S3RecordingStorage`

**S3 Structure:**
```
s3://hurshbintech-media-bucket/
└── recordings/
    ├── 123/
    │   ├── uuid1.webm
    │   └── uuid2.webm
    └── 124/
        └── uuid3.webm
```

**Operations:**
- `save()`: Uploads to S3 with UUID filename, deletes local temp file
- `delete()`: Removes object from S3
- `get_playback_url()`: Generates presigned URL (1-hour expiration)

**Requirements:**
- AWS credentials in environment
- S3 bucket exists and is accessible
- IAM permissions: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`

## Usage Examples

### In Application Code

```python
from app.services.recording_storage import get_recording_storage

# Get storage backend (automatically selects local or S3)
storage = get_recording_storage()

# Save recording
storage_path = await storage.save(
    local_path="/var/janus/recordings/rec-123.webm",
    session_id=123
)

# Get playback URL
playback_url = await storage.get_playback_url(storage_path)

# Delete recording
await storage.delete(storage_path)
```

### Testing Storage Backends

```python
# Test local storage
import os
os.environ['RECORDING_STORAGE_MODE'] = 'local'

from app.services.recording_storage import get_recording_storage
storage = get_recording_storage()
print(type(storage))  # <class 'LocalRecordingStorage'>

# Test S3 storage
os.environ['RECORDING_STORAGE_MODE'] = 's3'
storage = get_recording_storage()
print(type(storage))  # <class 'S3RecordingStorage'>
```

## Janus Configuration

Janus always records to a local directory. No changes needed to Janus config.

**janus.plugin.recordplay.jcfg:**
```
recordings: {
    path = "/var/janus/recordings"
}
```

FastAPI webhook handler retrieves the file from this path and processes it.

## Docker Setup

### Local Development

```yaml
# docker-compose.yml
services:
  backend:
    environment:
      - RECORDING_STORAGE_MODE=local
    volumes:
      - ./recordings:/var/recordings  # Persist recordings locally
      - ./janus-recordings:/var/janus/recordings  # Janus temp storage
```

### Production (S3)

```yaml
# docker-compose.prod.yml
services:
  backend:
    environment:
      - RECORDING_STORAGE_MODE=s3
      - USE_S3=true
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - AWS_REGION=ap-south-1
      - S3_BUCKET_NAME=hurshbintech-media-bucket
    volumes:
      - /tmp/janus-recordings:/var/janus/recordings  # Temp only, cleaned after upload
```

## Retention & Cleanup

### Automatic 30-Day Cleanup

The retention job in `app/workers/recording_retention.py` automatically deletes recordings older than 30 days.

**Setup with APScheduler** (recommended):

Add to `main.py`:
```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.workers.recording_retention import cleanup_old_recordings

scheduler = AsyncIOScheduler()
scheduler.add_job(
    cleanup_old_recordings,
    'cron',
    hour=2,
    minute=0,
    id='cleanup_recordings'
)
scheduler.start()
```

**Manual Execution:**
```bash
cd hurshbintech-backend
python -c "import asyncio; from app.workers.recording_retention import cleanup_old_recordings; asyncio.run(cleanup_old_recordings())"
```

**Cleanup Process:**
1. Queries sessions with `recording_uploaded_at < (now - 30 days)`
2. Calls `storage.delete(recording_url)` for each
3. Sets `recording_status = 'deleted'` and clears `recording_url`
4. Logs summary (deleted count, failed count)

## Security Considerations

### Webhook Security

1. **Token-Based Authentication:**
```python
# .env
JANUS_WEBHOOK_TOKEN=random_secure_token_here

# Janus webhook configuration
curl -H "X-Webhook-Token: random_secure_token_here" \
     -X POST http://backend:8000/api/sessions/recordings/webhook/complete
```

2. **Network-Level Security:**
   - Use firewall rules to restrict webhook endpoint to Janus server IP
   - Deploy Janus and FastAPI in same private network
   - Use internal DNS/service discovery

### Access Control

The `/api/sessions/{session_id}/recording-url` endpoint enforces:
- User must be authenticated
- User must be trainer, learner, or session creator
- Recording must be in "completed" status

### S3 Security

- Use IAM user with minimal permissions
- Enable S3 bucket encryption at rest
- Use presigned URLs with short expiration (1 hour)
- Consider CloudFront for additional security layer

## Troubleshooting

### Recording Not Appearing

1. **Check recording status:**
```sql
SELECT id, session_id, recording_status, recording_url 
FROM training_sessions 
WHERE id = 123;
```

2. **Check backend logs:**
```bash
docker-compose logs -f backend | grep -i recording
```

3. **Verify Janus webhook:**
```bash
# Test webhook manually
curl -X POST http://localhost:8000/api/sessions/recordings/webhook/complete \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": 123,
    "file_path": "/var/janus/recordings/test.webm",
    "recording_id": "test123",
    "duration": 60
  }'
```

### S3 Upload Failures

1. **Verify AWS credentials:**
```bash
docker-compose exec backend python -c "
from app.core.config import settings
print(f'Access Key: {settings.AWS_ACCESS_KEY_ID[:10]}...')
print(f'Region: {settings.AWS_REGION}')
print(f'Bucket: {settings.S3_BUCKET_NAME}')
"
```

2. **Test S3 connectivity:**
```bash
docker-compose exec backend python -c "
from app.utils.s3_utils import S3Manager
from app.core.config import settings
s3 = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
print('S3 client initialized successfully')
"
```

### Local Storage Permission Issues

```bash
# Fix permissions on recordings directory
sudo chown -R 1000:1000 /var/recordings
sudo chmod -R 755 /var/recordings

# Verify in Docker
docker-compose exec backend ls -la /var/recordings
```

## Frontend Integration

Update frontend session component to display recording:

```javascript
// In Dashboard.jsx or SessionDetails component
const viewRecording = async (sessionId) => {
  try {
    const response = await fetch(
      `${API_URL}/sessions/${sessionId}/recording-url`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const data = await response.json();
    
    if (data.playback_url) {
      // Open in new tab or embed in video player
      window.open(data.playback_url, '_blank');
    }
  } catch (error) {
    console.error('Failed to load recording:', error);
  }
};
```

## Performance Considerations

### Local Storage
- **Pros:** Fast access, no bandwidth costs, simple deployment
- **Cons:** Limited by disk space, no CDN, single point of failure
- **Best For:** Development, small deployments, <100 sessions/day

### S3 Storage
- **Pros:** Unlimited storage, CDN integration, high availability
- **Cons:** Bandwidth costs, presigned URL expiration, API latency
- **Best For:** Production, large scale, >100 sessions/day

### Optimization Tips

1. **Implement thumbnail generation:**
```python
# Add to S3RecordingStorage.save()
thumbnail_path = await generate_video_thumbnail(local_path)
thumbnail_key = f"thumbnails/{session_id}/{uuid4()}.jpg"
await s3_manager.upload_file(thumbnail_path, "thumbnails", session_id)
```

2. **Use CloudFront for S3:**
   - Reduces latency globally
   - Caches presigned URLs
   - Provides DDoS protection

3. **Compress recordings:**
```python
# Add compression before upload
import subprocess
compressed_path = f"{local_path}.compressed.webm"
subprocess.run([
    'ffmpeg', '-i', local_path,
    '-c:v', 'libvpx-vp9', '-crf', '30',
    compressed_path
])
```

## Migration from Existing System

If you have existing recordings:

1. **Audit existing recordings:**
```sql
SELECT COUNT(*) FROM training_sessions WHERE ended_at IS NOT NULL;
```

2. **Backfill recording URLs:**
```python
# Script to migrate existing recordings to new system
import asyncio
from app.services.recording_storage import get_recording_storage

async def migrate_recordings():
    storage = get_recording_storage()
    
    # Iterate through old recordings
    for old_path in find_old_recordings():
        session_id = extract_session_id(old_path)
        new_path = await storage.save(old_path, session_id)
        
        # Update database
        await update_session_recording_url(session_id, new_path)
```

3. **Verify migration:**
```sql
SELECT 
    COUNT(*) as total,
    COUNT(recording_url) as with_url,
    COUNT(recording_uploaded_at) as with_timestamp
FROM training_sessions 
WHERE ended_at IS NOT NULL;
```

## Monitoring & Metrics

### Key Metrics to Track

1. **Storage Usage:**
```python
# Add to retention job
total_size = sum([
    await storage.get_file_size(session.recording_url)
    for session in sessions
])
logger.info(f"Total storage: {total_size / (1024**3):.2f} GB")
```

2. **Upload Success Rate:**
```sql
SELECT 
    recording_status,
    COUNT(*) as count,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM training_sessions
WHERE ended_at > NOW() - INTERVAL '7 days'
GROUP BY recording_status;
```

3. **Webhook Latency:**
```python
# Add timing to webhook handler
import time
start = time.time()
await process_recording(...)
duration = time.time() - start
logger.info(f"Recording processed in {duration:.2f}s")
```

## Support & Maintenance

### Logs to Monitor

- **Webhook requests:** `"Received Janus webhook"`
- **Upload progress:** `"Recording saved"`, `"Recording uploaded to S3"`
- **Failures:** `"Failed to process recording"`, `"S3 upload failed"`
- **Cleanup:** `"Cleanup completed: X deleted"`

### Health Checks

Add to monitoring:
```python
@router.get("/recordings/health")
async def recording_health():
    storage = get_recording_storage()
    
    return {
        "storage_mode": settings.RECORDING_STORAGE_MODE,
        "storage_healthy": True,  # Test write/read
        "cleanup_last_run": get_last_cleanup_time(),
        "pending_uploads": count_pending_recordings()
    }
```

## Conclusion

This system provides a robust, scalable recording storage solution that:
- ✅ Works in local development without AWS
- ✅ Scales to production with S3
- ✅ Has no runtime branching (clean code)
- ✅ Handles cleanup automatically
- ✅ Supports video seeking
- ✅ Provides secure access control

For questions or issues, check logs first, then verify environment configuration.
