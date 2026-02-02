# WebRTC/WebSocket Trainer-Learner Session - Architecture & Flow Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [User Flow: "Start Session" Button Click](#user-flow-start-session-button-click)
4. [Frontend Code Architecture](#frontend-code-architecture)
5. [Backend Code Architecture](#backend-code-architecture)
6. [Data Flow Timeline](#data-flow-timeline)
7. [Function Call Sequence](#function-call-sequence)

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

## User Flow: "Start Session" Button Click

### Complete Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│ TRAINER CLICKS "START SESSION" BUTTON                                     │
└────────────────────────────────────────┬───────────────────────────────────┘
                                         │
                    ┌────────────────────▼────────────────────┐
                    │ TrainerSession.jsx                      │
                    │ useEffect triggers on mount             │
                    │ → initializeWebRTC()                    │
                    └────────────────────┬────────────────────┘
                                         │
                    ┌────────────────────▼────────────────────┐
                    │ VideoConferenceService instantiated    │
                    │ role='trainer'                          │
                    │ sessionId=<session_id>                  │
                    └────────────────────┬────────────────────┘
                                         │
                    ┌────────────────────▼────────────────────┐
                    │ service.initialize()                    │
                    │ ├─ getLocalMedia()                      │
                    │ │  └─ getUserMedia() [camera/mic]       │
                    │ ├─ connectWebSocket()                   │
                    │ │  └─ new WebSocket(/ws/rtc/<id>)       │
                    │ ├─ createPeerConnection()               │
                    │ │  └─ RTCPeerConnection(ICE_SERVERS)    │
                    │ └─ announcePresence()                   │
                    │    └─ send {type:'join', role:'trainer'}│
                    └────────────────────┬────────────────────┘
                                         │
                    ┌────────────────────▼────────────────────┐
                    │ WEBSOCKET OPENS                         │
                    │ ws.onopen()                             │
                    │ startHeartbeat()                        │
                    └────────────────────┬────────────────────┘
                                         │
          ┌──────────────────────────────┼──────────────────────────────┐
          │ BACKEND RECEIVES             │ TRAINER WAITS FOR            │
          │ WebSocket Connection         │ learner to join              │
          │ (websocket_rtc_endpoint)     │                             │
          │                              │                             │
          │ ├─ Accept connection         │                             │
          │ ├─ Receive {join message}    │                             │
          │ │  └─ role='trainer'         │                             │
          │ ├─ Create ConnectionInfo     │                             │
          │ ├─ Store in rtc_connections  │                             │
          │ │  [session_id][trainer]     │                             │
          │ ├─ Start heartbeat task      │                             │
          │ └─ Send {connected}          │                             │
          │                              │                             │
          └──────────────────────────────┼──────────────────────────────┘
                                         │
          ┌──────────────────────────────┴──────────────────────────────┐
          │ LEARNER CLICKS "JOIN SESSION" BUTTON                        │
          │ Same flow as Trainer...                                     │
          │ connectWebSocket() → sends {join, role:'learner'}           │
          └──────────────────────────────┬──────────────────────────────┘
                                         │
          ┌──────────────────────────────▼──────────────────────────────┐
          │ BACKEND: Both peers connected!                             │
          │ Check: len(rtc_connections[session_id]) == 2               │
          │ Send {peer_ready} to Trainer                               │
          └──────────────────────────────┬──────────────────────────────┘
                                         │
          ┌──────────────────────────────▼──────────────────────────────┐
          │ TRAINER RECEIVES {peer_ready}                              │
          │ handleSignalingMessage() → case 'peer_ready'               │
          │ trainer.createOffer()                                      │
          │ ├─ peerConnection.createOffer()  [SDP]                    │
          │ ├─ peerConnection.setLocalDescription(offer)              │
          │ └─ ws.send({type:'offer', offer})                         │
          └──────────────────────────────┬──────────────────────────────┘
                                         │
          ┌──────────────────────────────▼──────────────────────────────┐
          │ BACKEND: Message relay                                     │
          │ Receives {offer} from trainer                              │
          │ Forwards to learner via WebSocket                          │
          │ rtc_connections[session_id]['learner'].websocket.send_json │
          └──────────────────────────────┬──────────────────────────────┘
                                         │
          ┌──────────────────────────────▼──────────────────────────────┐
          │ LEARNER RECEIVES {offer}                                   │
          │ handleSignalingMessage() → case 'offer'                    │
          │ handleOffer(offer)                                         │
          │ ├─ peerConnection.setRemoteDescription(offer)             │
          │ ├─ peerConnection.createAnswer()  [SDP]                   │
          │ ├─ peerConnection.setLocalDescription(answer)             │
          │ └─ ws.send({type:'answer', answer})                       │
          └──────────────────────────────┬──────────────────────────────┘
                                         │
          ┌──────────────────────────────▼──────────────────────────────┐
          │ BACKEND: Message relay                                     │
          │ Receives {answer} from learner                             │
          │ Forwards to trainer via WebSocket                          │
          └──────────────────────────────┬──────────────────────────────┘
                                         │
          ┌──────────────────────────────▼──────────────────────────────┐
          │ TRAINER RECEIVES {answer}                                  │
          │ handleSignalingMessage() → case 'answer'                   │
          │ handleAnswer(answer)                                       │
          │ ├─ peerConnection.setRemoteDescription(answer)            │
          │ └─ Process pending ICE candidates                          │
          │                                                             │
          │ Both peers now exchange ICE candidates...                  │
          │ onicecandidate event → send via WebSocket → relay          │
          │                                                             │
          │ ✅ P2P CONNECTION ESTABLISHED                              │
          │ Audio/Video flowing directly between peers                 │
          └──────────────────────────────────────────────────────────────┘
```

---

## Frontend Code Architecture

### File: `src/pages/trainer/TrainerSession.jsx`

**Entry Point - Component Mount:**

```javascript
// When component mounts (user on trainer session page)
useEffect(() => {
    if (sessionId) {
        initializeWebRTC();  // ← Starts the flow
    }
    
    return () => {
        // Cleanup when component unmounts
    };
}, [sessionId]);
```

**Key Flow Function:**

```javascript
const initializeWebRTC = async () => {
    // ① CREATE SERVICE INSTANCE
    const learnerVideoService = new VideoConferenceService(
        WS_BASE_URL,           // Base URL for WebSocket
        sessionId,             // Session ID from route
        'trainer'              // Role identifier
    );
    
    // ② ATTACH CALLBACKS (for state updates)
    learnerVideoService.onLocalStream = (stream) => {
        setLocalStream(stream);  // Display trainer's own video
    };
    
    learnerVideoService.onRemoteStream = (stream) => {
        setRemoteStream(stream); // Display learner's video
        toast.success('Learner has joined');
    };
    
    learnerVideoService.onConnectionStateChange = (state) => {
        updateConnectionStatus(state);
    };
    
    learnerVideoService.onError = (error) => {
        toast.error(`Video error: ${error.message}`);
    };
    
    // ③ INITIALIZE SERVICE
    try {
        await learnerVideoService.initialize();  // ← Main initialization
        setLearnerRTC(learnerVideoService);      // Store in React state
    } catch (error) {
        toast.error('Failed to initialize video');
    }
};
```

### File: `src/api/services/videoConferenceService.js`

**Service Architecture - Initialization Sequence:**

```
initialize()
    ├─ Step 1: getLocalMedia()
    │   ├─ Check navigator.mediaDevices available
    │   ├─ Set constraints (720p, 30fps, echo cancellation)
    │   ├─ Call getUserMedia()
    │   └─ Trigger onLocalStream callback
    │
    ├─ Step 2: connectWebSocket()
    │   ├─ Build WebSocket URL: wss://host/ws/rtc/{sessionId}
    │   ├─ Create WebSocket instance
    │   ├─ Set onopen, onmessage, onerror, onclose handlers
    │   └─ Return Promise (resolves on connection)
    │
    ├─ Step 3: createPeerConnection()
    │   ├─ Create RTCPeerConnection with STUN/TURN servers
    │   ├─ Attach onicecandidate handler
    │   ├─ Attach ontrack handler (for remote stream)
    │   └─ Attach onconnectionstatechange handler
    │
    ├─ Step 4: addLocalTracksToConnection()
    │   └─ Add audio/video tracks from localStream to peer connection
    │
    ├─ Step 5: announcePresence()
    │   └─ Send {type:'join', role, sessionId} via WebSocket
    │
    ├─ Step 6: startConnectionMonitoring()
    │   └─ Monitor peer connection health
    │
    └─ Step 7: startHeartbeat()
        └─ Send pong every 30s to keep connection alive
```

**Message Handling Flow:**

```
ws.onmessage (receives signaling messages)
    │
    ├─ handleSignalingMessage(data)
    │   │
    │   ├─ case 'connected'
    │   │   └─ Backend confirmed WebSocket connected
    │   │
    │   ├─ case 'peer_ready'
    │   │   ├─ Both trainer & learner connected
    │   │   └─ Trainer: createOffer()
    │   │       ├─ peerConnection.createOffer()
    │   │       ├─ peerConnection.setLocalDescription()
    │   │       └─ ws.send({type:'offer', offer})
    │   │
    │   ├─ case 'offer' (Learner receives)
    │   │   └─ handleOffer(offer)
    │   │       ├─ peerConnection.setRemoteDescription(offer)
    │   │       ├─ peerConnection.createAnswer()
    │   │       ├─ peerConnection.setLocalDescription()
    │   │       └─ ws.send({type:'answer', answer})
    │   │
    │   ├─ case 'answer' (Trainer receives)
    │   │   └─ handleAnswer(answer)
    │   │       ├─ peerConnection.setRemoteDescription(answer)
    │   │       └─ Process pending ICE candidates
    │   │
    │   ├─ case 'ice-candidate'
    │   │   └─ handleIceCandidate(candidate)
    │   │       ├─ If remoteDescription exists
    │   │       │   └─ peerConnection.addIceCandidate()
    │   │       └─ Else
    │   │           └─ Queue in pendingIceCandidates[]
    │   │
    │   ├─ case 'ping'
    │   │   └─ ws.send({type:'pong'})  // Heartbeat response
    │   │
    │   └─ case 'observer_joined'
    │       └─ Notify trainer observer is watching
```

**WebRTC Event Handlers:**

```
peerConnection events:
    │
    ├─ onicecandidate
    │   └─ When ICE discovers a new network path
    │       └─ ws.send({type:'ice-candidate', candidate})
    │
    ├─ ontrack
    │   └─ When receiving remote media track
    │       ├─ Create or update remoteStream
    │       ├─ Add track to stream
    │       └─ Trigger onRemoteStream callback (UI updates)
    │
    └─ onconnectionstatechange
        └─ When connection state changes
            ├─ 'new' → 'connecting' → 'connected'
            ├─ 'disconnected' → clean up
            └─ Trigger onConnectionStateChange callback (UI updates)
```

---

## Backend Code Architecture

### File: `app/api/endpoints/websocket.py`

**Entry Point - WebSocket Endpoint:**

```python
@router.websocket("/ws/rtc/{session_id}")
async def websocket_rtc_endpoint(websocket: WebSocket, session_id: str):
    """
    Main WebSocket handler for WebRTC signaling
    Called when frontend connects to /ws/rtc/<session_id>
    """


**Data Structures:**

```python
class ConnectionInfo:
    """Represents one peer's connection to the session"""
    websocket: WebSocket              # The WebSocket connection object
    role: str                         # 'trainer', 'learner', or 'observer'
    session_id: str                   # Session identifier
    user_data: Optional[dict]         # Observer metadata
    last_heartbeat: datetime          # Track last ping/pong timestamp
    is_alive: bool                    # Connection health flag
    heartbeat_task: asyncio.Task      # Background task sending pings


# Global state - tracks active sessions
rtc_connections = {
    session_id_1: {
        'trainer': ConnectionInfo,    # Trainer's connection
        'learner': ConnectionInfo     # Learner's connection
    },
    session_id_2: { ... }
}
```

**Endpoint Flow:**

```
websocket_rtc_endpoint(websocket, session_id)
    │
    ├─ await websocket.accept()
    │   └─ Accept incoming WebSocket connection
    │
    ├─ Receive initial {join} message from client
    │   └─ await websocket.receive_json()
    │
    ├─ Validate join message
    │   ├─ Check type == 'join'
    │   ├─ Validate role in ['trainer', 'learner', 'observer']
    │   └─ Extract user_data if provided
    │
    ├─ Initialize session connections if needed
    │   └─ if session_id not in rtc_connections:
    │       └─ rtc_connections[session_id] = {}
    │
    ├─ Create ConnectionInfo and store
    │   ├─ conn_info = ConnectionInfo(websocket, role, session_id)
    │   ├─ rtc_connections[session_id][role] = conn_info
    │   └─ Start heartbeat task
    │
    ├─ Send confirmation to client
    │   └─ {type:'connected', role, session_id, heartbeat_interval}
    │
    ├─ Check if both peers connected
    │   └─ if len(rtc_connections[session_id]) == 2
    │       └─ Send {peer_ready} to trainer
    │
    ├─ MESSAGE RELAY LOOP (main processing)
    │   │
    │   └─ while conn_info.is_alive:
    │       │
    │       ├─ await websocket.receive_json()
    │       │
    │       ├─ if type == 'ping'
    │       │   └─ Send back {pong} and update last_heartbeat
    │       │
    │       ├─ if type == 'pong'
    │       │   └─ Update last_heartbeat timestamp
    │       │
    │       ├─ if has target_role
    │       │   └─ Direct routing: send to specific role
    │       │
    │       ├─ if role == 'trainer'
    │       │   └─ Route to 'learner' (default)
    │       │
    │       └─ if role == 'learner'
    │           └─ Route to 'trainer' (always)
    │
    └─ FINALLY BLOCK (cleanup)
        ├─ await cleanup_connection(session_id, role)
        ├─ Notify other peers about disconnection
        └─ Close WebSocket if needed
```

**Heartbeat Mechanism:**

```python
async def send_heartbeat(conn_info: ConnectionInfo):
    """Runs in background - checks connection health every 30 seconds"""
    
    while conn_info.is_alive:
        elapsed = (now - conn_info.last_heartbeat).total_seconds()
        
        # If no pong received for 90 seconds, close connection
        if elapsed > 90:
            conn_info.is_alive = False
            break
        
        # Wait 30 seconds, then send ping
        await asyncio.sleep(30)
        
        await conn_info.websocket.send_json({
            type: 'ping',
            timestamp: now.isoformat()
        })
```

**Message Relay Logic:**

```python
# Inside message relay loop

if message.get("type") == "offer":
    if role == "trainer":
        # Forward trainer's offer to learner
        target = rtc_connections[session_id]["learner"]
        await target.websocket.send_json(message)
    
elif message.get("type") == "answer":
    if role == "learner":
        # Forward learner's answer to trainer
        target = rtc_connections[session_id]["trainer"]
        await target.websocket.send_json(message)

elif message.get("type") == "ice-candidate":
    # Route ICE candidates based on sender role
    if role == "trainer":
        target = rtc_connections[session_id]["learner"]
    else:
        target = rtc_connections[session_id]["trainer"]
    
    await target.websocket.send_json(message)
```

---

## Data Flow Timeline

### Complete Sequence When User Clicks "Start Session"

```
Timeline:
═════════════════════════════════════════════════════════════════════

T=0.0s  Trainer clicks "Start Session"
        └─ TrainerSession.jsx mounts
           └─ useEffect triggers initializeWebRTC()

T=0.1s  Frontend: VideoConferenceService created
        ├─ role='trainer'
        ├─ sessionId from route params
        └─ callbacks attached

T=0.2s  Frontend: getLocalMedia() starts
        └─ navigator.mediaDevices.getUserMedia()
           └─ Browser requests camera/mic permissions
              └─ User allows
                 └─ Returns MediaStream (audio + video)

T=0.3s  Frontend: connectWebSocket() starts
        └─ new WebSocket('wss://host/ws/rtc/<session_id>')
           └─ WebSocket state: CONNECTING

T=0.5s  Frontend: WebSocket opens
        └─ ws.onopen triggered
           └─ announcePresence() called
              └─ Send: {type:'join', role:'trainer', sessionId}
                 └─ Sent to Backend via WebSocket

T=0.6s  Backend: websocket_rtc_endpoint() receives trainer join
        ├─ Accept WebSocket connection
        ├─ Receive {join, role:'trainer'}
        ├─ Create ConnectionInfo(websocket, 'trainer', session_id)
        ├─ Store: rtc_connections[session_id]['trainer'] = conn_info
        ├─ Start heartbeat task (background task)
        └─ Send back: {type:'connected', role:'trainer'}

T=0.7s  Frontend: Trainer gets connection confirmation
        └─ handleSignalingMessage({type:'connected'})
           └─ Set isConnected = true
              └─ UI updates: "Waiting for Learner..."

T=1.0s  Learner clicks "Join Session"
        └─ Same flow as trainer...
           ├─ LearnerSession.jsx mounts
           ├─ VideoConferenceService created with role='learner'
           ├─ getLocalMedia()
           └─ connectWebSocket() → announce presence

T=1.1s  Backend: websocket_rtc_endpoint() receives learner join
        ├─ Create ConnectionInfo for learner
        ├─ Store: rtc_connections[session_id]['learner'] = conn_info
        │
        ├─ CHECK: len(rtc_connections[session_id]) == 2
        │   YES! Both peers now connected
        │   └─ initiator_role = 'trainer'
        │      └─ Send to trainer: {type:'peer_ready'}

T=1.2s  Frontend (Trainer): Receive peer_ready signal
        └─ handleSignalingMessage({type:'peer_ready'})
           └─ if role == 'trainer' && !isOfferCreated
              └─ createOffer()
                 ├─ peerConnection.createOffer()
                 │   └─ Returns SDP offer (describes media capabilities)
                 ├─ peerConnection.setLocalDescription(offer)
                 │   └─ Stores offer locally
                 └─ ws.send({type:'offer', offer: SDP})
                    └─ Sent to Backend

T=1.3s  Backend: Receive offer message from trainer
        ├─ Extract message from WebSocket
        ├─ Message relay logic:
        │   └─ if role == 'trainer' && type == 'offer'
        │      └─ target = rtc_connections[session_id]['learner']
        │         └─ await target.websocket.send_json(message)

T=1.4s  Frontend (Learner): Receive offer
        └─ handleSignalingMessage({type:'offer', offer: SDP})
           └─ handleOffer(offer)
              ├─ peerConnection.setRemoteDescription(offer)
              │   └─ "Here's what trainer can send"
              ├─ peerConnection.createAnswer()
              │   └─ Returns SDP answer (learner's media capabilities)
              ├─ peerConnection.setLocalDescription(answer)
              │   └─ Stores answer locally
              └─ ws.send({type:'answer', answer: SDP})
                 └─ Sent to Backend

T=1.5s  Backend: Receive answer message from learner
        └─ Message relay logic:
           └─ if role == 'learner' && type == 'answer'
              └─ target = rtc_connections[session_id]['trainer']
                 └─ await target.websocket.send_json(message)

T=1.6s  Frontend (Trainer): Receive answer
        └─ handleSignalingMessage({type:'answer', answer: SDP})
           └─ handleAnswer(answer)
              ├─ peerConnection.setRemoteDescription(answer)
              │   └─ "Here's what learner can send"
              └─ Process any pending ICE candidates

T=1.7s - 2.0s  ICE Candidate Exchange (Multiple messages)
        ├─ Trainer: peerConnection.onicecandidate fires
        │   └─ Found network path (e.g., 192.168.1.100:54321)
        │      └─ ws.send({type:'ice-candidate', candidate})
        │         └─ Backend relays to learner
        │
        ├─ Learner: peerConnection.onicecandidate fires
        │   └─ Found network path (e.g., 203.0.113.45:62100)
        │      └─ ws.send({type:'ice-candidate', candidate})
        │         └─ Backend relays to trainer
        │
        └─ Both sides: Receive ICE candidates
            └─ handleIceCandidate(candidate)
               ├─ if remoteDescription is set
               │   └─ peerConnection.addIceCandidate()
               │      └─ "Try this network path"
               └─ else
                   └─ Queue in pendingIceCandidates[]

T=2.5s  ✅ P2P CONNECTION ESTABLISHED
        ├─ Frontend (Trainer): peerConnection.ontrack fires
        │   ├─ Receiving learner's video/audio track
        │   ├─ Create remoteStream
        │   └─ Trigger onRemoteStream callback
        │      └─ setRemoteStream(stream) → UI renders learner video
        │
        ├─ Frontend (Learner): peerConnection.ontrack fires
        │   ├─ Receiving trainer's video/audio track
        │   ├─ Create remoteStream
        │   └─ Trigger onRemoteStream callback
        │      └─ setRemoteStream(stream) → UI renders trainer video
        │
        └─ Both: connectionState = 'connected'
           └─ Trigger onConnectionStateChange callback
              └─ UI updates: "Connected ✅"

T=2.5s+  LIVE SESSION RUNNING
        ├─ Audio/Video flowing directly P2P (not through server)
        ├─ Backend heartbeat running (every 30s, timeout 90s)
        ├─ Whiteboard updates flowing through WebSocket
        └─ Chat messages flowing through separate chat WebSocket

T=X.Xs  USER ENDS SESSION
        └─ Close button clicked
           ├─ service.cleanup()
           │   ├─ Stop all tracks from localStream
           │   ├─ Close peerConnection
           │   └─ Close WebSocket
           │
           ├─ Frontend: ws.onclose triggered
           │   └─ Update UI: "Session ended"
           │
           └─ Backend: finally block executes
               ├─ cleanup_connection(session_id, role)
               ├─ Send notification to other peer
               │   └─ "Trainer has disconnected"
               └─ Remove from rtc_connections[session_id]
```

---

## Function Call Sequence

### 1. Frontend → Backend Message Flow

```
TRAINER CLICK "START SESSION"
    │
    ├─ TrainerSession.jsx
    │   └─ initializeWebRTC()
    │       └─ VideoConferenceService(ws_url, sessionId, 'trainer')
    │           └─ service.initialize()
    │               ├─ getLocalMedia() → getUserMedia()
    │               ├─ connectWebSocket() → WebSocket('/ws/rtc/{id}')
    │               ├─ createPeerConnection() → RTCPeerConnection()
    │               └─ announcePresence() → ws.send({join})
    │
    └─→ Backend (websocket_rtc_endpoint)
        ├─ Receive {type:'join', role:'trainer'}
        ├─ Create ConnectionInfo(ws, 'trainer', sessionId)
        ├─ Store in rtc_connections[sessionId]['trainer']
        ├─ Send back {type:'connected'}
        └─ Start heartbeat task


LEARNER CLICK "JOIN SESSION"
    │
    ├─ LearnerSession.jsx
    │   └─ Same flow as trainer...
    │       └─ ws.send({type:'join', role:'learner'})
    │
    └─→ Backend
        ├─ Receive join from learner
        ├─ Create ConnectionInfo for learner
        │
        ├─ CHECK: len(rtc_connections[sessionId]) == 2?
        │   YES ✓
        │   └─ Both connected! Send {peer_ready} to trainer
        │
        └─ Message Relay Loop active
```

### 2. WebRTC Handshake Sequence

```
TRAINER receives {peer_ready}
    │
    └─ handleSignalingMessage({type:'peer_ready'})
        └─ createOffer()
            ├─ peerConnection.createOffer() → SDP
            ├─ setLocalDescription(offer)
            └─ ws.send({type:'offer', offer}) → Backend


BACKEND receives offer from trainer
    │
    └─ message_relay_loop
        └─ route to learner
            └─ rtc_connections[sessionId]['learner'].websocket.send_json(offer)


LEARNER receives {offer}
    │
    └─ handleSignalingMessage({type:'offer', offer})
        └─ handleOffer(offer)
            ├─ setRemoteDescription(offer) → "Trainer can send this"
            ├─ createAnswer() → SDP
            ├─ setLocalDescription(answer)
            └─ ws.send({type:'answer', answer}) → Backend


BACKEND receives answer from learner
    │
    └─ message_relay_loop
        └─ route to trainer
            └─ rtc_connections[sessionId]['trainer'].websocket.send_json(answer)


TRAINER receives {answer}
    │
    └─ handleSignalingMessage({type:'answer', answer})
        └─ handleAnswer(answer)
            └─ setRemoteDescription(answer) → "Learner can send this"
```

### 3. ICE Candidate Exchange

```
During connection negotiation, both peers discover network paths:

TRAINER discovers network path
    │
    └─ peerConnection.onicecandidate
        └─ event.candidate: {candidate, sdpMid, ...}
            └─ ws.send({type:'ice-candidate', candidate}) → Backend


BACKEND routes ICE candidate
    │
    └─ message_relay_loop
        └─ route to learner
            └─ rtc_connections[sessionId]['learner'].websocket.send_json(candidate)


LEARNER receives ICE candidate
    │
    └─ handleSignalingMessage({type:'ice-candidate', candidate})
        └─ handleIceCandidate(candidate)
            ├─ if remoteDescription is set
            │   └─ peerConnection.addIceCandidate(candidate)
            │       └─ "Try connecting via this path"
            └─ else
                └─ pendingIceCandidates.push(candidate)
                   └─ (Queue for later)

(Same process in reverse for learner → trainer)
```

### 4. Connection Established

```
Once offer/answer/candidates exchanged:

TRAINER detects connection established
    │
    ├─ peerConnection.ontrack (receives learner's audio/video)
    │   ├─ Create remoteStream
    │   └─ Trigger onRemoteStream callback
    │       └─ TrainerSession.jsx updates state
    │           └─ <video> element displays learner
    │
    ├─ peerConnection.onconnectionstatechange
    │   ├─ state changes to 'connected'
    │   └─ Trigger onConnectionStateChange callback
    │       └─ UI shows "Connected ✓"
    │
    └─ Audio/Video now flowing DIRECTLY P2P
        └─ NOT through backend server


LEARNER detects connection established
    │
    ├─ peerConnection.ontrack (receives trainer's audio/video)
    │   ├─ Create remoteStream
    │   └─ Trigger onRemoteStream callback
    │       └─ LearnerSession.jsx updates state
    │           └─ <video> element displays trainer
    │
    └─ Audio/Video flowing DIRECTLY P2P


BOTH: Continuous heartbeat (every 30 seconds)
    │
    ├─ Backend: send_heartbeat() sends ping
    │   └─ ws.send({type:'ping'})
    │
    ├─ Frontend: receives ping
    │   └─ handleSignalingMessage({type:'ping'})
    │       └─ ws.send({type:'pong'})
    │
    └─ Backend: receives pong
        └─ Update conn_info.last_heartbeat
           └─ Connection still healthy ✓
```

---

## Summary: Key Flow Points

| Step | Event | Frontend | Backend | Result |
|------|-------|----------|---------|--------|
| 1 | Trainer clicks "Start Session" | initializeWebRTC() | Accepts WS connection | Trainer joined |
| 2 | Trainer announces presence | ws.send({join}) | Creates ConnectionInfo | rtc_connections[id][trainer] |
| 3 | Learner clicks "Join Session" | Same as trainer | Accepts WS connection | Learner joined |
| 4 | Learner announces presence | ws.send({join}) | Creates ConnectionInfo | rtc_connections[id][learner] |
| 5 | Both connected | — | Detects len==2 | Sends peer_ready to trainer |
| 6 | Receive peer_ready | createOffer() → ws.send() | Routes to learner | Offer transmitted |
| 7 | Receive offer | handleOffer() → ws.send() | Routes to trainer | Answer transmitted |
| 8 | Receive answer | handleAnswer() → ready | — | P2P ready |
| 9 | ICE discovery | ws.send(candidate) × N | Routes both ways | Network paths found |
| 10 | Connection established | ontrack + state change | — | **Video flowing** ✅ |

---

**Document Version:** 2.0 (Architecture & Flow)  
**Last Updated:** {{ date }}  
**Maintainer:** Development Team
