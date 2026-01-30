# Session Flow & Initialization Guide

## Overview

A **session** in this application is a live teaching/learning interaction between a trainer and one or more learners. This document explains the complete lifecycle from scheduling through to session end, and how WebRTC + WebSocket fit into the flow.

---

## Table of Contents

1. [Session Lifecycle](#session-lifecycle)
2. [Session States](#session-states)
3. [Session Start Flow](#session-start-flow)
4. [WebRTC Initialization](#webrtc-initialization)
5. [WebSocket Initialization](#websocket-initialization)
6. [Connection Sequence Diagram](#connection-sequence-diagram)
7. [Data Flow During Session](#data-flow-during-session)
8. [Session End Flow](#session-end-flow)
9. [Error Handling & Recovery](#error-handling--recovery)

---


## Session States

| State | Description | Who Sets | Trigger |
|-------|-------------|----------|---------|
| **SCHEDULED** | Session created, waiting to start | Backend (initial) | Admin creates session |
| **ACTIVE** | Session in progress | Trainer | Trainer clicks "Start Session" |
| **ENDED** | Session completed | Trainer | Trainer clicks "End Session" |
| **EXPIRED** | Session duration exceeded | System/Backend | Time runs out (scheduled_date + duration) |
| **CANCELLED** | Session was cancelled | Trainer/Admin | Trainer cancels before starting |

---

## Session Start Flow

### Step 1: Trainer Views Schedule (TodaysSchedule.jsx)

```javascript
// File: src/pages/trainer/TodaysSchedule.jsx

const TodaysSchedule = () => {
  const [sessions, setSessions] = useState([]);

  // Fetch trainer's sessions
  useEffect(() => {
    const data = await sessionService.getTrainerSessions();
    setSessions(data); // Contains all sessions (scheduled, active, ended, etc.)
  }, []);

  // Render list of sessions
  // Trainer sees buttons based on session status:
  // - Scheduled → "Start Session" button
  // - Active → "Resume Session" button
  // - Ended/Expired → Just view details
}
```

**What the trainer sees:**
- List of sessions with status badges
- "Start Session" button for SCHEDULED sessions
- "Resume Session" button for ACTIVE sessions
- Session details: time, duration, learner name, program

---

### Step 2: Trainer Starts Session

```javascript
// User clicks "Start Session" button
const handleStartSession = async (sessionId) => {
  try {
    // 1. Call backend to change session status to ACTIVE
    await sessionService.startSession(sessionId);
    
    // 2. Navigate to session interface
    navigate(`/trainer/session/${sessionId}`);
    
  } catch (error) {
    toast.error("Failed to start session");
  }
};
```

**Backend does:**
- Updates session status: SCHEDULED → ACTIVE
- Records session start time
- Generates session ID for WebRTC/WebSocket connections

---

### Step 3: TrainerSession Component Mounts

```
URL: /trainer/session/{sessionId}
Component: src/pages/trainer/TrainerSession.jsx
```

**Component initialization sequence:**

```javascript
const TrainerSession = () => {
  const { sessionId } = useParams(); // Extract from URL
  
  // Step 1: On mount, extract user data
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user_data'));
    initializeSession(user.id); // Pass trainer ID
  }, []);
  
  // Step 2: Fetch session details
  const initializeSession = async (trainerId) => {
    try {
      // Fetch full session data
      const sessionData = await sessionService.getSessionDetails(sessionId);
      setSessionInfo(sessionData); // Store in state
      
      // Initialize WebRTC for learner
      initializeWebRTC(trainerId, sessionData);
      
      // Initialize WebSocket for whiteboard
      initializeWebSocket(sessionId);
      
    } catch (error) {
      handleInitError(error);
    }
  };
};
```

---

## WebRTC Initialization

### When WebRTC Starts

WebRTC initialization happens **immediately after session start**, triggered by `initializeSession()`.

### What Happens

```
┌─────────────────────────────────────────────────────────────────┐
│            WebRTC Initialization Flow (Trainer Side)            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. TrainerSession mounts                                        │
│    ↓                                                             │
│ 2. Calls initializeWebRTC(trainerId, sessionData)              │
│    ↓                                                             │
│ 3. Creates VideoConferenceService instance                      │
│    ├─ Sets up local media (camera + microphone)                │
│    ├─ Gets user's local stream                                 │
│    └─ Prepares for P2P connection                              │
│    ↓                                                             │
│ 4. Calls webRTC.createOffer()                                  │
│    ├─ Generates SDP (Session Description Protocol)            │
│    ├─ Includes ICE candidates (potential connection routes)    │
│    └─ Ready to send to learner                                 │
│    ↓                                                             │
│ 5. Waits for learner to join & accept offer                    │
│    ├─ Learner receives notification                            │
│    ├─ Learner opens session URL                               │
│    ├─ Learner's browser creates matching RTCPeerConnection    │
│    ├─ Learner sends back answer (also SDP + ICE)              │
│    └─ Trainer receives answer                                  │
│    ↓                                                             │
│ 6. ICE Connection Establishment                                │
│    ├─ Both sides try multiple connection paths                 │
│    ├─ Perform STUN (get public IP if behind NAT)              │
│    ├─ Exchange ICE candidates                                  │
│    ├─ Find best route through internet                         │
│    └─ Connection ESTABLISHED ↔ P2P video/audio flowing        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Code Example: WebRTC Setup

```javascript
// File: src/api/services/videoConferenceService.js

class VideoConferenceService {
  constructor(config) {
    this.config = config;
    this.peerConnection = null;
    this.localStream = null;
  }

  async initialize(userId, sessionId) {
    try {
      // 1. Get local media stream
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: 1280, height: 720 }
      });
      
      console.log('[VideoConference] Local stream acquired');

      // 2. Create RTCPeerConnection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // 3. Add local tracks to connection
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // 4. Handle remote stream
      this.peerConnection.ontrack = (event) => {
        console.log('[VideoConference] Remote stream received');
        this.onRemoteStream(event.streams[0]); // Callback to parent
      };

      // 5. Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          // Send candidate to remote peer via WebSocket/signaling server
          this.sendSignal('ice_candidate', {
            candidate: event.candidate,
            sessionId: sessionId
          });
        }
      };

      // 6. Create offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      console.log('[VideoConference] Offer created and sent');
      
      // Send offer to learner via backend signaling
      return offer;

    } catch (error) {
      console.error('[VideoConference] Initialization error:', error);
      throw error;
    }
  }
}
```

---

## WebSocket Initialization

### When WebSocket Starts

WebSocket initialization happens **simultaneously with or immediately after WebRTC setup**.

### What Happens

```
┌──────────────────────────────────────────────────────────────────┐
│           WebSocket Initialization Flow (Whiteboard)             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 1. TrainerSession calls initializeWebSocket(sessionId)          │
│    ↓                                                              │
│ 2. Creates WebSocket connection                                 │
│    └─ URL: ws://backend/api/whiteboard/{sessionId}              │
│    ↓                                                              │
│ 3. Authenticates with JWT token                                 │
│    ├─ Sends: { type: 'join', user_id, token, role: 'trainer' } │
│    └─ Backend verifies token and adds user to session           │
│    ↓                                                              │
│ 4. Connection established (WebSocket OPEN)                      │
│    ├─ Trainer can now send/receive messages                    │
│    ├─ Whiteboard updates sync to learner                        │
│    ├─ Chat messages exchanged                                   │
│    └─ Real-time events flow both directions                     │
│    ↓                                                              │
│ 5. Learner joins (via WebRTC signal)                           │
│    ├─ Learner's WebSocket also connects                         │
│    ├─ Both registered in same session room                      │
│    └─ Messages now broadcast between both                       │
│    ↓                                                              │
│ 6. Observer joins (optional)                                    │
│    ├─ Observer's WebSocket connects                             │
│    ├─ Observer added to session room                            │
│    ├─ Observer receives whiteboard/chat (read-only or limited)  │
│    └─ Trainer may ask observer to share screen                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Code Example: WebSocket Setup

```javascript
// File: src/api/services/whiteboardService.js

class WhiteboardService {
  constructor(sessionId, config) {
    this.sessionId = sessionId;
    this.ws = null;
  }

  async connect(userId, token) {
    return new Promise((resolve, reject) => {
      try {
        // 1. Establish WebSocket connection
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const url = `${protocol}//${window.location.host}/api/whiteboard/${this.sessionId}`;
        
        this.ws = new WebSocket(url);

        // 2. On connection open
        this.ws.onopen = () => {
          console.log('[WhiteboardService] WebSocket connected');

          // 3. Authenticate
          this.send('join', {
            user_id: userId,
            token: token,
            role: 'trainer'
          });

          resolve();
        };

        // 4. Handle incoming messages
        this.ws.onmessage = (event) => {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'drawing_update':
              this.onDrawingUpdate(data);
              break;
            case 'item_placed':
              this.onItemPlaced(data);
              break;
            case 'user_joined':
              this.onUserJoined(data);
              break;
            case 'user_left':
              this.onUserLeft(data);
              break;
            case 'message':
              this.onMessage(data);
              break;
            default:
              console.log('[WhiteboardService] Unknown message type:', data.type);
          }
        };

        // 5. Handle errors
        this.ws.onerror = (error) => {
          console.error('[WhiteboardService] Error:', error);
          reject(error);
        };

        // 6. Handle connection close
        this.ws.onclose = () => {
          console.log('[WhiteboardService] WebSocket closed');
          this.attemptReconnect();
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  send(type, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: type,
        ...data,
        timestamp: Date.now()
      }));
    } else {
      console.warn('[WhiteboardService] WebSocket not ready, queuing message');
      // Queue message for resend after reconnect
    }
  }
}
```

---

## Connection Sequence Diagram

### Complete Session Startup Timeline

```
TIME    TRAINER                 BACKEND                 LEARNER
────────────────────────────────────────────────────────────────────
T0      [clicks "Start Session"]
        ↓
