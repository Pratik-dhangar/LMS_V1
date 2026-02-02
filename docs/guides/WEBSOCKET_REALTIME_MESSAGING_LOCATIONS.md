# WebSocket Real-Time Messaging Channel - Codebase Locations

**Purpose**: This document shows where the WebSocket infrastructure for real-time whiteboard, chat, and sync is implemented across the codebase.

---

## Overview

The real-time messaging channel runs on **WebSocket** (not REST) to handle low-latency updates:

```
┌─────────────────────────────────────────────────────────────┐
│          WEBSOCKET REAL-TIME MESSAGING CHANNEL              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FRONTEND (Client-side)                                    │
│  └─ WhiteboardService class                                │
│     └─ Creates WebSocket connection                        │
│     └─ Sends & receives drawing, chat, sync events       │
│                                                             │
│  BACKEND (Server-side)                                     │
│  └─ websocket.py endpoints                                 │
│     └─ /ws/whiteboard/{session_id}                         │
│     └─ /ws/rtc/{session_id}                                │
│     └─ Manages connections & broadcasts messages           │
│                                                             │
│  CHAT SYSTEM (Specialized real-time chat)                 │
│  └─ Chat WebSocket endpoint                                │
│     └─ /ws (real-time chat)                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 1: Frontend - WhiteboardService

### File: [hurshbintech-frontend/src/api/services/whiteboardService.js](hurshbintech-frontend/src/api/services/whiteboardService.js)

**What it does**: Client-side WebSocket management for whiteboard, drawing, and real-time sync.

#### Constructor & Initialization

```javascript
// Lines 1-50
class WhiteboardService {
    constructor(wsUrl, sessionId, role) {
        this.wsUrl = wsUrl;           // ← WebSocket server URL
        this.sessionId = sessionId;   // ← Session ID
        this.role = role;             // ← 'trainer', 'learner', 'observer', etc.
        this.ws = null;               // ← WebSocket connection object
        
        // Callbacks for different event types
        this.onDraw = null;                      // Drawing events
        this.onClear = null;                     // Clear canvas
        this.onImage = null;                     // Image upload
        this.onItemUpdate = null;                // Item placement
        this.onToolAccess = null;                // Tool permissions
        this.onItemSelected = null;              // Item selection
        this.onPromptUpdate = null;              // Voice transcription
        this.onTextAdded = null;                 // Text box added
        this.onBucketAdded = null;               // Bucket fill
        this.onBucketUpdate = null;              // Bucket updates
        this.onVideoStateUpdate = null;          // Video sync
        this.onMediaControl = null;              // Media player controls
        this.onItemRemove = null;                // Item removal
        this.onErasePen = null;                  // Eraser tool
        this.onClearCanvas = null;               // Clear entire canvas
        this.onStopwatchSync = null;             // Stopwatch sync
        this.onFeedbackMessage = null;           // Feedback text
        this.onWaitingMessage = null;            // Waiting message
        this.onFloatingAnimations = null;        // Animations (bubbles, smileys, etc.)
        this.onAnimationPopped = null;           // Animation pop
        this.onTextBoxAdded = null;              // Text box added
        this.onTextBoxUpdate = null;             // Text box edit
        this.onTextBoxRemoved = null;            // Text box deleted
        this.onSessionEnded = null;              // Session end notification
        this.onYoutubePopupCreated = null;       // YouTube media opened
        this.onYoutubePopupClosed = null;        // YouTube media closed
        this.onBackgroundMusic = null;           // Music control
        this.onBackgroundMusicVolume = null;     // Volume change
        this.onExerciseUpdate = null;            // Exercise update
        this.onExerciseAnswerUpdate = null;      // Exercise answer update
        this.onExerciseResponse = null;          // Exercise submission
        this.onExerciseClosed = null;            // Exercise closed
        this.onCommentUpdate = null;             // Comments update
        this.onCommentsToggle = null;            // Comments tool toggle
    }
    
