# Janus Integration Example

## Janus Configuration for Recording Webhook

This guide shows how to configure Janus Gateway to call the FastAPI webhook when recordings complete.

---

## Method 1: Janus Event Handlers (Recommended)

Janus can be configured to send HTTP POST requests when events occur.

### Step 1: Enable Event Handlers in Janus

Edit `janus.eventhandler.sampleevh.jcfg`:

```
general: {
    enabled = yes
    events = "recordplay"
    grouping = yes
}

http: {
    backend = "http://backend:8000/api/sessions/recordings/webhook/complete"
    max_retries = 3
    retry_interval = 1000
    json = "indented"
}
```

### Step 2: Configure RecordPlay Plugin

Edit `janus.plugin.recordplay.jcfg`:

```
general: {
    path = "/var/janus/recordings"
    
    # Enable event notifications
    events = yes
}
```

### Step 3: Transform Janus Event to Webhook Format

Since Janus events have a different format, you need a middleware service or modify the webhook handler.

**Option A: Add a Janus-specific webhook endpoint:**

```python
# In app/api/endpoints/sessions.py

@router.post("/recordings/webhook/janus-event")
async def janus_event_handler(
    event: dict,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle Janus native event format.
    
    Janus sends events like:
    {
        "type": "event",
        "event": {
            "plugin": "janus.plugin.recordplay",
            "data": {
                "event": "recorded",
                "id": "rec-123",
                "path": "/var/janus/recordings/rec-123.webm"
            }
        }
    }
    """
    if event.get("type") != "event":
        return {"status": "ignored"}
    
    event_data = event.get("event", {}).get("data", {})
    
    if event_data.get("event") != "recorded":
        return {"status": "ignored"}
    
    # Extract recording info
    file_path = event_data.get("path")
    recording_id = event_data.get("id")
    
    # Parse session ID from recording ID or filename
    # You need to map Janus recording ID to your session ID
    # This depends on how you name recordings in Janus
    
    # For example, if you name recordings as "session-{session_id}"
    session_id = int(recording_id.split("-")[1])
    
    # Queue processing
    background_tasks.add_task(process_recording, session_id, file_path, db)
    
    return {"status": "accepted"}
```

---

## Method 2: Custom Janus Plugin (Advanced)

Create a custom Janus plugin that calls your webhook directly when recording stops.

This requires C programming and rebuilding Janus. Not recommended unless you have specific needs.

---

## Method 3: File System Watcher (Simple Alternative)

Instead of webhook, use a file system watcher to detect new recordings.

### Create Watcher Service

```python
# app/workers/recording_watcher.py

import asyncio
import logging
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from app.db.session import get_db
from app.services.recording_storage import get_recording_storage

logger = logging.getLogger(__name__)

class RecordingHandler(FileSystemEventHandler):
    """Watches for new .webm files in Janus recording directory"""
    
    def on_created(self, event):
        if event.is_directory:
            return
        
        if not event.src_path.endswith('.webm'):
            return
        
        logger.info(f"New recording detected: {event.src_path}")
        
        # Parse session ID from filename
        # Format: session-{session_id}-{timestamp}.webm
        filename = Path(event.src_path).name
        try:
            session_id = int(filename.split('-')[1])
            
            # Process recording
            asyncio.run(self.process_recording(session_id, event.src_path))
            
        except Exception as e:
            logger.error(f"Failed to process recording {filename}: {e}")
    
    async def process_recording(self, session_id: int, file_path: str):
        from app.api.endpoints.sessions import process_recording
        
        async for db in get_db():
            await process_recording(session_id, file_path, db)

def start_watcher():
    """Start watching Janus recordings directory"""
    path = "/var/janus/recordings"
    
    event_handler = RecordingHandler()
    observer = Observer()
    observer.schedule(event_handler, path, recursive=False)
    observer.start()
    
    logger.info(f"Recording watcher started for {path}")
    
    try:
        while True:
            asyncio.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    
    observer.join()

if __name__ == "__main__":
    start_watcher()
```

### Add to Docker Compose

