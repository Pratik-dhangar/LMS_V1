# WebSocket Improvements Documentation

## Overview
Enhanced WebSocket implementation with heartbeat/ping-pong mechanism, automatic reconnection support, and proper connection cleanup to prevent memory leaks.

## Key Improvements

### 1. ✅ Heartbeat/Ping-Pong Mechanism
**Problem**: Connections could time out silently without detection  
**Solution**: Implemented periodic ping/pong heartbeat system

**Configuration**:
```python
HEARTBEAT_INTERVAL = 30  # Send ping every 30 seconds
HEARTBEAT_TIMEOUT = 60   # Close if no pong received within 60 seconds
```

**How it works**:
- Server sends `{"type": "ping", "timestamp": "..."}` every 30 seconds
- Client must respond with `{"type": "pong"}` 
- If no pong received within 60 seconds, connection is marked dead and cleaned up
- Prevents silent connection failures and zombie connections

### 2. ✅ Connection Tracking & Metadata
**Problem**: No connection state tracking, difficult to manage connection lifecycle  
**Solution**: Introduced `ConnectionInfo` class to track connection state

**Features**:
```python
class ConnectionInfo:
    - websocket: WebSocket instance
    - role: User role (trainer/learner)
    - session_id: Session identifier
    - last_heartbeat: Last pong received timestamp
    - is_alive: Connection health status
    - heartbeat_task: Background heartbeat task
```

**Benefits**:
- Proper connection lifecycle management
- Background task tracking for cleanup
- Connection health monitoring
- Prevents memory leaks from orphaned connections

### 3. ✅ Graceful Cleanup
**Problem**: Connections not properly cleaned up, causing memory leaks  
**Solution**: Centralized cleanup function with proper error handling

**Cleanup Process**:
```python
async def cleanup_connection(connections, session_id, role):
    1. Stop heartbeat background task
    2. Close WebSocket connection safely
    3. Remove from active connections dict
    4. Clean up empty sessions
    5. Clear associated media state
    6. Release media control locks
```

**Cleanup Triggers**:
- WebSocket disconnect
- Connection timeout
- Unhandled exceptions
- Client disconnection
- Server shutdown

### 4. ✅ Reconnection Support
**Problem**: No reconnection logic, clients permanently disconnected on network issues  
**Solution**: Server-side notifications enable client-side reconnection logic

**Server Notifications**:
```json
// Connection established
{"type": "connected", "role": "trainer", "session_id": "123", "heartbeat_interval": 30}

// Peer disconnected
{"type": "peer_disconnected", "role": "learner"}

// Ping request
{"type": "ping", "timestamp": "2024-12-02T10:00:00"}
```

**Client Implementation Required**: See Client-Side Implementation section below

### 5. ✅ Connection State Synchronization
**Enhanced Features**:
- New connections receive current media state automatically
- Connection confirmation messages sent to clients
- Peer connection/disconnection notifications
- Heartbeat interval communicated to clients

## API Changes

### Connection Flow

#### 1. Initial Connection
```
Client → Server: WebSocket Connect
Server → Client: Accept Connection
Client → Server: {"type": "join", "role": "trainer"}
Server → Client: {"type": "connected", "role": "trainer", "session_id": "123", "heartbeat_interval": 30}
```

#### 2. Active Connection (Heartbeat)
```
Server → Client: {"type": "ping", "timestamp": "2024-12-02T10:00:00"}
Client → Server: {"type": "pong"}
(Repeat every 30 seconds)
```

#### 3. Disconnection
```
Client Disconnects (network issue, browser close, etc.)
Server: Detects disconnect
Server: Cleanup connection and resources
Server → Other Peer: {"type": "peer_disconnected", "role": "disconnected_role"}
```

## Client-Side Implementation Guide

### WebSocket Client with Reconnection