    // Initialize and connect
    initialize() {
        const wsUrl = this.wsUrl.replace('http', 'ws');  // Convert http to ws
        const fullWsUrl = `${wsUrl}/ws/whiteboard/${this.sessionId}`;  // ← Connection URL
        
        try {
            this.ws = new WebSocket(fullWsUrl);  // ← Create WebSocket
            this.setupWebSocket();                // ← Set up handlers
        } catch (error) {
            console.error('[WhiteboardService] Error creating WebSocket:', error);
        }
    }
}
```

#### WebSocket Setup - Message Handlers

```javascript
// Lines 56-300
setupWebSocket() {
    this.ws.onopen = () => {
        // Send 'join' message when connected
        const joinMessage = {
            type: 'join',
            sessionId: this.sessionId,
            role: this.role
        };
        this.ws.send(JSON.stringify(joinMessage));
    };

    // INCOMING MESSAGES - Handle all message types
    this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        switch (message.type) {
            // Drawing & Canvas
            case 'draw':
                if (this.onDraw) this.onDraw(message.data);
                break;
            case 'clear':
                if (this.onClear) this.onClear();
                break;
            case 'erase_pen':
                if (this.onErasePen) this.onErasePen(message.data);
                break;
            case 'clear_canvas':
                if (this.onClearCanvas) this.onClearCanvas(message.data);
                break;
            
            // Items & Objects
            case 'item_update':
                if (this.onItemUpdate) this.onItemUpdate(message.data);
                break;
            case 'item_remove':
                if (this.onItemRemove) this.onItemRemove(message.data);
                break;
            case 'item_selected':
                if (this.onItemSelected) this.onItemSelected(message.data);
                break;
            
            // Text & Prompts
            case 'text_added':
                if (this.onTextAdded) this.onTextAdded(message.data);
                break;
            case 'prompt_update':
                if (this.onPromptUpdate) this.onPromptUpdate(message.data);
                break;
            case 'text_box_added':
                if (this.onTextBoxAdded) this.onTextBoxAdded(message.data);
                break;
            case 'text_box_update':
                if (this.onTextBoxUpdate) this.onTextBoxUpdate(message.data);
                break;
            case 'text_box_removed':
                if (this.onTextBoxRemoved) this.onTextBoxRemoved(message.data);
                break;
            
            // Bucket/Fill
            case 'bucket_added':
                if (this.onBucketAdded) this.onBucketAdded(message.data);
                break;
            case 'bucket_update':
                if (this.onBucketUpdate) this.onBucketUpdate(message.data);
                break;
            
            // Video & Media
            case 'video_state':
                if (this.onVideoStateUpdate) this.onVideoStateUpdate(message.data);
                break;
            case 'media_control':
                if (this.onMediaControl) this.onMediaControl(message.data);
                break;
            case 'youtube_popup_created':
                if (this.onYoutubePopupCreated) this.onYoutubePopupCreated(message.data);
                break;
            case 'youtube_popup_closed':
                if (this.onYoutubePopupClosed) this.onYoutubePopupClosed(message.data);
                break;
            
            // Audio
            case 'background_music':
                if (this.onBackgroundMusic) this.onBackgroundMusic(message.data);
                break;
            case 'background_music_volume':
                if (this.onBackgroundMusicVolume) this.onBackgroundMusicVolume(message.data);
                break;
            
            // Exercises
            case 'exercise_update':
                if (this.onExerciseUpdate) this.onExerciseUpdate(message.data);
                break;
            case 'exercise_answer_update':
                if (this.onExerciseAnswerUpdate) this.onExerciseAnswerUpdate(message.data);
                break;
            case 'exercise_response':
                if (this.onExerciseResponse) this.onExerciseResponse(message.data);
                break;
            case 'exercise_closed':
                if (this.onExerciseClosed) this.onExerciseClosed(message.data);
                break;
            
            // Feedback & Sync
            case 'feedback_message':
                if (this.onFeedbackMessage) this.onFeedbackMessage(message.data);
                break;
            case 'waiting_message':
                if (this.onWaitingMessage) this.onWaitingMessage(message.data);
                break;
            case 'stopwatch_sync':
                if (this.onStopwatchSync) this.onStopwatchSync(message.data);
                break;
            
            // Animations
            case 'floating_animations':
                if (this.onFloatingAnimations) this.onFloatingAnimations(message.data);
                break;
            case 'animation_popped':
                if (this.onAnimationPopped) this.onAnimationPopped(message.data);
                break;
            
            // Comments
            case 'comment_update':
                if (this.onCommentUpdate) this.onCommentUpdate(message.data);
                break;
            case 'comments_toggle':
                if (this.onCommentsToggle) this.onCommentsToggle(message.data);
                break;
            
            // Session
            case 'session_ended':
                if (this.onSessionEnded) this.onSessionEnded(message.data);
                break;
            
            // Heartbeat
            case 'ping':
                // Respond to server heartbeat
                this.ws.send(JSON.stringify({ type: 'pong' }));
                break;
        }
    };

    this.ws.onerror = (error) => {
        console.error('[WhiteboardService] WebSocket error:', error);
    };

    this.ws.onclose = () => {
        console.log('[WhiteboardService] WebSocket closed');
    };
}
```

#### OUTGOING MESSAGES - Send Methods

```javascript
// Lines 315-420