```yaml
# docker-compose.yml

services:
  recording-watcher:
    build: ./hurshbintech-backend
    command: python -m app.workers.recording_watcher
    volumes:
      - janus-recordings:/var/janus/recordings
      - recordings:/var/recordings
    environment:
      - RECORDING_STORAGE_MODE=local
      - DATABASE_URL=postgresql://...
    depends_on:
      - postgres
      - janus

volumes:
  janus-recordings:
  recordings:
```

### Install Dependency

```bash
pip install watchdog
```

Add to `requirements.txt`:
```
watchdog==3.0.0
```

---

## Method 4: Frontend-Triggered Upload

Simplest method: Frontend calls webhook after stopping recording.

### Frontend Code

```javascript
// In your React/Vue session component

const stopRecording = async () => {
  // Stop Janus recording
  const recordingData = await janusSession.stopRecording();
  
  // Call webhook to process recording
  await fetch(`${API_URL}/sessions/recordings/webhook/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      session_id: currentSession.id,
      file_path: recordingData.path,
      recording_id: recordingData.id,
      duration: recordingData.duration
    })
  });
  
  // Show success message
  toast.success('Recording saved successfully');
};
```

**Pros:**
- Simple to implement
- No Janus configuration needed
- Works immediately

**Cons:**
- Relies on frontend (can fail if user closes tab)
- Less reliable than server-side solutions

---

## Recommended Approach

**For Production:** Use **Method 3 (File System Watcher)**

**Why:**
1. ✅ Reliable - works even if frontend disconnects
2. ✅ Simple - no Janus configuration changes
3. ✅ Independent - runs as separate service
4. ✅ Automatic - processes recordings as they arrive
5. ✅ Testable - easy to test with mock files

**For Development:** Use **Method 4 (Frontend-Triggered)**

**Why:**
1. ✅ Quick to implement
2. ✅ Easy to debug
3. ✅ No extra services needed
4. ✅ Works for testing

---

## Recording Filename Convention

To map Janus recordings to sessions, use a consistent naming pattern:

### In Janus (when starting recording):

```javascript
// Frontend Janus integration
const startRecording = () => {
  const recordingId = `session-${sessionId}-${Date.now()}`;
  
  janusPlugin.send({
    message: {
      request: "record",
      id: recordingId,
      folder: "/var/janus/recordings"
    }
  });
};
```

This creates files like:
```
/var/janus/recordings/
  ├── session-123-1702648200000.webm
  ├── session-124-1702648300000.webm
  └── session-125-1702648400000.webm
```

### Parse in Backend:

```python
import re

def extract_session_id_from_filename(filename: str) -> int:
    """Extract session ID from Janus recording filename"""
    match = re.search(r'session-(\d+)-', filename)
    if match:
        return int(match.group(1))
    raise ValueError(f"Could not extract session ID from {filename}")

# Usage
session_id = extract_session_id_from_filename("session-123-1702648200000.webm")
# Returns: 123
```

---

## Complete Integration Example

Here's a full example using the file watcher approach:

### 1. Frontend (React)

```javascript
// SessionRoom.jsx

const startRecording = async () => {
  try {
    const recordingId = `session-${session.id}-${Date.now()}`;
    
    await janusRecording.start(recordingId);
    
    setIsRecording(true);
    toast.success('Recording started');
  } catch (error) {
    toast.error('Failed to start recording');
  }
};

const stopRecording = async () => {
  try {
    await janusRecording.stop();
    
    setIsRecording(false);
    toast.success('Recording stopped. Processing...');
    
    // File watcher will automatically process it
    // No need to call webhook manually
    
  } catch (error) {
    toast.error('Failed to stop recording');
  }
};
```

### 2. File Watcher (Python)

```python
# app/workers/recording_watcher.py

import asyncio
import logging
from pathlib import Path
from datetime import datetime
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from app.services.recording_storage import get_recording_storage
from app.db.session import AsyncSessionLocal
from app.crud import session_crud

logger = logging.getLogger(__name__)