T0.1    sessionService.startSession(sessionId)
        ────────────────────→ [Update session.status = ACTIVE]
        ↓
T0.5    navigate to /trainer/session/{sessionId}
        ↓
T1      TrainerSession mounted
        ├─ Fetch session details
        │  ────────────────────→ [Get session metadata]
        ←──────────────────── [return session data]
        ↓
T2      Initialize WebRTC
        ├─ Create RTCPeerConnection
        ├─ Get local media (camera + mic)
        ├─ Create SDP offer
        ├─ Send offer via signaling
        │  ────────────────────→ [Offer stored, awaiting learner]
        └─ Ready for connection
        ↓
T2.5    Initialize WebSocket
        ├─ Connect to ws://backend/whiteboard/{sessionId}
        ├─ Send 'join' message with JWT
        └─ WebSocket established (OPEN)
        ↓
T3      [Learner receives notification]
        ─────────────────────────────────→ [Notification sent]
        ↓                                   [Learner clicks link]
        ↓                                   [Navigate to /session/{sessionId}]
        ↓                                   [Component mounted]
        ↓
T4      [Trainer sees: "Connecting..." or spinner]
        ↓
T4.5    ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ← [Learner: Fetch session, create WebRTC]
        ↓                       [Learner: Get local media]
        ↓                       [Learner: Create answer SDP]
        ↓                       [Learner: Send answer via signaling]
        ↓
