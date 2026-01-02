# Quick Integration Guide - WebRTC Improvements

## Usage in React Components

### 1. Basic Setup (VideoSession.jsx or similar)

```javascript
import VideoConferenceService from '@/api/services/videoConferenceService';

const VideoSessionComponent = () => {
    const [connectionQuality, setConnectionQuality] = useState('unknown');
    const [connectionState, setConnectionState] = useState('new');
    const videoServiceRef = useRef(null);

    useEffect(() => {
        // Initialize video service
        const wsUrl = `${import.meta.env.VITE_WS_URL}/ws/video/${sessionId}`;
        const service = new VideoConferenceService(wsUrl, sessionId, role);
        videoServiceRef.current = service;

        // Set up callbacks
        service.onLocalStream = (stream) => {
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
        };

        service.onRemoteStream = (stream) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = stream;
            }
        };

        service.onConnectionStateChange = (state) => {
            console.log('Connection state:', state);
            setConnectionState(state);
        };

        // NEW: Connection quality callback
        service.onConnectionQualityChange = (quality) => {
            console.log('Connection quality:', quality);
            setConnectionQuality(quality);
        };

        service.onError = (error) => {
            console.error('Video service error:', error);
            toast.error(error.message);
        };

        // Initialize
        service.initialize().catch(error => {
            console.error('Failed to initialize video:', error);
        });

        // Cleanup
        return () => {
            if (videoServiceRef.current) {
                videoServiceRef.current.close();
            }
        };
    }, [sessionId, role]);

    return (
        <div>
            {/* Connection Quality Indicator */}
            <ConnectionQualityIndicator quality={connectionQuality} />
            
            {/* Connection State Badge */}
            <ConnectionStateBadge state={connectionState} />
            
            {/* Video Elements */}
            <video ref={localVideoRef} autoPlay muted />
            <video ref={remoteVideoRef} autoPlay />
        </div>
    );
};
```

### 2. Connection Quality Indicator Component

```javascript
const ConnectionQualityIndicator = ({ quality }) => {
    const getQualityConfig = (quality) => {
        switch (quality) {
            case 'excellent':
                return { color: 'green', icon: 'signal-strong', text: 'Excellent' };
            case 'good':
                return { color: 'blue', icon: 'signal-good', text: 'Good' };
            case 'fair':
                return { color: 'yellow', icon: 'signal-fair', text: 'Fair' };
            case 'poor':
                return { color: 'orange', icon: 'signal-weak', text: 'Poor' };
            case 'failed':
                return { color: 'red', icon: 'signal-none', text: 'Failed' };
            case 'connecting':
                return { color: 'gray', icon: 'signal-connecting', text: 'Connecting...' };
            default:
                return { color: 'gray', icon: 'signal-unknown', text: 'Unknown' };
        }
    };

    const config = getQualityConfig(quality);

    return (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-${config.color}-100`}>
            <div className={`w-2 h-2 rounded-full bg-${config.color}-500 animate-pulse`} />
            <span className={`text-sm font-medium text-${config.color}-700`}>
                {config.text}
            </span>
        </div>
    );
};
```

### 3. Connection State Badge

```javascript
const ConnectionStateBadge = ({ state }) => {
    const stateMap = {
        'new': { label: 'Initializing', color: 'gray' },
        'connecting': { label: 'Connecting', color: 'blue' },
        'connected': { label: 'Connected', color: 'green' },
        'disconnected': { label: 'Reconnecting', color: 'yellow' },
        'failed': { label: 'Connection Failed', color: 'red' },
        'closed': { label: 'Closed', color: 'gray' }
    };

    const config = stateMap[state] || stateMap['new'];

    return (
        <span className={`px-2 py-1 text-xs rounded bg-${config.color}-100 text-${config.color}-700`}>
            {config.label}
        </span>
    );
};
```

### 4. Network Issue Toast/Alert

```javascript
useEffect(() => {
    if (!videoServiceRef.current) return;

    const service = videoServiceRef.current;
    
    service.onConnectionQualityChange = (quality) => {
        setConnectionQuality(quality);
        
        // Show warnings for poor quality
        if (quality === 'poor') {
            toast.warning('Network quality is poor. Video may lag.', {
                id: 'poor-network',
                duration: 5000
            });
        } else if (quality === 'failed') {
            toast.error('Connection lost. Attempting to reconnect...', {
                id: 'connection-failed',
                duration: Infinity // Keep showing until recovered
            });
        } else if (quality === 'excellent' || quality === 'good') {
            toast.dismiss('connection-failed'); // Dismiss error when recovered
            toast.dismiss('poor-network');
        }
    };

    service.onConnectionStateChange = (state) => {
        setConnectionState(state);
        
        // Show reconnection attempts
        if (state === 'disconnected') {
            toast.info('Connection interrupted. Reconnecting...', {
                id: 'reconnecting',
                duration: Infinity
            });
        } else if (state === 'connected') {
            toast.dismiss('reconnecting');
            toast.success('Connection restored!', { duration: 3000 });
        }
    };
}, []);
```

## Advanced Features

### Manual ICE Restart

```javascript
const handleManualReconnect = async () => {
    if (videoServiceRef.current?.peerConnection) {
        await videoServiceRef.current.restartIce();
        toast.info('Attempting to reconnect...');
    }
};

// Button
<button onClick={handleManualReconnect}>
    Reconnect Video