// Drawing
sendDrawData(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'draw', data: data }));
    }
}

sendClear() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'clear' }));
    }
}

// Items
sendItemUpdate(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'item_update', data: data }));
    }
}

// Video & Media
sendVideoState(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'video_state', data: data }));
    }
}

sendMediaControl(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'media_control', data: data }));
    }
}

// Generic send
send(type, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: type, data: data }));
    }
}

close() {
    if (this.ws) this.ws.close();
}
```

---

## Part 2: Frontend - Component Integration

### File: [hurshbintech-frontend/src/pages/trainer/TrainerSession.jsx](hurshbintech-frontend/src/pages/trainer/TrainerSession.jsx)

**Where WhiteboardService is used**:

```jsx
// Line 17: Import
import WhiteboardService from '../../api/services/whiteboardService';

// Line 126: State
const [whiteboardService, setWhiteboardService] = useState(null);

// Line ~650: Initialize whiteboard on session start
const initializeWhiteboardService = () => {
    try {
        // Create WebSocket connection
        const service = new WhiteboardService(
            `wss://${WS_BASE_URL.split('//')[1]}`,
            sessionId,
            'trainer'
        );
        
        // Set up callbacks for incoming messages
        service.onDraw = (drawingData) => {
            updateWhiteboardCanvas(drawingData);
        };
        
        service.onItemUpdate = (itemData) => {
            updateItems(itemData);
        };
        
        service.onExerciseResponse = (response) => {
            handleExerciseResponse(response);
        };
        
        // Connect
        service.initialize();
        setWhiteboardService(service);
        
    } catch (error) {
        console.error('[TrainerSession] Whiteboard init error:', error);
    }
};

// Line ~370: Send drawing via WebSocket
useEffect(() => {
    if (!whiteboardService || stopwatch.elapsedTime < 0) return;
    
    if (!whiteboardService.ws || whiteboardService.ws.readyState !== WebSocket.OPEN) {
        return;
    }
    
    // Send stopwatch sync
    whiteboardService.send('stopwatch_sync', {
        elapsedTime: stopwatch.elapsedTime,
        isRunning: stopwatch.isRunning
    });
}, [whiteboardService, stopwatch.elapsedTime, stopwatch.isRunning]);

// Line ~670: Cleanup
const cleanup = () => {
    if (whiteboardService) {
        whiteboardService.close();
    }
    // ... other cleanup
};
```

---

## Part 3: Backend - WebSocket Endpoints

### File: [hurshbintech-backend/app/api/endpoints/websocket.py](hurshbintech-backend/app/api/endpoints/websocket.py)

**Main WebSocket server implementation**:

#### Configuration

```python
# Lines 1-40
import asyncio
import logging
from datetime import datetime
from typing import Dict, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

# Logging setup
logger = logging.getLogger(__name__)

# WebSocket configuration
HEARTBEAT_INTERVAL = 30      # Ping every 30s
HEARTBEAT_TIMEOUT = 90       # Close if no pong within 90s
MAX_RECONNECT_ATTEMPTS = 3   # Max reconnection attempts