T5      [Trainer receives answer]
        ├─ Set remote description (learner's SDP)
        ├─ Exchange ICE candidates
        └─ P2P connection establishing
        ↓
T5.5    ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ← [Learner: Connect WebSocket]
        ↓                       [Learner: Send 'join' to whiteboard]
        ↓
T6      ICE connection successful
        ├─ Video/audio flowing
        ├─ P2P connection ESTABLISHED
        ├─ onRemoteStream triggered
        ├─ Learner video visible
        └─ Session is LIVE
        ↓
T6.5    Whiteboard ready for interaction
        ├─ Both can draw on whiteboard
        ├─ Chat messages working
        ├─ Real-time sync active
        └─ Session fully functional
        ↓
T7      [Optional: Observer joins]
        ├─ Gets link
        ├─ Joins as observer
        ├─ Can watch (read-only or limited)
        └─ Trainer can share screen with observer
        ↓
TIME    TRAINER                 BACKEND                 LEARNER
```

---

## Data Flow During Session

### Message Types & Routing

During an active session, different data flows through different channels:

#### 1. **WebRTC (Direct P2P)**
```
┌──────────────────┐         P2P Network        ┌──────────────────┐
│     TRAINER      │◄──────────────────────────►│     LEARNER      │
│   RTCPeerCon.    │                            │   RTCPeerCon.    │
└──────────────────┘                            └──────────────────┘
   ↓            ↑
   Video/Audio Streams (binary, low-latency)
   - Camera feed
   - Microphone audio
   - Real-time, minimal latency
```

#### 2. **WebSocket (Signaling & Sync)**
```
┌──────────────────┐                           ┌──────────────────┐
│     TRAINER      │                           │     LEARNER      │
│   WebSocket      │◄──────────────────────────│   WebSocket      │
│   Connection     │        (via Backend)      │   Connection     │
└──────────────────┘                           └──────────────────┘
   ↓                                                    ↓
Whiteboard events:                              Whiteboard events:
- Drawing (pen strokes)                        - Drawing (pen strokes)
- Items placed                                 - Items placed
- Erasing                                      - Erasing
- Chat messages                                - Chat messages
- Typing indicators                            - Typing indicators
- User online/offline                          - User online/offline
```

#### 3. **REST API (Non-real-time)**
```
┌──────────────────┐                           ┌──────────────────┐
│     TRAINER      │─────────────────────────► │      BACKEND     │
│   REST Calls     │   (HTTP requests)         │   Session API    │
│   (Periodically) │◄─────────────────────────│                  │
└──────────────────┘                           └──────────────────┘
   ↓                                                    ↓
Used for:                                      Handles:
- Save session notes                           - Session lifecycle
- Update session metadata                      - Recording management
- Download recordings                          - Report generation
- Get session history                          - Payment processing
```

### Data Flow Example: Drawing Stroke

```
SCENARIO: Trainer draws a line on the whiteboard

Step 1: Trainer draws with pen tool
  ├─ Mouse down on whiteboard canvas
  ├─ Move mouse while drawing
  └─ Mouse up to complete stroke

Step 2: React updates local state
  └─ canvasItems[] updated with new drawing object

Step 3: Send via WebSocket
  └─ whiteboardService.send('drawing_update', {
       points: [...],
       color: '#000000',
       lineWidth: 2,
       timestamp: Date.now()
     })

Step 4: Backend receives & broadcasts
  └─ Message routed to learner's WebSocket connection
  
Step 5: Learner receives drawing event
  ├─ whiteboardService.onmessage triggered
  ├─ Parse message: { type: 'drawing_update', points, color, ... }
  └─ Update learner's canvasItems state

Step 6: Learner's UI re-renders
  └─ Whiteboard component draws the line
  
Result: Learner sees the line appear in real-time (latency: 50-200ms typically)
```

---

## Session End Flow

### What Happens When Trainer Ends Session

```javascript
const handleEndSession = async () => {
  try {
    // 1. Call backend to change status to ENDED
    await sessionService.endSession(sessionId, 'Session ended by trainer');

    // 2. Notify learner
    whiteboardService.send('session_ended', {
      reason: 'Trainer ended the session',
      timestamp: Date.now()
    });

    // 3. Close all connections
    cleanup();  // Closes WebRTC + WebSocket

    // 4. Navigate away
    navigate('/trainer/dashboard');

  } catch (error) {
    toast.error('Error ending session');
  }
};

const cleanup = () => {
  // Close WebRTC connections
  if (learnerRTC) learnerRTC.close();
  if (observerRTC) observerRTC.close();

  // Close WebSocket
  if (whiteboardService) whiteboardService.close();

  // Stop media tracks
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }

  // Clear session state
  clearSessionActivity(sessionId, 'trainer');
};
```

### Timeline

```
T0      Trainer clicks "End Session"
        ↓
