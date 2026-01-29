# WebRTC/WebSocket Trainer-Learner Session - Complete Code Walkthrough

## Table of Contents
1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Backend WebSocket Signaling Server](#backend-websocket-signaling-server)
4. [Frontend Video Conference Service](#frontend-video-conference-service)
5. [Session Components Flow](#session-components-flow)
6. [Debugging Guide](#debugging-guide)
7. [Common Issues & Solutions](#common-issues--solutions)

---

## Overview

This document provides a **line-by-line explanation** of how WebRTC video conferencing works between trainer and learner in your application. It covers:
- WebSocket signaling (backend)
- WebRTC peer-to-peer connection (frontend)
- Session initialization and teardown
- Debugging techniques

**Key Files:**
- Backend: `hurshbintech-backend/app/api/endpoints/websocket.py`
- Frontend Service: `hurshbintech-frontend/src/api/services/videoConferenceService.js`
- Trainer UI: `hurshbintech-frontend/src/pages/trainer/TrainerSession.jsx`
- Learner UI: `hurshbintech-frontend/src/pages/learner/LearnerSession.jsx`

---

## Architecture Diagram

```
┌─────────────────┐                    ┌─────────────────┐
│   TRAINER       │                    │   LEARNER       │
│  (Initiator)    │                    │  (Answerer)     │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │ 1. WebSocket Connect                 │
         │────────────────────┐                 │
         │                    ▼                 │
         │              ┌──────────┐            │
         │              │ Backend  │            │
         │              │WebSocket │            │
         │              │ Server   │            │
         │              │(/ws/rtc) │            │
         │              └──────────┘            │
         │                    ▲                 │
         │                    │                 │
         │ 2. Join message    │  3. Join message│
         │────────────────────┤◄────────────────┤
         │                    │                 │
         │ 4. peer_ready ◄────┤                 │
         │◄───────────────────┤                 │
         │                    │                 │
         │ 5. Create Offer    │                 │
         │────────────────────┤                 │
         │                    │  6. Forward     │
         │                    ├────────────────►│
         │                    │                 │
         │                    │  7. Create Answer
         │                    │◄────────────────│
         │ 8. Forward ◄───────┤                 │
         │◄───────────────────┤                 │
         │                    │                 │
         │ 9. ICE Candidates ─┼──► ICE Candidates
         │◄───────────────────┼────────────────►│
         │                    │                 │
         │        WebRTC P2P Connection         │
         │◄═══════════════════════════════════►│
         │    (Audio/Video directly)            │
         └──────────────────────────────────────┘
```

---

## Backend WebSocket Signaling Server

### File: `app/api/endpoints/websocket.py`

#### 1. **Connection Info Class** (Lines 56-79)

```python
class ConnectionInfo:
    """Track WebSocket connection state"""
    
    def __init__(self, websocket: WebSocket, role: str, session_id: str, user_data: Optional[dict] = None):
        self.websocket = websocket          # WebSocket connection object
        self.role = role                    # 'trainer', 'learner', or 'observer'
        self.session_id = session_id        # Unique session identifier
        self.user_data = user_data          # User metadata (for observers)
        self.last_heartbeat = datetime.utcnow()  # Track last ping/pong
        self.is_alive = True                # Connection health flag
        self.heartbeat_task: Optional[asyncio.Task] = None  # Background ping task
```

**🔍 Purpose:**
- Stores metadata about each WebSocket connection
- Tracks heartbeat to detect disconnections
- Manages cleanup via async task

**🐛 Debug Tip:**
```python
# Add this after initialization to see connection details:
logger.info(f"ConnectionInfo created: role={self.role}, session={self.session_id}, alive={self.is_alive}")
```

---

#### 2. **Heartbeat Mechanism** (Lines 91-127)

```python
async def send_heartbeat(conn_info: ConnectionInfo):
    """Send periodic ping messages to keep connection alive"""
    try:
        while conn_info.is_alive:
            # Check if last heartbeat is too old BEFORE sending next ping
            elapsed = (datetime.utcnow() - conn_info.last_heartbeat).total_seconds()
            if elapsed > HEARTBEAT_TIMEOUT:  # 90 seconds
                logger.warning(f"Connection timeout for {conn_info.role} (no pong for {elapsed:.1f}s)")
                conn_info.is_alive = False
                break
            
            await asyncio.sleep(HEARTBEAT_INTERVAL)  # Wait 30 seconds
            
            if not conn_info.is_alive:
                break
            
            try:
                # Send ping message
                await conn_info.websocket.send_json({
                    "type": "ping",
                    "timestamp": datetime.utcnow().isoformat()
                })
                logger.debug(f"Sent ping to {conn_info.role}")
            except Exception as e:
                logger.error(f"Error sending heartbeat: {e}")
                conn_info.is_alive = False
                break
    except asyncio.CancelledError:
        logger.info(f"Heartbeat task cancelled for {conn_info.role}")
```

**🔍 Purpose:**
- Sends ping every 30 seconds to check if client is still connected
- Expects pong response within 90 seconds
- Auto-closes dead connections

**🐛 Debug Tip:**
```python
# Track heartbeat timing:
logger.info(f"[HEARTBEAT] Role: {conn_info.role}, Elapsed: {elapsed:.1f}s, Timeout: {HEARTBEAT_TIMEOUT}s")
```

---

#### 3. **WebSocket RTC Endpoint** (Lines 155-370)

##### Step 1: Accept Connection (Lines 155-165)

```python
@router.websocket("/ws/rtc/{session_id}")
async def websocket_rtc_endpoint(websocket: WebSocket, session_id: str):
    logger.info(f"[WebSocket] RTC connection attempt for session: {session_id}")
    logger.info(f"[WebSocket] RTC connection from: {websocket.client}")
    
    # Accept the WebSocket connection
    await websocket.accept()
    logger.info(f"WebRTC WebSocket connection accepted for session: {session_id}")
    
    role = None
    conn_info = None
```

**🔍 Purpose:**
- FastAPI WebSocket route that handles `/ws/rtc/{session_id}`
- Accepts incoming WebSocket connection
- Initializes tracking variables

**🐛 Debug Tip:**
```python
# Log client IP and connection time:
logger.info(f"[DEBUG] Client: {websocket.client.host}:{websocket.client.port} at {datetime.utcnow()}")
```

---

##### Step 2: Join Message & Role Validation (Lines 167-191)

```python
try:
    # Wait for initial join message with role
    join_msg = await websocket.receive_json()
    logger.info(f"Received join message: {join_msg}")
    
    if join_msg.get("type") != "join":
        logger.error(f"Invalid join message type: {join_msg.get('type')}")
        await websocket.close()
        return
    
    role = join_msg.get("role")
    user_data = join_msg.get("user_data")  # Extract user data (for observer)
    
    # Support both training session roles (trainer/learner), coach session roles, and observer
    valid_roles = ["trainer", "learner", "coach", "client", "guest", "observer"]
    if role not in valid_roles:
        logger.error(f"Invalid role: {role}")
        await websocket.close()
        return
    
    # Initialize session connections if needed
    if session_id not in rtc_connections:
        rtc_connections[session_id] = {}
    
    # Create connection info and start heartbeat
    conn_info = ConnectionInfo(websocket, role, session_id, user_data)
    rtc_connections[session_id][role] = conn_info
    conn_info.heartbeat_task = asyncio.create_task(send_heartbeat(conn_info))
```

**🔍 Purpose:**
- Waits for client to send `{type: "join", role: "trainer"}` message
- Validates role (trainer, learner, observer, etc.)
- Creates ConnectionInfo and starts heartbeat task
- Stores connection in `rtc_connections[session_id][role]`

**🐛 Debug Tip:**
```python
# Visualize active connections:
logger.info(f"[DEBUG] Active connections after join: {list(rtc_connections[session_id].keys())}")
logger.info(f"[DEBUG] Total sessions: {len(rtc_connections)}")
```

---

##### Step 3: Send Connection Confirmation (Lines 193-208)

```python
logger.info(
    f"{role} connected to WebRTC session {session_id}. "
    f"Active connections: {list(rtc_connections[session_id].keys())}"
)

# Send connection confirmation
await websocket.send_json({
    "type": "connected",
    "role": role,
    "session_id": session_id,
    "heartbeat_interval": HEARTBEAT_INTERVAL,
})

# SIMPLE: If observer joins, notify trainer with observer user data
if role == "observer" and "trainer" in rtc_connections[session_id]:
    logger.info(f"Observer joined session {session_id}, notifying trainer")
    observer_message = {"type": "observer_joined"}
    if user_data:
        observer_message["observer_data"] = user_data
    await rtc_connections[session_id]["trainer"].websocket.send_json(observer_message)
```

**🔍 Purpose:**
- Confirms to client that connection is established
- Provides heartbeat interval (30s)
- Notifies trainer if observer joins

**🐛 Debug Tip:**
```python
# Log message content:
logger.info(f"[DEBUG] Sending confirmation to {role}: {json.dumps(confirmation_msg)}")
```

---

##### Step 4: Peer Ready Signal (Lines 210-217)

```python
# Normal peer connection setup for trainer/learner or coach/client
if len(rtc_connections[session_id]) == 2 and role != "observer":
    initiator_role = "trainer" if "trainer" in rtc_connections[session_id] else "coach"
    logger.info(f"Both participants connected - signaling {initiator_role} to initiate offer")
    if initiator_role in rtc_connections[session_id]:
        await rtc_connections[session_id][initiator_role].websocket.send_json({
            "type": "peer_ready",
            "role": "both_connected"
        })
```

**🔍 Purpose:**
- Detects when both trainer AND learner are connected
- Sends `peer_ready` signal to trainer
- Triggers trainer to create WebRTC offer

**🐛 Debug Tip:**
```python
# Check connection count:
logger.info(f"[DEBUG] Connection count: {len(rtc_connections[session_id])}, Roles: {list(rtc_connections[session_id].keys())}")
```

---

##### Step 5: Message Relay Loop (Lines 219-320)

```python
try:
    while conn_info.is_alive:
        message = await websocket.receive_json()
        
        # Handle Client Pings
        if message.get("type") == "ping":
            await websocket.send_json({
                "type": "pong",
                "timestamp": datetime.utcnow().isoformat()
            })
            conn_info.last_heartbeat = datetime.utcnow()
            continue
        
        # Handle pong response
        if message.get("type") == "pong":
            conn_info.last_heartbeat = datetime.utcnow()
            logger.debug(f"Received pong from {role}")
            continue
        
        logger.info(f"Received WebRTC message from {role}: {message.get('type')}")
        
        # Targeted Signaling (e.g., trainer -> observer)
        target_role = message.get("target")
        if target_role:
            if target_role in rtc_connections[session_id]:
                target_conn = rtc_connections[session_id][target_role]
                if target_conn.is_alive:
                    await target_conn.websocket.send_json(message)
                    logger.info(f"Direct message from {role} to {target_role}: {message.get('type')}")
            continue
        
        # Default routing for trainer signaling (offer/answer/ice-candidate)
        message_type = message.get('type')
        if role == "trainer" and message_type in ["offer", "answer", "ice-candidate"]:
            default_role = "learner"
            if default_role in rtc_connections[session_id]:
                other_conn = rtc_connections[session_id][default_role]
                if other_conn.is_alive:
                    logger.info(f"Forwarding {message_type} from {role} to {default_role}")
                    await other_conn.websocket.send_json(message)
            continue
        
        # Learner signaling always goes to trainer
        elif role == "learner" and message_type in ["offer", "answer", "ice-candidate"]:
            if "trainer" in rtc_connections[session_id]:
                other_conn = rtc_connections[session_id]["trainer"]
                if other_conn.is_alive:
                    logger.info(f"Forwarding {message_type} from learner to trainer")
                    await other_conn.websocket.send_json(message)
            continue
```

**🔍 Purpose:**
- Main message relay loop
- Handles ping/pong for heartbeat
- Routes WebRTC signaling messages (offer, answer, ICE candidates)
- Supports targeted routing (trainer -> observer)

**🐛 Debug Tip:**
```python
# Log every message with timestamp:
logger.info(f"[DEBUG {datetime.utcnow().isoformat()}] {role} -> Message: {message.get('type')}, Target: {message.get('target', 'auto')}")
```

---

##### Step 6: Cleanup on Disconnect (Lines 336-370)

```python
finally:
    # Cleanup connection
    await cleanup_connection(rtc_connections, session_id, role)
    
    # Notify other participant(s) about disconnection
    if session_id in rtc_connections:
        try:
            # Notify trainer if observer leaves
            if role == "observer" and "trainer" in rtc_connections[session_id]:
                await rtc_connections[session_id]["trainer"].websocket.send_json({
                    "type": "observer_left"
                })
            
            # Notify observer if trainer leaves
            elif role == "trainer" and "observer" in rtc_connections[session_id]:
                logger.info(f"Trainer left, notifying observer to disconnect")
                await rtc_connections[session_id]["observer"].websocket.send_json({
                    "type": "trainer_disconnected"
                })
                
                # Also notify learner
                if "learner" in rtc_connections[session_id]:
                    await rtc_connections[session_id]["learner"].websocket.send_json({
                        "type": "peer_disconnected",
                        "role": role
                    })
```

**🔍 Purpose:**
- Runs when WebSocket disconnects
- Cleans up connection info and heartbeat task
- Notifies other peers about disconnection

**🐛 Debug Tip:**
```python
# Log cleanup sequence:
logger.info(f"[DEBUG CLEANUP] Role: {role}, Session: {session_id}, Remaining: {list(rtc_connections.get(session_id, {}).keys())}")
```

---

## Frontend Video Conference Service

### File: `videoConferenceService.js`

#### 1. **Constructor** (Lines 48-97)

```javascript
class VideoConferenceService {
    constructor(wsUrl, sessionId, role, isObserver = false, targetRole = null) {
        this.wsUrl = wsUrl;                 // WebSocket URL
        this.sessionId = sessionId;         // Session ID
        this.role = role;                   // 'trainer', 'learner', or 'observer'
        this.isObserver = isObserver;       // Observer mode flag
        this.targetRole = targetRole;       // Target for signaling (e.g., 'observer')
        
        // WebRTC Components
        this.peerConnection = null;         // RTCPeerConnection instance
        this.localStream = null;            // Local media stream (camera/mic)
        this.remoteStream = null;           // Remote media stream (peer's video/audio)
        
        // WebSocket for signaling
        this.ws = null;                     // WebSocket connection
        this.reconnectAttempts = 0;         // Reconnection counter
        this.maxReconnectAttempts = Infinity; // Unlimited retries
        this.reconnectDelay = 1000;         // Start with 1 second
        this.maxReconnectDelay = 30000;     // Max 30 seconds between retries
        
        // Callbacks (to be set by UI components)
        this.onLocalStream = null;          // Called when local stream is ready
        this.onRemoteStream = null;         // Called when remote stream arrives
        this.onConnectionStateChange = null; // Connection state updates
        this.onError = null;                // Error handler
        
        // ICE candidates queue
        this.pendingIceCandidates = [];     // Queue for ICE candidates
        this.isOfferCreated = false;        // Prevent duplicate offers
    }
}
```

**🔍 Purpose:**
- Initializes service with session and role info
- Sets up WebRTC and WebSocket properties
- Defines callback hooks for UI integration

**🐛 Debug Tip:**
```javascript
// Add to constructor:
console.log(`[VideoConference] Constructor called:`, {
    role: this.role,
    sessionId: this.sessionId,
    isObserver: this.isObserver,
    targetRole: this.targetRole
});
```

---

#### 2. **Initialize Method** (Lines 100-148)

```javascript
async initialize(userData = null) {
    try {
        console.log(`[VideoConference][${this.role}] Initializing video conference...`);
        
        // Step 1: Get local media (camera + microphone) - skip for observers
        if (!this.isObserver) {
            this.localStream = await this.getLocalMedia();
        } else {
            console.log(`[VideoConference][${this.role}] Observer mode - skipping local media`);
        }
        
        // Step 2: Set up WebSocket for signaling
        await this.connectWebSocket();
        
        // Step 3: Create peer connection
        this.createPeerConnection();
        
        // Step 4: Add local tracks to peer connection (skip for observers)
        if (!this.isObserver) {
            this.addLocalTracksToConnection();
        }
        
        // Step 5: Announce presence (with user data if provided)
        this.announcePresence(userData);
        
        this.isInitialized = true;
        
        // Step 6: Start connection monitoring
        this.startConnectionMonitoring();
        
        // Step 7: Start WebSocket heartbeat
        this.startHeartbeat();
        
        console.log(`[VideoConference][${this.role}] Initialization complete`);
        
        return this.localStream;
    } catch (error) {
        console.error(`[VideoConference][${this.role}] Initialization failed:`, error);
        if (this.onError) {
            this.onError(error);
        }
        throw error;
    }
}
```

**🔍 Purpose:**
- Main initialization sequence
- Gets camera/mic access
- Connects WebSocket
- Creates peer connection
- Announces presence to signaling server

**🐛 Debug Tip:**
```javascript
// Add step-by-step logging:
console.log(`[DEBUG ${this.role}] Step 1: Media access ${this.isObserver ? 'skipped' : 'starting'}...`);
// ... after each await:
console.log(`[DEBUG ${this.role}] Step 1: Complete ✓`);
```

---

#### 3. **Get Local Media** (Lines 150-221)

```javascript
async getLocalMedia() {
    try {
        console.log(`[VideoConference][${this.role}] Requesting media access...`);
        
        // Check if getUserMedia is available
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Media devices not available. Please use HTTPS or localhost.');
        }
        
        const constraints = {
            video: {
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                frameRate: { ideal: 30, max: 30 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        console.log(`[VideoConference][${this.role}] Media access granted:`, {
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length
        });
        
        // Trigger callback if set
        if (this.onLocalStream) {
            this.onLocalStream(stream);
        }
        
        return stream;
    } catch (error) {
        console.error(`[VideoConference][${this.role}] Media access failed:`, error);
        
        // Try audio-only fallback
        if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                console.log(`[VideoConference][${this.role}] Audio-only mode activated`);
                return audioStream;
            } catch (audioError) {
                console.error(`[VideoConference][${this.role}] Audio-only fallback failed:`, audioError);
            }
        }
        
        throw new Error(`Media access denied: ${error.message}`);
    }
}
```

**🔍 Purpose:**
- Requests camera and microphone access from browser
- Uses optimal video constraints (720p@30fps)
- Enables echo cancellation and noise suppression for audio
- Falls back to audio-only if camera fails

**🐛 Debug Tip:**
```javascript
// Log detailed track info:
stream.getTracks().forEach(track => {
    console.log(`[DEBUG] Track:`, {
        kind: track.kind,
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        settings: track.getSettings()
    });
});
```

---

#### 4. **Connect WebSocket** (Lines 312-360)

```javascript
connectWebSocket() {
    return new Promise((resolve, reject) => {
        const wsUrl = this.wsUrl
            .replace(/^https:/, 'wss:')
            .replace(/^http:/, 'ws:');
        
        const wsEndpoint = `${wsUrl}/ws/rtc/${this.sessionId}`;
        console.log(`[VideoConference][${this.role}] Connecting to WebSocket:`, wsEndpoint);
        
        this.ws = new WebSocket(wsEndpoint);
        
        this.ws.onopen = () => {
            console.log(`[VideoConference][${this.role}] WebSocket connected`);
            this.reconnectAttempts = 0;
            resolve();
        };
        
        this.ws.onmessage = (event) => {
            this.handleSignalingMessage(JSON.parse(event.data));
        };
        
        this.ws.onerror = (error) => {
            console.error(`[VideoConference][${this.role}] WebSocket error:`, error);
            reject(error);
        };
        
        this.ws.onclose = () => {
            console.log(`[VideoConference][${this.role}] WebSocket closed`);
            this.handleWebSocketClose();
        };
    });
}
```

**🔍 Purpose:**
- Creates WebSocket connection to `/ws/rtc/{sessionId}`
- Converts HTTP URL to WebSocket (wss:// or ws://)
- Sets up message handlers
- Returns promise that resolves on connection

**🐛 Debug Tip:**
```javascript
// Log WebSocket states:
this.ws.onopen = () => {
    console.log(`[DEBUG] WebSocket state:`, {
        readyState: this.ws.readyState,
        url: this.ws.url,
        protocol: this.ws.protocol,
        extensions: this.ws.extensions
    });
    resolve();
};
```

---

#### 5. **Announce Presence** (Lines 850-870)

```javascript
announcePresence(userData = null) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const joinMessage = {
            type: 'join',
            role: this.role,
            sessionId: this.sessionId
        };
        
        // Include user data if provided (for observers)
        if (userData) {
            joinMessage.user_data = userData;
        }
        
        this.ws.send(JSON.stringify(joinMessage));
        console.log(`[VideoConference][${this.role}] Announced presence:`, joinMessage);
    } else {
        console.error(`[VideoConference][${this.role}] WebSocket not ready for announcement`);
    }
}
```

**🔍 Purpose:**
- Sends join message to signaling server
- Includes role and session ID
- Triggers backend to create ConnectionInfo

**🐛 Debug Tip:**
```javascript
// Verify message sent:
console.log(`[DEBUG] Sending join message:`, JSON.stringify(joinMessage, null, 2));
console.log(`[DEBUG] WebSocket ready state: ${this.ws.readyState} (1 = OPEN)`);
```

---

#### 6. **Handle Signaling Messages** (Lines 872-980)

```javascript
async handleSignalingMessage(message) {
    console.log(`[VideoConference][${this.role}] Received:`, message.type);
    
    try {
        switch (message.type) {
            case 'connected':
                // Backend confirmed connection
                console.log(`[VideoConference][${this.role}] Connection confirmed`);
                break;
            
            case 'peer_ready':
                // Both peers connected - trainer creates offer
                if (this.role === 'trainer' && !this.isOfferCreated) {
                    console.log(`[VideoConference][${this.role}] Peer ready, creating offer...`);
                    await this.createOffer();
                }
                break;
            
            case 'offer':
                // Learner receives offer from trainer
                await this.handleOffer(message.offer);
                break;
            
            case 'answer':
                // Trainer receives answer from learner
                await this.handleAnswer(message.answer);
                break;
            
            case 'ice-candidate':
                // ICE candidate from peer
                await this.handleIceCandidate(message.candidate);
                break;
            
            case 'observer_joined':
                // Observer joined (trainer receives this)
                if (this.onObserverJoined) {
                    this.onObserverJoined(message.observer_data);
                }
                break;
            
            case 'observer_left':
                // Observer left
                if (this.onObserverLeft) {
                    this.onObserverLeft();
                }
                break;
            
            case 'ping':
                // Heartbeat ping from server
                this.ws.send(JSON.stringify({
                    type: 'pong',
                    timestamp: new Date().toISOString()
                }));
                break;
            
            default:
                console.log(`[VideoConference][${this.role}] Unknown message:`, message.type);
        }
    } catch (error) {
        console.error(`[VideoConference][${this.role}] Error handling message:`, error);
    }
}
```

**🔍 Purpose:**
- Routes incoming WebSocket messages
- Handles WebRTC signaling (offer, answer, ICE)
- Responds to peer_ready, observer events, heartbeats

**🐛 Debug Tip:**
```javascript
// Log every message with payload:
console.log(`[DEBUG ${new Date().toISOString()}] Message:`, JSON.stringify(message, null, 2));
```

---

#### 7. **Create Offer (Trainer)** (Lines 982-1020)

```javascript
async createOffer(targetRole = null) {
    try {
        if (this.isOfferCreated) {
            console.log(`[VideoConference][${this.role}] Offer already created, skipping`);
            return;
        }
        
        console.log(`[VideoConference][${this.role}] Creating offer...`);
        
        // Create SDP offer
        const offer = await this.peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });
        
        // Set local description
        await this.peerConnection.setLocalDescription(offer);
        console.log(`[VideoConference][${this.role}] Local description set`);
        
        // Send offer to peer via signaling server
        const offerMessage = {
            type: 'offer',
            offer: offer
        };
        
        // Add target if specified (for observer connection)
        if (targetRole || this.targetRole) {
            offerMessage.target = targetRole || this.targetRole;
        }
        
        this.ws.send(JSON.stringify(offerMessage));
        this.isOfferCreated = true;
        
        console.log(`[VideoConference][${this.role}] Offer sent:`, {
            target: offerMessage.target || 'default',
            sdpType: offer.type
        });
    } catch (error) {
        console.error(`[VideoConference][${this.role}] Error creating offer:`, error);
        throw error;
    }
}
```

**🔍 Purpose:**
- Trainer creates WebRTC offer with SDP (Session Description Protocol)
- Sets offer as local description
- Sends offer to learner via WebSocket
- Prevents duplicate offers with `isOfferCreated` flag

**🐛 Debug Tip:**
```javascript
// Log full SDP for inspection:
console.log(`[DEBUG] SDP Offer:`, offer.sdp);
console.log(`[DEBUG] Offer contains:`, {
    hasVideo: offer.sdp.includes('m=video'),
    hasAudio: offer.sdp.includes('m=audio'),
    iceUfrag: offer.sdp.match(/a=ice-ufrag:(\S+)/)?.[1]
});
```

---

#### 8. **Handle Offer (Learner)** (Lines 1022-1065)

```javascript
async handleOffer(offer) {
    try {
        console.log(`[VideoConference][${this.role}] Handling offer...`);
        
        // Set remote description (trainer's offer)
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        console.log(`[VideoConference][${this.role}] Remote description set`);
        
        // Create answer
        const answer = await this.peerConnection.createAnswer();
        
        // Set local description (learner's answer)
        await this.peerConnection.setLocalDescription(answer);
        console.log(`[VideoConference][${this.role}] Answer created and set as local description`);
        
        // Send answer back to trainer via signaling server
        this.ws.send(JSON.stringify({
            type: 'answer',
            answer: answer
        }));
        
        console.log(`[VideoConference][${this.role}] Answer sent`);
        
        // Process any pending ICE candidates
        console.log(`[VideoConference][${this.role}] Processing ${this.pendingIceCandidates.length} pending ICE candidates`);
        for (const candidate of this.pendingIceCandidates) {
            await this.peerConnection.addIceCandidate(candidate);
        }
        this.pendingIceCandidates = [];
    } catch (error) {
        console.error(`[VideoConference][${this.role}] Error handling offer:`, error);
        throw error;
    }
}
```

**🔍 Purpose:**
- Learner receives trainer's offer
- Sets it as remote description
- Creates and sends answer back
- Processes queued ICE candidates

**🐛 Debug Tip:**
```javascript
// Verify remote description:
console.log(`[DEBUG] Remote SDP set:`, this.peerConnection.remoteDescription.sdp);
console.log(`[DEBUG] Peer connection state after setRemote:`, this.peerConnection.connectionState);
```

---

#### 9. **Handle Answer (Trainer)** (Lines 1067-1090)

```javascript
async handleAnswer(answer) {
    try {
        console.log(`[VideoConference][${this.role}] Handling answer...`);
        
        // Set remote description (learner's answer)
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log(`[VideoConference][${this.role}] Remote description set`);
        
        // Process pending ICE candidates
        console.log(`[VideoConference][${this.role}] Processing ${this.pendingIceCandidates.length} pending ICE candidates`);
        for (const candidate of this.pendingIceCandidates) {
            await this.peerConnection.addIceCandidate(candidate);
        }
        this.pendingIceCandidates = [];
    } catch (error) {
        console.error(`[VideoConference][${this.role}] Error handling answer:`, error);
        throw error;
    }
}
```

**🔍 Purpose:**
- Trainer receives learner's answer
- Sets it as remote description
- Completes offer/answer exchange
- Processes queued ICE candidates

---

#### 10. **Handle ICE Candidates** (Lines 1092-1120)

```javascript
async handleIceCandidate(candidate) {
    try {
        if (!candidate) {
            console.log(`[VideoConference][${this.role}] Received null ICE candidate (gathering complete)`);
            return;
        }
        
        console.log(`[VideoConference][${this.role}] Received ICE candidate:`, {
            candidate: candidate.candidate.substring(0, 50) + '...',
            sdpMid: candidate.sdpMid
        });
        
        // If remote description is set, add candidate immediately
        if (this.peerConnection.remoteDescription) {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log(`[VideoConference][${this.role}] ICE candidate added`);
        } else {
            // Queue candidate until remote description is set
            console.log(`[VideoConference][${this.role}] Queuing ICE candidate (no remote description yet)`);
            this.pendingIceCandidates.push(candidate);
        }
    } catch (error) {
        console.error(`[VideoConference][${this.role}] Error handling ICE candidate:`, error);
    }
}
```

**🔍 Purpose:**
- Handles ICE (Interactive Connectivity Establishment) candidates
- ICE candidates are network paths for peer-to-peer connection
- Queues candidates if remote description not set yet

**🐛 Debug Tip:**
```javascript
// Parse candidate details:
const parts = candidate.candidate.split(' ');
console.log(`[DEBUG] ICE Candidate Details:`, {
    foundation: parts[0],
    component: parts[1],
    protocol: parts[2],
    priority: parts[3],
    ip: parts[4],
    port: parts[5],
    type: parts[7]
});
```

---

#### 11. **Create Peer Connection** (Lines 677-780)

```javascript
createPeerConnection() {
    console.log(`[VideoConference][${this.role}] Creating peer connection...`);
    
    // Create RTCPeerConnection with ICE servers (STUN/TURN)
    this.peerConnection = new RTCPeerConnection({
        iceServers: ICE_SERVERS  // Defined at top of file
    });
    
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log(`[VideoConference][${this.role}] New ICE candidate found`);
            
            // Send ICE candidate to peer via signaling server
            const candidateMessage = {
                type: 'ice-candidate',
                candidate: event.candidate
            };
            
            // Add target if specified (for observer connection)
            if (this.targetRole) {
                candidateMessage.target = this.targetRole;
            }
            
            this.ws.send(JSON.stringify(candidateMessage));
        } else {
            console.log(`[VideoConference][${this.role}] ICE candidate gathering complete`);
        }
    };
    
    // Handle incoming remote tracks (peer's video/audio)
    this.peerConnection.ontrack = (event) => {
        console.log(`[VideoConference][${this.role}] Remote track received:`, event.track.kind);
        
        // Create or update remote stream
        if (!this.remoteStream) {
            this.remoteStream = new MediaStream();
        }
        
        // Add track to remote stream
        this.remoteStream.addTrack(event.track);
        
        console.log(`[VideoConference][${this.role}] Remote stream tracks:`, {
            video: this.remoteStream.getVideoTracks().length,
            audio: this.remoteStream.getAudioTracks().length
        });
        
        // Notify UI component
        if (this.onRemoteStream) {
            this.onRemoteStream(this.remoteStream);
        }
    };
    
    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
        console.log(`[VideoConference][${this.role}] Connection state:`, this.peerConnection.connectionState);
        
        if (this.onConnectionStateChange) {
            this.onConnectionStateChange(this.peerConnection.connectionState);
        }
        
        // Handle failed/disconnected states
        if (this.peerConnection.connectionState === 'failed') {
            console.error(`[VideoConference][${this.role}] Connection failed`);
            if (this.onError) {
                this.onError(new Error('WebRTC connection failed'));
            }
        }
    };
    
    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
        console.log(`[VideoConference][${this.role}] ICE connection state:`, this.peerConnection.iceConnectionState);
    };
    
    console.log(`[VideoConference][${this.role}] Peer connection created`);
}
```

**🔍 Purpose:**
- Creates RTCPeerConnection with STUN/TURN servers
- Sets up event handlers for:
  - `onicecandidate`: Sends ICE candidates to peer
  - `ontrack`: Receives remote media tracks
  - `onconnectionstatechange`: Monitors connection health

**🐛 Debug Tip:**
```javascript
// Log all peer connection events:
this.peerConnection.onnegotiationneeded = () => console.log('[DEBUG] Negotiation needed');
this.peerConnection.onsignalingstatechange = () => console.log('[DEBUG] Signaling state:', this.peerConnection.signalingState);
this.peerConnection.ondatachannel = (event) => console.log('[DEBUG] Data channel:', event.channel.label);
```

---

## Session Components Flow

### Trainer Session Initialization

**File:** `TrainerSession.jsx` (Lines 796-900)

```javascript
const initializeWebRTC = async () => {
    // Initialize Whiteboard
    const wbService = new WhiteboardService(WS_BASE_URL, sessionId, 'trainer');
    // ... whiteboard setup ...
    
    // Initialize PRIMARY Video Conference Service (for Learner)
    const learnerVideoService = new VideoConferenceService(WS_BASE_URL, sessionId, 'trainer');
    
    try {
        console.log('[TrainerSession] Initializing LEARNER Video Conference service');
        
        // Set callback for local stream (trainer's camera/mic)
        learnerVideoService.onLocalStream = (stream) => {
            console.log('[TrainerSession] Local stream received (Learner connection)');
            setLocalStream(stream);  // Display trainer's own video
        };
        
        // Set callback for remote stream (learner's video)
        learnerVideoService.onRemoteStream = (stream) => {
            console.log('[TrainerSession] Remote stream received from learner');
            setRemoteStream(stream);  // Display learner's video
            
            // Show toast when learner first connects
            if (!learnerConnectedRef.current) {
                learnerConnectedRef.current = true;
                toast.success(`${sessionInfo?.learner_name || 'Learner'} has joined`);
            }
        };
        
        // Set callback for connection state changes
        learnerVideoService.onConnectionStateChange = (state) => {
            console.log('[TrainerSession] LEARNER connection state:', state);
            const statusMap = {
                'new': 'connecting',
                'connecting': 'connecting',
                'connected': 'connected',
                'disconnected': 'disconnected',
                'failed': 'failed',
                'closed': 'disconnected'
            };
            setConnectionStatus(statusMap[state] || state);
            
            // Handle learner disconnect
            if ((state === 'disconnected' || state === 'closed') && learnerConnectedRef.current) {
                console.log('[TrainerSession] Learner disconnected');
                toast.info(`${sessionInfo?.learner_name || 'Learner'} has left`);
                setRemoteStream(null);
                learnerConnectedRef.current = false;
            }
        };
        
        // Set error callback
        learnerVideoService.onError = (error) => {
            console.error('[TrainerSession] LEARNER video error:', error);
            toast.error(`Video error: ${error.message}`);
        };
        
        // Hook Observer Events
        learnerVideoService.onObserverJoined = (observerUserData) => {
            console.log('[TrainerSession] Observer joined!', observerUserData);
            setObserverData(observerUserData);
            setShowObserverModal(true);
        };
        
        learnerVideoService.onObserverLeft = () => {
            console.log('[TrainerSession] Observer left');
            toast.info('Observer left the session');
            // Cleanup observer connection...
        };
        
        // Initialize the video service
        await learnerVideoService.initialize();
        setLearnerRTC(learnerVideoService);  // Store in state
        
        console.log('[TrainerSession] LEARNER Video Conference initialized successfully');
    } catch (error) {
        console.error('[TrainerSession] Error initializing video conference:', error);
        toast.error('Failed to initialize video connection');
    }
};
```

**🔍 Flow:**
1. Create VideoConferenceService instance with role='trainer'
2. Set callback hooks for streams and state changes
3. Call `initialize()` which:
   - Gets camera/mic access
   - Connects WebSocket
   - Creates peer connection
   - Announces presence
4. Store service in component state

---

### Learner Session Initialization

**File:** `LearnerSession.jsx` (Lines 1002-1080)

```javascript
const initializeWebRTC = async () => {
    // Initialize Whiteboard
    const wbService = new WhiteboardService(WS_BASE_URL, sessionId, 'learner');
    // ... whiteboard setup ...
    
    // Initialize Video Conference Service
    const videoService = new VideoConferenceService(WS_BASE_URL, sessionId, 'learner');
    
    try {
        console.log('[LearnerSession] Initializing Video Conference service');
        
        // Set callback for local stream (learner's camera/mic)
        videoService.onLocalStream = (stream) => {
            // Learner doesn't display their own video to minimize distraction
            console.log('[LearnerSession] Local stream received (not displayed)');
        };
        
        // Set callback for remote stream (trainer's video)
        videoService.onRemoteStream = (stream) => {
            console.log('[LearnerSession] Remote stream received from trainer');
            setRemoteStream(stream);  // Display trainer's video
            setTrainerJoined(true);   // Trainer has joined
        };
        
        // Set callback for connection state changes
        videoService.onConnectionStateChange = (state) => {
            console.log('[LearnerSession] Connection state:', state);
            const statusMap = {
                'new': 'connecting',
                'connecting': 'connecting',
                'connected': 'connected',
                'disconnected': 'disconnected',
                'failed': 'failed',
                'closed': 'disconnected'
            };
            setConnectionStatus(statusMap[state] || state);
            
            // If disconnected, trainer might have left
            if (state === 'disconnected' || state === 'closed') {
                setTrainerJoined(false);
            }
        };
        
        // Set error callback
        videoService.onError = (error) => {
            console.error('[LearnerSession] Video error:', error);
            toast.error(`Video error: ${error.message}`);
        };
        
        // Initialize the video service
        await videoService.initialize();
        setWebRTC(videoService);  // Store in state
        
        console.log('[LearnerSession] Video Conference initialized successfully');
    } catch (error) {
        console.error('[LearnerSession] Error initializing video conference:', error);
        toast.error('Failed to initialize video connection');
    }
};
```

**🔍 Flow:**
1. Create VideoConferenceService instance with role='learner'
2. Set callbacks (note: local stream not displayed for learners)
3. Call `initialize()` which handles same steps as trainer
4. Store service in component state

---

## Debugging Guide

### 1. **Enable Detailed Logging**

Add to your browser console:

```javascript
// Enable WebRTC native logging
localStorage.debug = 'simple-peer,videoconference*';

// Monitor all WebRTC events
RTCPeerConnection.prototype.addEventListener = new Proxy(RTCPeerConnection.prototype.addEventListener, {
    apply(target, thisArg, args) {
        console.log('[DEBUG WebRTC Event]', args[0]);
        return Reflect.apply(target, thisArg, args);
    }
});
```

### 2. **Check WebSocket Connection**

```javascript
// In browser console during session:
const ws = document.querySelector('video')?.__reactProps$?.children[0]?.props?.webRTC?.ws;
console.log('WebSocket State:', ws?.readyState);
console.log('WebSocket URL:', ws?.url);

// 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED
```

### 3. **Inspect Peer Connection Stats**

```javascript
// Get detailed WebRTC statistics
async function getStats(service) {
    const stats = await service.peerConnection.getStats();
    stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
            console.log('[Video Inbound]', {
                bytesReceived: report.bytesReceived,
                packetsReceived: report.packetsReceived,
                packetsLost: report.packetsLost,
                jitter: report.jitter,
                framesDecoded: report.framesDecoded
            });
        }
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            console.log('[ICE Candidate Pair]', {
                localCandidate: report.localCandidateId,
                remoteCandidate: report.remoteCandidateId,
                bytesSent: report.bytesSent,
                bytesReceived: report.bytesReceived,
                currentRoundTripTime: report.currentRoundTripTime
            });
        }
    });
}

// Call it:
getStats(window.videoService);  // Store service in window for debugging
```

### 4. **Backend Log Inspection**

Add these to `websocket.py`:

```python
# At top of file:
import json
logging.basicConfig(level=logging.DEBUG)

# In message relay loop:
logger.debug(f"[RELAY] {role} -> {target_role}: {json.dumps(message, indent=2)}")

# Track connection lifecycle:
logger.info(f"[LIFECYCLE] Session: {session_id}, Connections: {list(rtc_connections.get(session_id, {}).keys())}, Count: {len(rtc_connections.get(session_id, {}))}")
```

### 5. **Debugging Connection Issues**

**Symptom:** "Connection stays in 'connecting' state"

```javascript
// Check ICE connection state:
service.peerConnection.oniceconnectionstatechange = () => {
    console.log('[DEBUG] ICE State:', service.peerConnection.iceConnectionState);
    console.log('[DEBUG] ICE Gathering State:', service.peerConnection.iceGatheringState);
    console.log('[DEBUG] Signaling State:', service.peerConnection.signalingState);
};

// List all ICE candidates:
service.peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
        const c = event.candidate.candidate;
        console.log('[DEBUG] ICE Candidate:', {
            type: c.match(/typ (\S+)/)?.[1],
            address: c.match(/(\d+\.\d+\.\d+\.\d+)/)?.[1],
            port: c.match(/(\d+) typ/)?.[1]
        });
    }
};
```

**Symptom:** "No remote video/audio"

```javascript
// Check if tracks are being received:
service.peerConnection.ontrack = (event) => {
    console.log('[DEBUG] Track received:', {
        kind: event.track.kind,
        id: event.track.id,
        enabled: event.track.enabled,
        muted: event.track.muted,
        readyState: event.track.readyState,
        streams: event.streams.length
    });
    
    // Listen for track events:
    event.track.onmute = () => console.log('[DEBUG] Track muted:', event.track.kind);
    event.track.onunmute = () => console.log('[DEBUG] Track unmuted:', event.track.kind);
    event.track.onended = () => console.log('[DEBUG] Track ended:', event.track.kind);
};
```

### 6. **Network Debugging**

**Check TURN server connectivity:**

```javascript
// Test TURN server:
async function testTURN() {
    const pc = new RTCPeerConnection({
        iceServers: [{
            urls: 'turn:43.204.218.16:3478',
            username: 'hurshbin',
            credential: 'SecureTurnPass2024!'
        }]
    });
    
    pc.createDataChannel('test');
    
    pc.onicecandidate = (e) => {
        if (e.candidate) {
            console.log('[TURN Test]', e.candidate.candidate);
            if (e.candidate.candidate.includes('typ relay')) {
                console.log('✅ TURN server working!');
            }
        }
    };
    
    await pc.createOffer();
}

testTURN();
```

---

## Common Issues & Solutions

### Issue 1: "Cannot read property 'getTracks' of null"

**Cause:** Local stream not initialized before cleanup

**Solution:**
```javascript
// Always check before accessing:
cleanup() {
    if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
    }
}
```

---

### Issue 2: "DOMException: Failed to execute 'addIceCandidate'"

**Cause:** Remote description not set yet

**Solution:** Already handled by queuing:
```javascript
if (this.peerConnection.remoteDescription) {
    await this.peerConnection.addIceCandidate(candidate);
} else {
    this.pendingIceCandidates.push(candidate);  // Queue it
}
```

---

### Issue 3: "Connection stuck in 'checking' state"

**Cause:** Firewall blocking UDP or TURN server not working

**Solution:**
1. Test TURN server (see Network Debugging above)
2. Check firewall rules on EC2
3. Verify TURN credentials in `videoConferenceService.js`

---

### Issue 4: "No audio/video after connection"

**Cause:** Tracks not added to peer connection

**Debug:**
```javascript
// Check senders:
const senders = service.peerConnection.getSenders();
console.log('[DEBUG] Senders:', senders.map(s => ({
    kind: s.track?.kind,
    enabled: s.track?.enabled
})));

// Check receivers:
const receivers = service.peerConnection.getReceivers();
console.log('[DEBUG] Receivers:', receivers.map(r => ({
    kind: r.track?.kind,
    enabled: r.track?.enabled
})));
```

---

### Issue 5: "Multiple connections/reconnections"

**Cause:** React StrictMode or duplicate initialization

**Solution:**
```javascript
// Use cleanup in useEffect:
useEffect(() => {
    let mounted = true;
    
    const init = async () => {
        if (!mounted) return;
        await initializeWebRTC();
    };
    
    init();
    
    return () => {
        mounted = false;
        cleanup();
    };
}, [sessionId]);  // Only run when sessionId changes
```

---

## Summary

### Connection Flow Timeline

```
T=0s    Trainer connects WebSocket → Backend accepts
T=1s    Learner connects WebSocket → Backend accepts
T=2s    Backend sends peer_ready to Trainer
T=3s    Trainer creates offer → Backend forwards to Learner
T=4s    Learner creates answer → Backend forwards to Trainer
T=4-6s  ICE candidates exchanged (multiple)
T=7s    P2P connection established
T=8s+   Audio/Video flowing directly between peers
```

### Key Takeaways

1. **WebSocket = Signaling only** (coordinates connection setup)
2. **WebRTC = Actual media** (peer-to-peer audio/video)
3. **Offer/Answer = SDP negotiation** (describes media capabilities)
4. **ICE Candidates = Network paths** (finds best route for P2P)
5. **TURN server = Fallback** (when P2P blocked by firewall)

---

## Next Steps

For presenting this code:

1. **Live Demo Approach:**
   - Open two browser windows (trainer + learner)
   - Open DevTools console in both
   - Walk through each log message as they connect
   - Show WebRTC stats in real-time

2. **Code Review Approach:**
   - Use this document as a slide deck
   - Show code snippets function-by-function
   - Explain purpose of each block
   - Demonstrate debugging techniques

3. **Debugging Session:**
   - Simulate common issues
   - Show how to diagnose using logs
   - Fix issues live

---

**Document Version:** 1.0  
**Last Updated:** {{ date }}  
**Maintainer:** Development Team