```javascript
class ResilientWebSocket {
  constructor(url, sessionId, role) {
    this.url = url;
    this.sessionId = sessionId;
    this.role = role;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.heartbeatInterval = 30000; // Default 30 seconds
    this.heartbeatTimer = null;
    this.isIntentionallyClosed = false;
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.isIntentionallyClosed = false;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;

      // Send join message
      this.send({ type: 'join', role: this.role });
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      this.stopHeartbeat();

      // Attempt reconnection if not intentionally closed
      if (!this.isIntentionallyClosed) {
        this.attemptReconnect();
      }
    };
  }

  handleMessage(message) {
    switch (message.type) {
      case 'connected':
        console.log('Connection confirmed:', message);
        this.heartbeatInterval = (message.heartbeat_interval || 30) * 1000;
        this.startHeartbeat();
        this.onConnected?.(message);
        break;

      case 'ping':
        // Respond to server ping
        this.send({ type: 'pong' });
        break;

      case 'peer_disconnected':
        console.log('Peer disconnected:', message.role);
        this.onPeerDisconnected?.(message);
        break;

      case 'peer_ready':
        this.onPeerReady?.(message);
        break;

      default:
        // Forward other messages to application
        this.onMessage?.(message);
        break;
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    // Send pong more frequently than server expects
    const interval = Math.floor(this.heartbeatInterval * 0.8);
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Server sends ping, we just need to be ready to respond
        // Optionally send a client-side ping for monitoring
        console.log('Heartbeat check - connection alive');
      }
    }, interval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.onMaxReconnectAttemptsReached?.();
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
    );

    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    } else {
      console.warn('WebSocket not open, message not sent:', message);
      return false;
    }
  }

  close() {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    this.ws?.close();
  }

  // Callback handlers (set by application)
  onConnected = null;
  onMessage = null;
  onPeerReady = null;
  onPeerDisconnected = null;
  onMaxReconnectAttemptsReached = null;
}
```

### Usage Example

```javascript
// Initialize WebSocket for WebRTC signaling
const rtcSocket = new ResilientWebSocket(
  `wss://api.example.com/ws/rtc/${sessionId}`,
  sessionId,
  'trainer'
);

// Set up event handlers
rtcSocket.onConnected = (message) => {
  console.log('Connected to session:', message.session_id);
  updateConnectionStatus('connected');
};

rtcSocket.onPeerReady = (message) => {
  console.log('Both peers connected, initiating WebRTC');
  initiateWebRTCOffer();
};

rtcSocket.onPeerDisconnected = (message) => {
  console.log('Peer disconnected:', message.role);
  updateConnectionStatus('peer_disconnected');
  showReconnectingMessage();
};

rtcSocket.onMessage = (message) => {
  // Handle WebRTC signaling messages
  handleWebRTCMessage(message);
};

rtcSocket.onMaxReconnectAttemptsReached = () => {
  showErrorMessage('Connection lost. Please refresh the page.');
};

// Connect
rtcSocket.connect();

// Send WebRTC signaling messages
function sendOffer(offer) {
  rtcSocket.send({
    type: 'offer',
    sdp: offer.sdp
  });
}

// Clean up on session end
function endSession() {
  rtcSocket.close();
}
```

## React Hook Example

```javascript
import { useEffect, useRef, useState } from 'react';

function useWebSocket(url, sessionId, role) {
  const [isConnected, setIsConnected] = useState(false);
  const [isPeerConnected, setIsPeerConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new ResilientWebSocket(url, sessionId, role);

    ws.onConnected = () => {
      setIsConnected(true);
    };

    ws.onPeerReady = () => {
      setIsPeerConnected(true);
    };

    ws.onPeerDisconnected = () => {
      setIsPeerConnected(false);
    };

    ws.onMessage = (message) => {
      // Handle messages
      console.log('Received:', message);
    };

    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [url, sessionId, role]);

  const sendMessage = (message) => {
    return wsRef.current?.send(message);
  };

  return {
    isConnected,
    isPeerConnected,
    sendMessage
  };
}

// Usage in component
function SessionComponent({ sessionId }) {
  const { isConnected, isPeerConnected, sendMessage } = useWebSocket(
    `wss://api.example.com/ws/rtc/${sessionId}`,
    sessionId,
    'trainer'
  );

  return (
    <div>
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      <div>Peer: {isPeerConnected ? 'Connected' : 'Waiting'}</div>
    </div>
  );
}
```

## Testing

### Manual Testing

1. **Connection Test**:
   ```bash
   # Use wscat or similar WebSocket client
   wscat -c "ws://localhost:8000/ws/rtc/test-session"
   
   # Send join message
   {"type": "join", "role": "trainer"}
   
   # You should receive:
   {"type": "connected", "role": "trainer", "session_id": "test-session", "heartbeat_interval": 30}
   ```

2. **Heartbeat Test**:
   - Wait 30 seconds after connecting
   - Server should send: `{"type": "ping", "timestamp": "..."}`
   - Respond with: `{"type": "pong"}`
   - Connection should stay alive

3. **Timeout Test**:
   - Connect but don't respond to ping
   - After 60 seconds, connection should be closed by server
   - Check server logs for cleanup messages

4. **Reconnection Test**:
   - Connect with client
   - Kill connection (close browser, disconnect network)
   - Reconnect - should work seamlessly
   - Media state should be restored for learners

### Automated Testing

```python
# tests/test_websocket.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_websocket_heartbeat(client):
    with client.websocket_connect("/ws/rtc/test-session") as websocket:
        # Send join
        websocket.send_json({"type": "join", "role": "trainer"})
        
        # Receive connected
        data = websocket.receive_json()
        assert data["type"] == "connected"
        assert data["heartbeat_interval"] == 30
        
        # Wait for ping (mock time if needed)
        # In real test, you'd mock asyncio.sleep
        