# Connection info tracking
class ConnectionInfo:
    def __init__(self, websocket, role, session_id):
        self.websocket = websocket
        self.role = role
        self.session_id = session_id
        self.last_heartbeat = datetime.utcnow()
        self.is_alive = True
        self.heartbeat_task = None
```

#### Whiteboard Endpoint

```python
# Lines 379-500
@router.websocket("/ws/whiteboard/{session_id}")
async def websocket_whiteboard_endpoint(websocket: WebSocket, session_id: str):
    """
    Whiteboard and media sharing endpoint
    Supports: session_XXXX (training), coach_session_XXXX (coach)
    Roles: trainer, learner, observer, coach, client, guest
    """
    print(f"[WHITEBOARD] New connection for session: {session_id}")
    await websocket.accept()
    
    role = None
    conn_info = None
    try:
        # Wait for join message
        join_msg = await websocket.receive_json()
        
        if join_msg.get("type") != "join":
            await websocket.close()
            return
        
        role = join_msg.get("role")
        
        # Initialize session if needed
        if session_id not in whiteboard_connections:
            whiteboard_connections[session_id] = {}
        
        # Create connection info and start heartbeat
        conn_info = ConnectionInfo(websocket, role, session_id)
        whiteboard_connections[session_id][role] = conn_info
        conn_info.heartbeat_task = asyncio.create_task(send_heartbeat(conn_info))
        
        # Send existing media state if applicable
        if session_id in media_states:
            try:
                await websocket.send_json({
                    "type": "media_control",
                    "data": media_states[session_id]
                })
            except Exception as e:
                print(f"[WHITEBOARD] Error sending media state: {e}")
        
        # MESSAGE LOOP - Listen for incoming messages
        try:
            while conn_info.is_alive:
                message = await websocket.receive_json()
                
                # Heartbeat pong response
                if message.get("type") == "pong":
                    conn_info.last_heartbeat = datetime.utcnow()
                    logger.debug(f"[WHITEBOARD] Pong from {role}")
                    continue
                
                logger.debug(f"[WHITEBOARD] {role} → {message.get('type')}")
                
                # Handle media control
                if message.get("type") == "media_control":
                    await handle_media_control(message, session_id, role, websocket)
                else:
                    # BROADCAST to other participants in same session
                    # Map who should receive the message
                    role_mapping = {
                        "trainer": ["learner", "observer"],
                        "learner": ["trainer"],
                        "coach": ["client", "guest"],
                        "client": ["coach"],
                        "guest": ["coach"],
                        "observer": []  # Read-only
                    }
                    
                    other_roles = role_mapping.get(role, [])
                    
                    # Send message to each recipient
                    for other_role in other_roles:
                        if other_role in whiteboard_connections[session_id]:
                            other_conn = whiteboard_connections[session_id][other_role]
                            if other_conn.is_alive:
                                logger.debug(f"[WHITEBOARD] Forward to {other_role}")
                                try:
                                    await other_conn.websocket.send_json(message)
                                except Exception as e:
                                    logger.error(f"Failed to send: {e}")
        
        except WebSocketDisconnect:
            print(f"[WHITEBOARD] {role} disconnected from {session_id}")
    
    except WebSocketDisconnect:
        print(f"[WHITEBOARD] {role} disconnected during setup")
    
    except Exception as e:
        print(f"[WHITEBOARD] Error: {str(e)}")
    
    finally:
        # Cleanup
        await cleanup_connection(whiteboard_connections, session_id, role)