</button>
```

### Get Connection Stats

```javascript
const checkConnectionStats = async () => {
    if (!videoServiceRef.current) return;
    
    const stats = await videoServiceRef.current.getStats();
    console.log('Connection stats:', stats);
    
    // Stats are also logged automatically every 5 seconds to console
};
```

### Monitor Reconnection Attempts

```javascript
// Monitor browser console for:
// [VideoConference][trainer] WebSocket closed. Reconnecting in 2s... (attempt 3)
// Shows exponential backoff and attempt count
```

## Testing Scenarios

### 1. Network Interruption Test
```javascript
// In browser DevTools Console
// Simulate offline for 5 seconds
navigator.serviceWorker.controller.postMessage({
    type: 'SIMULATE_OFFLINE',
    duration: 5000
});

// Or simply:
// - Disconnect WiFi
// - Wait 5-10 seconds  
// - Reconnect WiFi
// Should see automatic reconnection
```

### 2. Mobile Network Handoff
- Switch from WiFi to mobile data during call
- Should see: disconnected → reconnecting → connected
- Quality indicator should update based on network speed

### 3. Poor Network Simulation
```javascript
// Chrome DevTools → Network → Throttling
// Select "Slow 3G" or "Fast 3G"
// Should see quality indicator change to "poor" or "fair"
```

## Monitoring & Debugging

### Browser Console Logs

**Successful Connection:**
```
[VideoConference][trainer] Initialization complete with monitoring
[VideoConference][trainer] WebSocket connected
[VideoConference][trainer] Announced presence
[VideoConference][trainer] Connection state: connected
[VideoConference][trainer] Connection quality: excellent
[VideoConference][trainer] Stats: Quality=excellent Loss=0.45% RTT=65ms Recv=1200KB Sent=1450KB
```

**Reconnection Flow:**
```
[VideoConference][trainer] WebSocket closed. Reconnecting in 2s... (attempt 1)
[VideoConference][trainer] WebSocket reconnected successfully
[VideoConference][trainer] Announced presence
```

**ICE Restart:**
```
[VideoConference][trainer] Connection state: disconnected
[VideoConference][trainer] Still disconnected after 5s, attempting ICE restart...
[VideoConference][trainer] Restarting ICE (attempt 1/10)...
[VideoConference][trainer] ICE restart offer sent successfully
[VideoConference][trainer] Connection state: connected
```

### Docker Logs (coturn)

```bash
# Monitor TURN server
docker logs -f hurshbintech-coturn

# Look for:
# - Relay allocations
# - STUN requests
# - Authentication attempts
```

### Network Tab (Browser DevTools)

- Check WebSocket connection: `ws://localhost:8000/ws/video/[session-id]`
- Should see: Status 101 (Switching Protocols)
- Messages tab shows ping/pong heartbeats

## Common Issues & Solutions

### Issue: Infinite reconnection loop
**Solution:** Check `sessionActive` flag. Close() method should set it to `false`.

```javascript
// Proper cleanup
const handleEndSession = () => {
    if (videoServiceRef.current) {
        videoServiceRef.current.close(); // Sets sessionActive = false
    }
};
```

### Issue: Quality always shows "unknown"
**Solution:** Ensure callback is set before initialize():

```javascript
service.onConnectionQualityChange = (quality) => setConnectionQuality(quality);
await service.initialize(); // Call after setting callbacks
```

### Issue: Remote video not showing after reconnection
**Solution:** Video element should update on stream change:

```javascript
service.onRemoteStream = (stream) => {
    if (remoteVideoRef.current) {
        // Always update srcObject
        remoteVideoRef.current.srcObject = stream;
    }
};
```

### Issue: Connection fails after 10 ICE restarts
**Solution:** This indicates a serious network/configuration issue. Check:
1. TURN server is running: `docker ps | grep coturn`
2. Firewall allows UDP 49152-65535
3. Security group rules on EC2
4. Test TURN server: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

## Production Checklist

- [ ] Set proper VITE_WS_URL environment variable
- [ ] Verify TURN server credentials in ICE_SERVERS config
- [ ] Test on mobile networks (not just WiFi)
- [ ] Test network handoff (WiFi → Mobile Data)
- [ ] Verify coturn container is running in production
- [ ] Check security group allows UDP 49152-65535
- [ ] Monitor connection quality in production logs
- [ ] Set up alerts for failed connections
- [ ] Test with VPN enabled
- [ ] Test across different ISPs/networks

## Performance Considerations

**Stats Check Frequency:**
- Connection quality: every 2 seconds
- Detailed stats logging: every 5 seconds
- Heartbeat: every 30 seconds

**Reduce if needed:**
```javascript
// In startConnectionMonitoring()
this.connectionCheckInterval = setInterval(async () => {
    // ... quality check
}, 5000); // Changed from 2000 to 5000 (5 seconds)

this.statsCheckInterval = setInterval(async () => {
    // ... stats logging
}, 10000); // Changed from 5000 to 10000 (10 seconds)
```

**Disable Stats Logging in Production:**
```javascript
// In logConnectionStats()
async logConnectionStats() {
    if (import.meta.env.MODE === 'production') return; // Skip in prod
    // ... rest of logging
}
```

## Environment Variables

Ensure these are set in `.env`:

```env
# Development
VITE_WS_URL=ws://localhost:8000

# Production
VITE_WS_URL=wss://yourdomain.com
```

## Summary

With these improvements, your video conferencing will:
- ✅ Automatically reconnect unlimited times
- ✅ Show real-time connection quality
- ✅ Handle network interruptions gracefully
- ✅ Restart ICE on connection failures
- ✅ Monitor heartbeat to detect dead connections
- ✅ Properly cleanup on session end
- ✅ Log detailed stats for debugging

The service is now production-ready for unreliable networks and mobile connections!