T1      Backend updates session.status = ENDED
        ├─ Records end_time
        ├─ Calculates session duration
        └─ Triggers recording finalization
        ↓
T2      Learner receives session_ended event
        ├─ Shows message "Session has ended"
        ├─ Learner's WebSocket closes
        ├─ Learner's WebRTC closes
        └─ Learner navigates away
        ↓
T3      Trainer's connections close
        ├─ WebRTC closes (frees camera/mic)
        ├─ WebSocket closes
        └─ Local state cleared
        ↓
T4      Both return to dashboard
        ├─ Session no longer "ACTIVE"
        ├─ Session now shows "ENDED"
        └─ Recording processing begins (if enabled)
        ↓
T5+     Post-session:
        ├─ Backend processes recording
        ├─ Generates session report
        ├─ Both can view session details
        └─ Recording available after processing
```

---

## Error Handling & Recovery

### Common Errors During Session

| Error | Cause | Recovery |
|-------|-------|----------|
| **WebRTC Connection Failed** | Network/firewall blocks P2P | Fallback to server relay (if available), or show error |
| **Microphone/Camera Access Denied** | User blocked permissions | Show permission request, retry |
| **WebSocket Disconnected** | Network interruption | Auto-reconnect with exponential backoff |
| **Learner Doesn't Join** | Learner offline or link wrong | Trainer sees "Waiting for learner", can wait or end |
| **ICE Candidate Error** | STUN/TURN server unreachable | Try alternate routes, use TURN server |

### Reconnection Logic

```javascript
class WhiteboardService {
  async reconnect() {
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        await this.connect(userId, token);
        console.log('[WhiteboardService] Reconnected successfully');
        return;
      } catch (error) {
        attempt++;
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        console.log(`[WhiteboardService] Reconnect attempt ${attempt}/${maxRetries} in ${delay}ms`);
        await sleep(delay);
      }
    }

    console.error('[WhiteboardService] Failed to reconnect after all attempts');
    toast.error('Connection lost - please refresh the page');
  }

  attemptReconnect() {
    if (this.reconnecting) return;
    this.reconnecting = true;
    this.reconnect().finally(() => {
      this.reconnecting = false;
    });
  }
}
```

---

## Summary: The Three Phases

### Phase 1: Pre-Session (Scheduled)
- Session exists in database
- Status = SCHEDULED
- Trainer can view on TodaysSchedule
- No WebRTC or WebSocket yet

### Phase 2: During Session (Active)
- Trainer clicks "Start Session"
- TrainerSession component loads
- **WebRTC**: P2P connection for video/audio
- **WebSocket**: Real-time whiteboard, chat, drawing
- Both trainer and learner connected
- Session data flowing continuously

### Phase 3: Post-Session (Ended)
- Trainer clicks "End Session"
- All connections close
- Session status = ENDED
- Recording processing begins
- Both return to dashboard

---

## Key Takeaways

1. **Session** = A container for the entire training interaction (metadata, timestamps, recording)
2. **WebRTC** = Direct peer-to-peer video/audio connection (low latency, no server overhead)
3. **WebSocket** = Real-time messaging channel for whiteboard, chat, sync (goes through backend server)
4. **REST API** = Async operations (save notes, get session details, manage recordings)

Think of it like:
- **Session** = The meeting room
- **WebRTC** = The telephone call (direct audio/video)
- **WebSocket** = The shared whiteboard (synced updates via network)
- **REST API** = The filing cabinet (persistent data storage)

---

**For more details:**
- [CHAT_SYSTEM_ARCHITECTURE.md](CHAT_SYSTEM_ARCHITECTURE.md) - Messaging system details
- [WEBRTC_WEBSOCKET_CODE_WALKTHROUGH.md](WEBRTC_WEBSOCKET_CODE_WALKTHROUGH.md) - Technical deep dive into P2P connections

**Document Version:** 1.0  
**Last Updated:** January 30, 2026  
**Status:** Complete