```

#### RTC Signaling Endpoint

```python
# Lines 155-350
@router.websocket("/ws/rtc/{session_id}")
async def websocket_rtc_endpoint(websocket: WebSocket, session_id: str):
    """
    WebRTC signaling endpoint for SDP offer/answer and ICE candidates
    Used alongside /ws/whiteboard for complete P2P setup
    """
    logger.info(f"[WebSocket] RTC connection for session: {session_id}")
    await websocket.accept()
    
    role = None
    conn_info = None
    try:
        # Wait for initial join with role
        join_msg = await websocket.receive_json()
        
        if join_msg.get("type") != "join":
            await websocket.close()
            return
        
        role = join_msg.get("role")
        logger.info(f"[RTC] Role: {role} for session: {session_id}")
        
        # Initialize session if needed
        if session_id not in rtc_connections:
            rtc_connections[session_id] = {}
        
        # Create connection info
        conn_info = ConnectionInfo(websocket, role, session_id)
        rtc_connections[session_id][role] = conn_info
        
        # Check if both peers connected
        if len(rtc_connections[session_id]) == 2:
            # Both trainer and learner connected!
            # Notify trainer to create offer
            for conn in rtc_connections[session_id].values():
                if conn.role == "trainer":
                    try:
                        await conn.websocket.send_json({
                            "type": "peer_ready"
                        })
                    except Exception as e:
                        logger.error(f"Error notifying trainer: {e}")
        
        # SIGNALING LOOP - Handle SDP and ICE
        try:
            while conn_info.is_alive:
                message = await websocket.receive_json()
                msg_type = message.get("type")
                
                # Route signaling messages to peer
                if msg_type in ["offer", "answer", "ice_candidate"]:
                    # Find peer in same session
                    target_role = "learner" if role == "trainer" else "trainer"
                    
                    if target_role in rtc_connections[session_id]:
                        peer_conn = rtc_connections[session_id][target_role]
                        if peer_conn.is_alive:
                            try:
                                await peer_conn.websocket.send_json(message)
                            except Exception as e:
                                logger.error(f"Failed to route {msg_type}: {e}")
        
        except WebSocketDisconnect:
            logger.info(f"[RTC] {role} disconnected")
```

---

## Part 4: Chat System WebSocket

### File: [hurshbintech-backend/app/api/endpoints/Chat/chat.py](hurshbintech-backend/app/api/endpoints/Chat/chat.py)

**Specialized WebSocket for real-time chat**:

```python
# Lines 577-620
@router.websocket("/ws")
async def chat_websocket_endpoint(
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db)
):
    """
    WebSocket endpoint for real-time chat
    Handles:
    - User connection/disconnection
    - Real-time message delivery
    - Typing indicators
    - Online status
    - Read receipts
    """
    user_id = None
    
    try:
        await websocket.accept()
        
        # Wait for join message with authentication
        try:
            join_data = await websocket.receive_json()
        except Exception as e:
            logger.error(f"Error receiving join: {e}")
            await websocket.close(code=1008)
            return
        
        if join_data.get("type") != "join":
            logger.error(f"Invalid message type: {join_data.get('type')}")
            await websocket.close(code=1008)
            return
        
        # Extract and validate user
        user_id = join_data.get("user_id")
        
        if not user_id:
            await websocket.close(code=1008)
            return
        
        # Add connection to manager
        connection_manager.connect(user_id, websocket)
        logger.info(f"User {user_id} connected to chat")
        
        # MESSAGE LOOP
        try:
            while True:
                data = await websocket.receive_json()
                msg_type = data.get("type")
                
                if msg_type == "message":
                    # New message - store and broadcast
                    chat_message = ChatMessage(
                        sender_id=user_id,
                        conversation_id=data.get("conversation_id"),
                        text=data.get("text"),
                        created_at=datetime.utcnow()
                    )
                    
                    # Save to DB
                    db.add(chat_message)
                    await db.commit()
                    
                    # Broadcast to recipient
                    recipient_id = data.get("recipient_id")
                    await connection_manager.broadcast_to_user(
                        recipient_id,
                        {
                            "type": "message",
                            "data": chat_message
                        }
                    )
                
                elif msg_type == "typing":
                    # Typing indicator
                    recipient_id = data.get("recipient_id")
                    await connection_manager.broadcast_to_user(
                        recipient_id,
                        { "type": "typing", "user_id": user_id }
                    )
                
                elif msg_type == "read":
                    # Read receipt
                    recipient_id = data.get("recipient_id")
                    await connection_manager.broadcast_to_user(
                        recipient_id,
                        { "type": "read", "user_id": user_id }
                    )
        
        except WebSocketDisconnect:
            connection_manager.disconnect(user_id, websocket)
            logger.info(f"User {user_id} disconnected")
```

#### Connection Manager

```python
# File: hurshbintech-backend/app/services/Chat/chat_connection_manager.py