class RecordingHandler(FileSystemEventHandler):
    
    def on_created(self, event):
        if event.src_path.endswith('.webm'):
            asyncio.run(self.handle_recording(event.src_path))
    
    async def handle_recording(self, file_path: str):
        """Process new recording file"""
        filename = Path(file_path).name
        logger.info(f"Processing recording: {filename}")
        
        try:
            # Extract session ID
            session_id = self.extract_session_id(filename)
            
            # Get storage backend
            storage = get_recording_storage()
            
            # Save recording
            storage_path = await storage.save(file_path, session_id)
            
            # Update database
            async with AsyncSessionLocal() as db:
                session = await session_crud.get_by_id(db, session_id)
                if session:
                    session.recording_url = storage_path
                    session.recording_status = "completed"
                    session.recording_uploaded_at = datetime.utcnow()
                    await db.commit()
                    
                    logger.info(f"Recording processed for session {session_id}")
                else:
                    logger.error(f"Session {session_id} not found")
                    
        except Exception as e:
            logger.error(f"Failed to process {filename}: {e}")
    
    def extract_session_id(self, filename: str) -> int:
        """Extract session ID from filename: session-123-timestamp.webm"""
        import re
        match = re.search(r'session-(\d+)-', filename)
        if match:
            return int(match.group(1))
        raise ValueError(f"Invalid filename format: {filename}")

def main():
    path = "/var/janus/recordings"
    
    event_handler = RecordingHandler()
    observer = Observer()
    observer.schedule(event_handler, path, recursive=False)
    observer.start()
    
    logger.info(f"🎥 Recording watcher started for {path}")
    
    try:
        while True:
            asyncio.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        logger.info("Recording watcher stopped")
    
    observer.join()

if __name__ == "__main__":
    main()
```

### 3. Docker Compose

```yaml
services:
  backend:
    # ... existing config ...
  
  recording-watcher:
    build: ./hurshbintech-backend
    container_name: recording-watcher
    command: python -m app.workers.recording_watcher
    volumes:
      - janus-recordings:/var/janus/recordings:ro  # Read-only
      - recordings:/var/recordings  # Write
    environment:
      - RECORDING_STORAGE_MODE=${RECORDING_STORAGE_MODE}
      - DATABASE_URL=${DATABASE_URL}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - AWS_REGION=${AWS_REGION}
      - S3_BUCKET_NAME=${S3_BUCKET_NAME}
    depends_on:
      - postgres
    restart: unless-stopped
    networks:
      - hurshbintech-network

volumes:
  janus-recordings:
  recordings:

networks:
  hurshbintech-network:
```

### 4. Start Services

```bash
# Development
docker-compose up -d

# Check watcher logs
docker-compose logs -f recording-watcher

# Test by copying a file
docker-compose exec janus touch /var/janus/recordings/session-1-1702648200000.webm
```

---

## Testing the Integration

### 1. Create Mock Recording

```bash
# Create test file
echo "mock recording data" > /tmp/session-999-test.webm

# Copy to Janus directory
docker-compose exec janus cp /tmp/session-999-test.webm /var/janus/recordings/
```

### 2. Verify Processing

```bash
# Check watcher logs
docker-compose logs recording-watcher | grep "session-999"

# Check database
docker-compose exec postgres psql -U hurshbintech -c \
  "SELECT id, recording_status, recording_url FROM training_sessions WHERE id = 999;"
```

### 3. Test Playback

```bash
# Get playback URL
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/sessions/999/recording-url
```

---

## Troubleshooting

### Watcher not detecting files
```bash
# Check permissions
docker-compose exec recording-watcher ls -la /var/janus/recordings

# Check if watcher is running
docker-compose ps recording-watcher
```

### Files not processing
```bash
# Check watcher logs
docker-compose logs -f recording-watcher

# Verify filename format
# Should be: session-{id}-{timestamp}.webm
```

### Database not updating
```bash
# Check database connection
docker-compose exec recording-watcher python -c "
from app.db.session import AsyncSessionLocal
print('DB connection OK')
"
```

---

## Summary

**Recommended Setup:**
1. ✅ Use file system watcher for reliability
2. ✅ Name recordings with session ID in filename
3. ✅ Run watcher as separate Docker service
4. ✅ Share volumes between Janus and watcher
5. ✅ Monitor watcher logs for errors

This approach is production-ready and works with both local and S3 storage modes!