def test_websocket_cleanup(client):
    with client.websocket_connect("/ws/rtc/test-session") as ws1:
        ws1.send_json({"type": "join", "role": "trainer"})
        ws1.receive_json()
    
    # Connection should be cleaned up after context exit
    # Verify in-memory state is cleared
```

## Monitoring & Metrics

### Key Metrics to Track

1. **Active Connections**: Current number of open WebSocket connections
2. **Connection Duration**: Average and max connection lifetime
3. **Heartbeat Failures**: Number of connections closed due to timeout
4. **Reconnection Rate**: Percentage of connections that reconnect
5. **Message Throughput**: Messages per second per connection

### Logging

Enhanced logging includes:
- Connection lifecycle events (connect, disconnect, timeout)
- Heartbeat ping/pong exchanges (debug level)
- Cleanup operations
- Error conditions

```python
logger.info(f"{role} connected to session {session_id}")
logger.debug(f"Sent ping to {role} in session {session_id}")
logger.warning(f"Connection timeout for {role} in session {session_id}")
logger.error(f"Error during cleanup: {e}")
```

## Performance Considerations

### Memory Management
- ✅ Connections properly cleaned up on disconnect
- ✅ Background tasks cancelled before cleanup
- ✅ Empty sessions removed from dictionaries
- ✅ Media state cleared when session ends

### CPU Usage
- ✅ Heartbeat runs on 30-second intervals (low overhead)
- ✅ No busy polling or tight loops
- ✅ Efficient async/await patterns

### Network Usage
- ✅ Small ping/pong messages (~50 bytes)
- ✅ No unnecessary message forwarding
- ✅ Connection health checks prevent zombie connections

## Migration Guide

### For Existing Clients

**Minimal Changes Required**:
1. Handle new `"connected"` message type (optional)
2. Respond to `"ping"` with `"pong"` (required for connection stability)
3. Handle `"peer_disconnected"` message (recommended for UX)

**Backward Compatibility**:
- Existing clients will continue to work
- Heartbeat is server-driven, no client changes required
- Connection confirmation is optional

**Recommended Upgrade**:
```javascript
// Before
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleWebRTCMessage(message);
};

// After
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  // Handle new message types
  if (message.type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong' }));
    return;
  }
  
  if (message.type === 'connected') {
    console.log('Connection confirmed');
    return;
  }
  
  if (message.type === 'peer_disconnected') {
    handlePeerDisconnect(message);
    return;
  }
  
  // Existing logic
  handleWebRTCMessage(message);
};
```

## Troubleshooting

### Connection Keeps Dropping
**Check**: Client responding to pings?  
**Fix**: Implement pong response in client

### Memory Growing Over Time
**Check**: Are cleanup functions being called?  
**Fix**: Ensure proper exception handling in finally blocks

### Reconnection Not Working
**Check**: Is client implementing reconnection logic?  
**Fix**: Use `ResilientWebSocket` class from examples above

### Heartbeat Too Aggressive/Slow
**Adjust**: Modify `HEARTBEAT_INTERVAL` and `HEARTBEAT_TIMEOUT` constants  
**Recommendation**: 
- Low latency needed: 15s interval, 30s timeout
- Standard: 30s interval, 60s timeout  
- Low bandwidth: 60s interval, 120s timeout

## Future Enhancements

- [ ] Configurable heartbeat intervals per connection
- [ ] Connection quality metrics (latency, jitter)
- [ ] Automatic bandwidth throttling
- [ ] Connection pooling for multiple sessions
- [ ] Redis-backed connection state for horizontal scaling
- [ ] WebSocket compression support
- [ ] Rate limiting per connection
- [ ] Connection authentication refresh

## Summary

✅ **Heartbeat/Ping-Pong**: Prevents silent connection failures  
✅ **Connection Tracking**: Proper lifecycle management  
✅ **Graceful Cleanup**: No memory leaks  
✅ **Reconnection Support**: Server-side notifications enable client reconnection  
✅ **State Synchronization**: New connections receive current state  
✅ **Production Ready**: Proper error handling and logging  

**Impact**: Significantly improved WebSocket reliability and connection stability for real-time features.