class ConnectionManager:
    def __init__(self):
        # Active WebSocket connections: {user_id: List[WebSocket]}
        self.active_connections: Dict[int, List[WebSocket]] = {}
    
    async def connect(self, user_id: int, websocket: WebSocket):
        """Add a WebSocket connection for a user"""
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        
        self.active_connections[user_id].append(websocket)
        logger.info(f"User {user_id} connected. Total connections: {len(self.active_connections[user_id])}")
    
    async def disconnect(self, user_id: int, websocket: WebSocket):
        """Remove a WebSocket connection"""
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
    
    async def broadcast_to_user(self, user_id: int, message: dict):
        """Send message to all connections of a user"""
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to send message: {e}")
    
    async def broadcast_to_conversation(self, conversation_id: int, message: dict):
        """Broadcast to all users in a conversation"""
        # Get all participants in conversation from DB
        # Send message to each
```

---

## Part 5: Backend Main Application Setup

### File: [hurshbintech-backend/main.py](hurshbintech-backend/main.py)

**How WebSocket endpoints are registered**:

```python
# Line 45: Import WebSocket router
from app.api.endpoints.websocket import router as websocket_router

# Line 190-194: Register WebSocket endpoints
# ✅ WebSocket should NOT have /api prefix
app.include_router(websocket_router)

# This makes WebSocket endpoints available at:
# - ws://localhost:8000/ws/whiteboard/{session_id}
# - ws://localhost:8000/ws/rtc/{session_id}
# - ws://localhost:8000/ws (chat)
```

---

## Part 6: Message Flow Diagram

### Whiteboard Drawing Example

```
┌──────────────────┐
│   TRAINER SIDE   │
│ (TrainerSession) │
└────────┬─────────┘
         │
         │ 1. User draws on canvas
         │ 2. React updates local state
         │ 3. Calls whiteboardService.sendDrawData({...})
         ↓
┌────────────────────────────────────────┐
│   WhiteboardService (Frontend)         │
│ this.ws.send(JSON.stringify({          │
│   type: 'draw',                        │
│   data: { points, color, size, ... }  │
│ }))                                    │
└────────┬─────────────────────────────┬─┘
         │                             │
         ↓ WebSocket Frame            ↓ WebSocket Frame
┌────────────────────────────┐   ┌──────────────────────┐
│   BACKEND WEBSOCKET        │   │   OTHER PARTICIPANTS │
│ /ws/whiteboard/sess_123    │   │ (Learner, Observer)  │
│                            │   │                      │
│ Receives: {type:'draw'...} │   │                      │
│                            │   │                      │
│ Message Loop:              │   │                      │
│ ├─ Identify sender: trainer│   │                      │
│ ├─ Look up recipients:     │   │                      │
│ │  trainer→[learner,obs]   │   │                      │
│ └─ Forward to each recipient───────→ Learner WS
│                            │   │      Receives message
│                            │   │
│                            │   ↓
│                            │  ┌──────────────────────┐
│                            │  │  LearnerSession      │
│                            │  │ whiteboardService    │
│                            │  │  .onDraw()           │
│                            │  │  triggered           │
│                            │  │                      │
│                            │  │ ├─ Parse draw data   │
│                            │  │ ├─ Update canvas     │
│                            │  │ └─ Display to learner│
│                            └──┘                      │
                                 └──────────────────────┘
                                 
                         LATENCY: ~50-200ms
```

---

## Part 7: All WebSocket Connection URLs

### Training Sessions

| Endpoint | Purpose | URL Pattern |
|----------|---------|------------|
| Whiteboard | Drawing, items, media | `ws://localhost:8000/ws/whiteboard/session_XXX` |
| RTC Signaling | SDP offer/answer, ICE | `ws://localhost:8000/ws/rtc/session_XXX` |

### Coach Sessions

| Endpoint | Purpose | URL Pattern |
|----------|---------|------------|
| Whiteboard | Drawing, items, media | `ws://localhost:8000/ws/whiteboard/coach_session_XXX` |
| RTC Signaling | SDP offer/answer, ICE | `ws://localhost:8000/ws/rtc/coach_session_XXX` |

### Chat System

| Endpoint | Purpose | URL Pattern |
|----------|---------|------------|
| Chat | Real-time messaging | `ws://localhost:8000/ws` |

---

## Part 8: Message Types Reference

### Drawing & Canvas

```json
{ "type": "draw", "data": { "points": [...], "color": "#000", "size": 2 } }
{ "type": "clear" }
{ "type": "erase_pen", "data": {...} }
{ "type": "clear_canvas", "data": {...} }
```

### Items

```json
{ "type": "item_update", "data": { "id": 1, "x": 100, "y": 200 } }
{ "type": "item_remove", "data": { "id": 1 } }
{ "type": "item_selected", "data": { "id": 1 } }
```

### Text

```json
{ "type": "text_added", "data": { "text": "Hello" } }
{ "type": "text_box_added", "data": { "id": "txt_1", "x": 50, "y": 100, "text": "..." } }
{ "type": "text_box_update", "data": { "id": "txt_1", "text": "Updated" } }
```

### Media

```json
{ "type": "video_state", "data": { "playing": true } }
{ "type": "media_control", "data": { "action": "play", "mediaId": 123 } }
{ "type": "youtube_popup_created", "data": { "url": "..." } }
```

### Exercises

```json
{ "type": "exercise_update", "data": { "exerciseId": 1, "items": [...] } }
{ "type": "exercise_response", "data": { "exerciseId": 1, "answers": [...] } }
```

### Session

```json
{ "type": "session_ended", "data": { "reason": "trainer" } }
```

### System

```json
{ "type": "ping" }
{ "type": "pong" }
{ "type": "join", "sessionId": "sess_123", "role": "trainer" }
```

---

## Summary: Complete Architecture

```
FRONTEND CLIENT (Browser)
│
├─ WhiteboardService (whiteboardService.js)
│  ├─ new WebSocket(`/ws/whiteboard/{sessionId}`)
│  ├─ Sends: drawing, items, text, media, exercises
│  ├─ Receives: all of the above from other participants
│  └─ Manages: callbacks, reconnection, heartbeat
│
└─ ChatWidget
   └─ new WebSocket(`/ws`)
      ├─ Sends: messages, typing, read receipts
      └─ Receives: messages from other users

            ↕ WebSocket (TCP/WebSocket protocol)

BACKEND SERVER (FastAPI)
│
├─ /ws/whiteboard/{session_id}
│  ├─ Accepts connections from trainer/learner/observer/coach/client
│  ├─ Routes messages between participants
│  ├─ Maintains session state
│  └─ Handles heartbeat/reconnection
│
├─ /ws/rtc/{session_id}
│  ├─ Routes SDP offer/answer
│  ├─ Routes ICE candidates
│  └─ Detects when both peers connected (sends peer_ready)
│
└─ /ws (Chat)
   ├─ Accepts user connections
   ├─ Manages message delivery
   ├─ Handles typing indicators
   └─ Tracks online status

RESULTS:
├─ Drawing & whiteboard: ~50-200ms latency (server relay)
├─ Chat messages: ~100-300ms latency (server relay + DB)
├─ Video/Audio: ~50-100ms latency (P2P direct)
└─ Session sync: ~50-200ms latency (server relay)
```

---

**Related Documentation:**
- [SESSION_FLOW_GUIDE.md](SESSION_FLOW_GUIDE.md) - How sessions initialize
- [WEBRTC_WEBSOCKET_CODE_WALKTHROUGH.md](WEBRTC_WEBSOCKET_CODE_WALKTHROUGH.md) - Technical WebRTC flow
- [CHAT_SYSTEM_ARCHITECTURE.md](CHAT_SYSTEM_ARCHITECTURE.md) - Chat widget architecture

**Key Files to Review:**
1. Frontend: [whiteboardService.js](hurshbintech-frontend/src/api/services/whiteboardService.js) - Main client
2. Backend: [websocket.py](hurshbintech-backend/app/api/endpoints/websocket.py) - Server handlers
3. Backend: [chat.py](hurshbintech-backend/app/api/endpoints/Chat/chat.py) - Chat WebSocket
4. Frontend: [TrainerSession.jsx](hurshbintech-frontend/src/pages/trainer/TrainerSession.jsx) - Component integration
