/**
 * Video Conference Service - Professional WebRTC Implementation
 * Handles peer-to-peer video/audio conferencing between trainer and learner
 * 
 * Features:
 * - Clean WebRTC peer connection setup
 * - ICE candidate handling with proper queuing
 * - WebSocket signaling with reconnection
 * - Media device management (camera/mic)
 * - Connection state monitoring
 * - Error handling and recovery
 */

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
        urls: 'turn:103.192.199.59:3478',
        username: 'hurshbin',
        credential: 'SecureTurnPass2024!',
    },
    {
        urls: 'turn:103.192.199.59:3478?transport=tcp',
        username: 'hurshbin',
        credential: 'SecureTurnPass2024!',
    },
    {
        urls: 'turns:103.192.199.59:443?transport=tcp',
        username: 'hurshbin',
        credential: 'SecureTurnPass2024!',
    },
];

const RTC_CONFIG = {
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceTransportPolicy: 'all',
};

const normalizeWsBaseUrl = (rawUrl) => {
    const wsUrl = (rawUrl || import.meta.env.VITE_WS_URL || 'ws://localhost:8002')
        .trim()
        .replace(/^https:/, 'wss:')
        .replace(/^http:/, 'ws:')
        .replace(/\/+$/, '');

    // Accept legacy values ending in /ws and normalize to host-only base URL.
    return wsUrl.replace(/\/ws$/i, '');
};

class VideoConferenceService {
    constructor(wsUrl, sessionId, role, isObserver = false, targetRole = null) {
        this.wsUrl = wsUrl;
        this.sessionId = sessionId;
        this.role = role; // 'trainer', 'learner', or 'observer'
        this.isObserver = isObserver; // Flag to indicate observer mode
        this.targetRole = targetRole; // Specific target for signaling (e.g., 'observer' for trainer's second connection)

        // WebRTC Components
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;

        // WebSocket for signaling
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = Infinity; // Unlimited retries for session persistence
        this.reconnectDelay = 1000; // Start with 1 second
        this.maxReconnectDelay = 30000; // Max 30 seconds between retries
        this.reconnecting = false;
        this.heartbeatInterval = null;
        this.heartbeatTimeout = null;

        // Connection monitoring
        this.connectionQuality = 'unknown';
        this.connectionCheckInterval = null;
        this.statsCheckInterval = null;
        this.disconnectTimer = null;
        this.iceRestartAttempts = 0;
        this.maxIceRestartAttempts = 10;

        // State management
        this.isInitialized = false;
        this.pendingIceCandidates = [];
        this.hasCreatedOffer = false;
        this.sessionActive = true; // Flag to stop reconnection when session ends
        this.remoteStreamId = null; // Track remote stream for reliability

        // Callback functions
        this.onLocalStream = null;
        this.onRemoteStream = null;
        this.onConnectionStateChange = null;
        this.onConnectionQualityChange = null; // New callback for quality monitoring
        this.onError = null;
        this.onMessage = null;
        this.onPromptMeterUpdate = null;
        this.onReinforcementMeterUpdate = null;
        this.onReinforcementVisibilityUpdate = null;
        this.onPromptText = null;
        this.onFreeze = null;
        this.onParticipantJoinRequest = null; // Called when learner/client announces presence (admit/reject flow)
        this.pendingPeerReady = false; // True when waiting for instructor to admit the learner
    }

    /**
     * Initialize the video conference
     * @returns {Promise<MediaStream>} Local media stream (null for observers)
     */
    async initialize(userData = null) {
        try {
            // console.log(`[VideoConference][${this.role}] Initializing video conference...`);

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

            // console.log(`[VideoConference][${this.role}] Initialization complete with monitoring`);

            return this.localStream;
        } catch (error) {
            console.error(`[VideoConference][${this.role}] Initialization failed:`, error);
            if (this.onError) {
                this.onError(error);
            }
            this.diagnoseTurnConnectivity();
            throw error;
        }
    }

    /**
     * Get local media stream (camera + microphone)
     * @returns {Promise<MediaStream>}
     */
    async getLocalMedia() {
        try {
            // console.log(`[VideoConference][${this.role}] Requesting media access...`);

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

            const getStream = async (mediaConstraints) => {
                const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

                // Trigger callback if set
                if (this.onLocalStream) {
                    this.onLocalStream(stream);
                }

                return stream;
            };

            try {
                return await getStream(constraints);
            } catch (combinedError) {
                console.warn(`[VideoConference][${this.role}] Full A/V capture failed, retrying with separate camera and microphone requests:`, combinedError);

                try {
                    const videoStream = await navigator.mediaDevices.getUserMedia({ video: constraints.video, audio: false });
                    const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: constraints.audio });

                    const mergedStream = new MediaStream();
                    videoStream.getVideoTracks().forEach(track => mergedStream.addTrack(track));
                    audioStream.getAudioTracks().forEach(track => mergedStream.addTrack(track));

                    if (this.onLocalStream) {
                        this.onLocalStream(mergedStream);
                    }

                    return mergedStream;
                } catch (separateError) {
                    throw separateError;
                }
            }
        } catch (error) {
            console.error(`[VideoConference][${this.role}] Media access failed:`, error);

            throw new Error(`Media access denied: ${error.message}`);
        }
    }

    /**
     * Start screen sharing (for observer mode)
     * @param {string} targetRole - Optional target role to send offer to (e.g., 'observer')
     * @returns {Promise<MediaStream>}
     */
    async startScreenShare(targetRole = null) {
        try {
            console.log(`[VideoConference][${this.role}] Starting screen share for observer...`);

            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'monitor'
                },
                audio: false
            });

            console.log(`[VideoConference][${this.role}] Screen share started`);

            // Replace video tracks in peer connection
            if (this.peerConnection) {
                const videoTrack = screenStream.getVideoTracks()[0];
                const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');

                if (sender) {
                    await sender.replaceTrack(videoTrack);
                    console.log(`[VideoConference][${this.role}] Video track replaced with screen share`);
                } else {
                    this.peerConnection.addTrack(videoTrack, screenStream);
                    console.log(`[VideoConference][${this.role}] Screen share track added`);
                }

                // Mute audio track for observer (they should only see screen, not hear trainer)
                if (targetRole === 'observer') {
                    const audioSenders = this.peerConnection.getSenders().filter(s => s.track?.kind === 'audio');
                    audioSenders.forEach(sender => {
                        if (sender.track) {
                            sender.track.enabled = false;
                            console.log(`[VideoConference][${this.role}] Muted audio track for observer`);
                        }
                    });
                }

                // Handle screen share stop
                videoTrack.onended = () => {
                    console.log(`[VideoConference][${this.role}] Screen share stopped by user`);
                    this.stopScreenShare();
                };

                // CRITICAL: After adding track, we must renegotiate.
                // If a specific target (Observer) is waiting, force an offer to THEM only.
                if (targetRole) {
                    // Slight delay to ensure tracks are attached
                    setTimeout(() => this.createOffer(targetRole), 500);
                }
            }

            return screenStream;
        } catch (error) {
            console.error(`[VideoConference][${this.role}] Screen share failed:`, error);
            throw error;
        }
    }

    /**
     * Stop screen sharing and restore camera
     */
    async stopScreenShare() {
        try {
            console.log(`[VideoConference][${this.role}] Stopping screen share...`);

            // Notify observers that screen share has stopped
            if (this.role === 'trainer' && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'screen_share_stopped',
                    sender: this.role
                }));
                console.log(`[VideoConference][${this.role}] Notified observers that screen share stopped`);
            }

            // Restore original camera track if available
            if (this.localStream && this.peerConnection) {
                const videoTrack = this.localStream.getVideoTracks()[0];
                if (videoTrack) {
                    const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) {
                        await sender.replaceTrack(videoTrack);
                        console.log(`[VideoConference][${this.role}] Restored camera track`);
                    }
                }
            }
        } catch (error) {
            console.error(`[VideoConference][${this.role}] Error stopping screen share:`, error);
        }
    }

    /**
     * Connect to WebSocket for signaling
     * @returns {Promise<void>}
     */
    connectWebSocket() {
        return new Promise((resolve, reject) => {
            const wsUrl = normalizeWsBaseUrl(this.wsUrl);

            const wsEndpoint = `${wsUrl}/ws/rtc/${this.sessionId}`;
            // console.log(`[VideoConference][${this.role}] Connecting to WebSocket:`, wsEndpoint);

            this.ws = new WebSocket(wsEndpoint);

            this.ws.onopen = () => {
                // console.log(`[VideoConference][${this.role}] WebSocket connected`);
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
                // console.log(`[VideoConference][${this.role}] WebSocket closed`);
                this.handleWebSocketClose();
            };
        });
    }

    /**
     * Handle WebSocket close and attempt reconnection (unlimited retries)
     */
    handleWebSocketClose() {
        if (!this.sessionActive) {
            // console.log(`[VideoConference][${this.role}] Session ended, not reconnecting`);
            return;
        }

        if (this.reconnecting) {
            // console.log(`[VideoConference][${this.role}] Already attempting reconnection`);
            return;
        }

        this.reconnecting = true;
        this.reconnectAttempts++;

        // Exponential backoff with max delay
        const delay = Math.min(
            this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1),
            this.maxReconnectDelay
        );

        // console.log(`[VideoConference][${this.role}] WebSocket closed. Reconnecting in ${Math.round(delay/1000)}s... (attempt ${this.reconnectAttempts})`);

        setTimeout(async () => {
            try {
                await this.connectWebSocket();
                this.reconnecting = false;
                this.reconnectAttempts = 0;
                // console.log(`[VideoConference][${this.role}] WebSocket reconnected successfully`);

                // Restart heartbeat after reconnection
                this.startHeartbeat();

                // Re-announce presence
                this.announcePresence();
            } catch (error) {
                console.error(`[VideoConference][${this.role}] Reconnection failed:`, error);
                this.reconnecting = false;
                // Try again - unlimited retries
                this.handleWebSocketClose();
            }
        }, delay);
    }

    /**
     * Create RTCPeerConnection
     */
    createPeerConnection() {
        // console.log(`[VideoConference][${this.role}] Creating peer connection...`);

        this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal({
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            } else {
                // End-of-candidates marker — remote peer must know gathering is done
                this.sendSignal({
                    type: 'ice-candidate',
                    candidate: null
                });
            }
        };

        // Handle remote tracks with reliability improvements
        this.peerConnection.ontrack = (event) => {
            // console.log(`[VideoConference][${this.role}] Received remote track:`, event.track.kind);

            if (event.streams && event.streams[0]) {
                const newStream = event.streams[0];

                // Check if this is truly a new stream or just an update
                const isNewStream = !this.remoteStream ||
                    this.remoteStream.id !== newStream.id ||
                    this.remoteStreamId !== newStream.id;

                this.remoteStream = newStream;
                this.remoteStreamId = newStream.id;
                // console.log(`[VideoConference][${this.role}] Remote stream ${isNewStream ? 'set' : 'updated'} with ${newStream.getTracks().length} tracks (ID: ${newStream.id})`);

                // Always trigger callback to ensure video element gets updated
                if (this.onRemoteStream) {
                    this.onRemoteStream(this.remoteStream);
                }

                // Monitor track state changes for debugging
                event.track.onended = () => {
                    console.warn(`[VideoConference][${this.role}] Remote ${event.track.kind} track ended`);
                    // Try to restart ICE if video track ends unexpectedly
                    if (event.track.kind === 'video' && this.sessionActive) {
                        // console.log(`[VideoConference][${this.role}] Attempting ICE restart due to track end`);
                        setTimeout(() => this.restartIce(), 1000);
                    }
                };

                event.track.onmute = () => {
                    console.warn(`[VideoConference][${this.role}] Remote ${event.track.kind} track muted`);
                };

                event.track.onunmute = () => {
                    // console.log(`[VideoConference][${this.role}] Remote ${event.track.kind} track unmuted`);
                };
            }
        };

        // Handle connection state changes with enhanced recovery
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            // console.log(`[VideoConference][${this.role}] Connection state:`, state);

            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(state);
            }

            // Handle connection failures and disconnections
            if (state === 'disconnected') {
                console.warn(`[VideoConference][${this.role}] Connection disconnected, will attempt ICE restart if not recovered in 5s`);

                // Wait 5 seconds before restarting to allow automatic recovery
                this.disconnectTimer = setTimeout(() => {
                    if (this.peerConnection?.connectionState === 'disconnected') {
                        // console.log(`[VideoConference][${this.role}] Still disconnected after 5s, attempting ICE restart...`);
                        this.restartIce();
                    }
                }, 5000);
            } else if (state === 'failed') {
                console.error(`[VideoConference][${this.role}] Connection failed, attempting immediate ICE restart...`);
                // Clear any pending disconnect timer
                if (this.disconnectTimer) {
                    clearTimeout(this.disconnectTimer);
                    this.disconnectTimer = null;
                }
                // Immediate restart on failure
                setTimeout(() => {
                    this.restartIce();
                }, 500);
            } else if (state === 'connected') {
                // Clear disconnect timer if we reconnected
                if (this.disconnectTimer) {
                    clearTimeout(this.disconnectTimer);
                    this.disconnectTimer = null;
                }
                // Reset ICE restart attempts counter on successful connection
                this.iceRestartAttempts = 0;
                // console.log(`[VideoConference][${this.role}] Connection established successfully`);
            }
        };

        // Handle ICE connection state changes
        this.peerConnection.oniceconnectionstatechange = () => {
            const iceState = this.peerConnection.iceConnectionState;
            // console.log(`[VideoConference][${this.role}] ICE connection state:`, iceState);

            // Log but don't automatically restart - let connectionStateChange handle it
            if (iceState === 'failed') {
                console.warn(`[VideoConference][${this.role}] ICE connection failed (waiting for connectionState handling)`);
            }
        };

        // Handle signaling state changes
        this.peerConnection.onsignalingstatechange = () => {
            // console.log(`[VideoConference][${this.role}] Signaling state:`, this.peerConnection.signalingState);
        };

        // Handle ICE gathering state changes
        this.peerConnection.onicegatheringstatechange = () => {
            // console.log(`[VideoConference][${this.role}] ICE gathering state:`, this.peerConnection.iceGatheringState);
        };
    }

    /**
     * Add local tracks to peer connection
     */
    addLocalTracksToConnection() {
        if (!this.localStream || !this.peerConnection) {
            console.error(`[VideoConference][${this.role}] Cannot add tracks: missing stream or connection`);
            return;
        }

        this.localStream.getTracks().forEach(track => {
            // console.log(`[VideoConference][${this.role}] Adding local track:`, track.kind);
            this.peerConnection.addTrack(track, this.localStream);
        });
    }

    /**
     * Announce presence to signaling server
     */
    announcePresence(userData = null) {
        const joinMessage = {
            type: 'join', token: sessionStorage.getItem('lss_access_token'),
            role: this.role,
            session_id: this.sessionId
        };

        // Include user data if provided (for observer)
        if (userData) {
            joinMessage.user_data = userData;
        }

        this.sendSignal(joinMessage);
        // console.log(`[VideoConference][${this.role}] Announced presence`);
    }

    /**
     * Handle incoming signaling messages
     */
    async handleSignalingMessage(message) {
        // console.log(`[VideoConference][${this.role}] Received signal:`, message.type);

        try {
            switch (message.type) {
                case 'offer':
                    await this.handleOffer(message.offer);
                    break;

                case 'answer':
                    await this.handleAnswer(message.answer);
                    break;

                case 'ice-candidate':
                    await this.handleIceCandidate(message.candidate);
                    break;

                case 'peer_ready':
                    // Trainer/Coach creates offer when learner/client is ready
                    if (this.role === 'trainer' || this.role === 'coach') {
                        const connState = this.peerConnection?.connectionState;
                        // Allow (re)offer if: never offered yet, OR connection is dead (rejoin scenario)
                        const needsFreshOffer = !this.hasCreatedOffer ||
                            connState === 'closed' || connState === 'failed' ||
                            connState === 'disconnected';
                        if (needsFreshOffer) {
                            // Rebuild peer connection if it is in a terminal state
                            if (this.peerConnection && (connState === 'closed' || connState === 'failed')) {
                                console.log(`[VideoConference][${this.role}] Rebuilding peer connection for rejoin...`);
                                this.peerConnection.close();
                                this.peerConnection = null;
                                this.createPeerConnection();
                                if (this.localStream) this.addLocalTracksToConnection();
                            }
                            // Reset offer + ICE state for a clean slate
                            this.hasCreatedOffer = false;
                            this.pendingPeerReady = false;
                            this.pendingIceCandidates = [];
                            if (this.onParticipantJoinRequest && !message.already_admitted) {
                                // Admit/reject flow — show modal to instructor
                                this.pendingPeerReady = true;
                                this.onParticipantJoinRequest(message);
                            } else {
                                console.log(`[VideoConference][${this.role}] Creating offer as initiator...`);
                                await this.createOffer();
                            }
                        }
                    }
                    break;

                case 'observer_joined':
                    // Observer joined - notify trainer with observer data
                    console.log(`[VideoConference][${this.role}] Observer joined message received:`, message);
                    if (this.onObserverJoined) {
                        console.log(`[VideoConference][${this.role}] Calling onObserverJoined callback with data:`, message.observer_data);
                        this.onObserverJoined(message.observer_data || null);
                    } else {
                        console.warn(`[VideoConference][${this.role}] onObserverJoined callback not set!`);
                    }
                    break;

                case 'observer_left':
                    // Observer left - notify trainer
                    if (this.onObserverLeft) {
                        this.onObserverLeft();
                    }
                    break;

                case 'screen_share_stopped':
                    // Trainer stopped screen share - notify observer to disconnect
                    if (this.role === 'observer' && this.onScreenShareStopped) {
                        this.onScreenShareStopped();
                    }
                    break;

                case 'trainer_disconnected':
                    // Trainer disconnected - notify observer to disconnect
                    if (this.role === 'observer' && this.onScreenShareStopped) {
                        console.log('[VideoConference][observer] Trainer disconnected, closing observer session');
                        this.onScreenShareStopped(); // Reuse same callback
                    }
                    break;

                case 'peer_disconnected':
                    // Observers ignore peer disconnection
                    if (this.role === 'observer') {
                        console.log('[VideoConference][observer] Peer disconnected, but observer continues watching');
                        break;
                    }
                    // Notify the session page (clears remote stream UI, etc.)
                    if (this.onPeerDisconnected) {
                        this.onPeerDisconnected(message.role);
                    }
                    // Trainer/Coach: reset offer state and rebuild peer connection so the
                    // next peer_ready (learner/client rejoin) creates a fresh offer without
                    // requiring a page refresh.
                    if (this.role === 'trainer' || this.role === 'coach') {
                        console.log(`[VideoConference][${this.role}] Peer disconnected — resetting for potential rejoin...`);
                        this.hasCreatedOffer = false;
                        this.pendingPeerReady = false;
                        this.pendingIceCandidates = [];
                        if (this.peerConnection) {
                            this.peerConnection.close();
                            this.peerConnection = null;
                        }
                        this.createPeerConnection();
                        if (this.localStream) this.addLocalTracksToConnection();
                    }
                    break;

                case 'message':
                    if (this.onMessage) {
                        this.onMessage(message);
                    }
                    break;

                case 'prompt_meter':
                    if (this.onPromptMeterUpdate) {
                        this.onPromptMeterUpdate(message.value);
                    }
                    break;

                case 'reinforcement_meter':
                    if (this.onReinforcementMeterUpdate) {
                        this.onReinforcementMeterUpdate(message.value);
                    }
                    break;

                case 'reinforcement_visibility':
                    if (this.onReinforcementVisibilityUpdate) {
                        this.onReinforcementVisibilityUpdate(message.visible !== false);
                    }
                    break;

                case 'prompt_text':
                    if (this.onPromptText) {
                        this.onPromptText({ text: message.text });
                    }
                    break;

                case 'freeze':
                    if (this.onFreeze) {
                        this.onFreeze(message);
                    }
                    break;

                case 'ping':
                    this.sendSignal({ type: 'pong', timestamp: new Date().toISOString() });
                    break;

                case 'pong':
                    // Heartbeat response received
                    this.handlePong();
                    break;

                default:
                // console.log(`[VideoConference][${this.role}] Unknown message type:`, message.type);
            }
        } catch (error) {
            console.error(`[VideoConference][${this.role}] Error handling signal:`, error);
        }
    }

    /**
     * Admit a pending learner/client after instructor approves the join request.
     * Call this when instructor clicks "Admit" in the admission modal.
     */
    async admitParticipant() {
        this.pendingPeerReady = false;
        await this.createOffer();
    }

    /**
     * Create and send offer (Trainer initiates)
     * UPDATED to support targeted offers
     * @param {string} targetRole - Optional target role to send offer to (e.g., 'observer')
     */
    async createOffer(targetRole = null) {
        if (!this.peerConnection) {
            console.error(`[VideoConference][${this.role}] Cannot create offer: peer connection not initialized`);
            return;
        }

        if (this.peerConnection.signalingState !== 'stable') {
            console.warn(
                `[VideoConference][${this.role}] Cannot create offer in state:`,
                this.peerConnection.signalingState,
                '- queuing for next stable state'
            );
            // Schedule offer creation for when state becomes stable
            const checkStateInterval = setInterval(() => {
                if (this.peerConnection && this.peerConnection.signalingState === 'stable') {
                    clearInterval(checkStateInterval);
                    this.createOffer(targetRole);
                }
            }, 500);
            return;
        }

        if (this.hasCreatedOffer && !targetRole) {
            console.warn(`[VideoConference][${this.role}] Offer already created, skipping`);
            return;
        }

        try {
            console.log(`[VideoConference][${this.role}] Creating offer${targetRole ? ' for ' + targetRole : ''}...`);

            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
                iceRestart: targetRole ? true : false  // Force fresh ICE candidates for new participant
            });

            await this.peerConnection.setLocalDescription(offer);
            if (!targetRole) {
                this.hasCreatedOffer = true;
            }

            // Send offer with specific target if provided
            this.sendSignal({
                type: 'offer',
                offer: offer,
                ...(targetRole && { target: targetRole })  // Add target only if specified
            });

            console.log(`[VideoConference][${this.role}] Offer sent${targetRole ? ' to ' + targetRole : ''}`);
        } catch (error) {
            console.error(`[VideoConference][${this.role}] Error creating offer:`, error);
            this.hasCreatedOffer = false;
        }
    }

    /**
     * Handle incoming offer (Learner/Observer receives)
     */
    async handleOffer(offer) {
        if (this.peerConnection.signalingState !== 'stable' && this.peerConnection.signalingState !== 'have-local-offer') {
            console.warn(`[VideoConference][${this.role}] Cannot handle offer in state:`, this.peerConnection.signalingState);
            return;
        }

        try {
            // console.log(`[VideoConference][${this.role}] Handling offer...`);

            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            // console.log(`[VideoConference][${this.role}] Remote description set`);

            // If observer, set transceivers to recvonly (no sending)
            if (this.isObserver) {
                console.log(`[VideoConference][${this.role}] Setting transceivers to recvonly for observer`);
                this.peerConnection.getTransceivers().forEach(transceiver => {
                    if (transceiver.direction !== 'recvonly') {
                        transceiver.direction = 'recvonly';
                    }
                });
            }

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.sendSignal({
                type: 'answer',
                answer: answer
            });

            // console.log(`[VideoConference][${this.role}] Answer sent`);

            // Process pending ICE candidates
            await this.processPendingIceCandidates();
        } catch (error) {
            console.error(`[VideoConference][${this.role}] Error handling offer:`, error);
        }
    }

    /**
     * Handle incoming answer (Trainer receives)
     */
    async handleAnswer(answer) {
        if (this.peerConnection.signalingState !== 'have-local-offer') {
            console.warn(`[VideoConference][${this.role}] Unexpected answer in state:`, this.peerConnection.signalingState);
            return;
        }

        try {
            // console.log(`[VideoConference][${this.role}] Handling answer...`);

            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            // console.log(`[VideoConference][${this.role}] Remote answer set`);

            // Process pending ICE candidates
            await this.processPendingIceCandidates();
        } catch (error) {
            console.error(`[VideoConference][${this.role}] Error handling answer:`, error);
            // Reset offer flag to allow retry
            this.hasCreatedOffer = false;
        }
    }

    /**
     * Handle incoming ICE candidate
     */
    async handleIceCandidate(candidate) {
        if (!candidate) {
            return; // End-of-candidates marker, safe to ignore
        }

        if (!this.peerConnection.remoteDescription) {
            // Queue candidate until remote description is set
            this.pendingIceCandidates.push(candidate);
            // console.log(`[VideoConference][${this.role}] ICE candidate queued (${this.pendingIceCandidates.length} total)`);
            return;
        }

        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            // console.log(`[VideoConference][${this.role}] ICE candidate added`);
        } catch (error) {
            console.error(`[VideoConference][${this.role}] Error adding ICE candidate:`, error);
        }
    }

    /**
     * Process pending ICE candidates
     */
    async processPendingIceCandidates() {
        if (this.pendingIceCandidates.length === 0) return;

        // console.log(`[VideoConference][${this.role}] Processing ${this.pendingIceCandidates.length} pending ICE candidates...`);

        for (const candidate of this.pendingIceCandidates) {
            try {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error(`[VideoConference][${this.role}] Error adding pending candidate:`, error);
            }
        }

        this.pendingIceCandidates = [];
        // console.log(`[VideoConference][${this.role}] Pending ICE candidates processed`);
    }

    /**
     * Restart ICE connection with attempt limiting
     */
    async restartIce() {
        if (!this.peerConnection || !this.sessionActive) return;

        if (!this.peerConnection.remoteDescription) {
            console.warn(`[VideoConference][${this.role}] Skipping ICE restart: no remote description yet`);
            return;
        }

        // Check attempt limit
        if (this.iceRestartAttempts >= this.maxIceRestartAttempts) {
            console.error(`[VideoConference][${this.role}] Max ICE restart attempts (${this.maxIceRestartAttempts}) reached`);
            // After max attempts, try complete peer connection rebuild
            if (this.onError) {
                this.onError(new Error('Connection quality degraded - attempting full reconnection'));
            }
            return;
        }

        // Check if signaling state allows offer creation
        if (this.peerConnection.signalingState !== 'stable') {
            console.warn(
                `[VideoConference][${this.role}] Cannot restart ICE in signaling state:`,
                this.peerConnection.signalingState,
                '- will retry in 2s'
            );
            // Retry after short delay if signaling state is unstable
            setTimeout(() => this.restartIce(), 2000);
            return;
        }

        try {
            this.iceRestartAttempts++;
            // console.log(`[VideoConference][${this.role}] Restarting ICE (attempt ${this.iceRestartAttempts}/${this.maxIceRestartAttempts})...`);

            const offer = await this.peerConnection.createOffer({ iceRestart: true });
            await this.peerConnection.setLocalDescription(offer);

            this.sendSignal({
                type: 'offer',
                offer: offer
            });

            // console.log(`[VideoConference][${this.role}] ICE restart offer sent successfully`);
        } catch (error) {
            console.error(`[VideoConference][${this.role}] ICE restart failed:`, error);
            // Retry after delay on failure
            if (this.iceRestartAttempts < this.maxIceRestartAttempts) {
                setTimeout(() => this.restartIce(), 3000);
            }
        }
    }

    /**
     * Send signal via WebSocket
     */
    sendSignal(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Add target field if specified (for routing to specific peer)
            if (this.targetRole) {
                message.target = this.targetRole;
            }
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn(`[VideoConference][${this.role}] WebSocket not ready, cannot send:`, message.type);
        }
    }

    /**
     * Toggle microphone on/off
     */
    toggleMicrophone() {
        if (!this.localStream) return false;

        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            // console.log(`[VideoConference][${this.role}] Microphone ${audioTrack.enabled ? 'enabled' : 'disabled'}`);
            return audioTrack.enabled;
        }
        return false;
    }

    /**
     * Toggle camera on/off
     */
    toggleCamera() {
        if (!this.localStream) return false;

        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            // console.log(`[VideoConference][${this.role}] Camera ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
            return videoTrack.enabled;
        }
        return false;
    }

    /**
     * Check if microphone is enabled
     */
    isMicrophoneEnabled() {
        if (!this.localStream) return false;
        const audioTrack = this.localStream.getAudioTracks()[0];
        return audioTrack ? audioTrack.enabled : false;
    }

    /**
     * Check if camera is enabled
     */
    isCameraEnabled() {
        if (!this.localStream) return false;
        const videoTrack = this.localStream.getVideoTracks()[0];
        return videoTrack ? videoTrack.enabled : false;
    }

    /**
     * Send prompt meter value to learner
     */
    sendPromptMeter(value) {
        // console.log(`[VideoConference][${this.role}] Sending prompt meter:`, value);
        this.sendSignal({
            type: 'prompt_meter',
            value: value
        });
    }

    /**
     * Send reinforcement meter value to learner
     */
    sendReinforcementMeter(value) {
        // console.log(`[VideoConference][${this.role}] Sending reinforcement meter:`, value);
        this.sendSignal({
            type: 'reinforcement_meter',
            value: value
        });
    }

    /**
     * Toggle reinforcement meter visibility on learner page
     */
    sendReinforcementVisibility(isVisible) {
        this.sendSignal({
            type: 'reinforcement_visibility',
            visible: !!isVisible
        });
    }

    /**
     * Send chat message to other participant
     */
    sendMessage(message, senderRole) {
        // console.log(`[VideoConference][${this.role}] Sending message:`, message);
        this.sendSignal({
            type: 'message',
            text: message,
            sender: senderRole,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Send prompt text to learner (for prompter line)
     */
    sendPrompt(promptText) {
        // console.log(`[VideoConference][${this.role}] Sending prompt:`, promptText);
        this.sendSignal({
            type: 'prompt_text',
            text: promptText
        });
    }

    /**
     * Get connection statistics
     */
    async getStats() {
        if (!this.peerConnection) return null;

        try {
            const stats = await this.peerConnection.getStats();
            return stats;
        } catch (error) {
            console.error(`[VideoConference][${this.role}] Error getting stats:`, error);
            return null;
        }
    }

    /**
     * Start WebSocket heartbeat to detect connection issues
     */
    startHeartbeat() {
        // Clear existing timers
        this.stopHeartbeat();

        // Send ping every 30 seconds
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.sendSignal({ type: 'ping' });

                // Set timeout for pong response
                this.heartbeatTimeout = setTimeout(() => {
                    console.warn(`[VideoConference][${this.role}] Heartbeat timeout - no pong received`);
                    // WebSocket appears dead, close it to trigger reconnection
                    if (this.ws) {
                        this.ws.close();
                    }
                }, 10000); // Wait 10s for pong
            }
        }, 30000);
    }

    /**
     * Stop WebSocket heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }

    /**
     * Handle pong response from server
     */
    handlePong() {
        // Clear the timeout since we received pong
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }

    /**
     * Start connection quality monitoring
     */
    startConnectionMonitoring() {
        // Stop existing monitoring
        this.stopConnectionMonitoring();

        // Check connection quality every 2 seconds
        this.connectionCheckInterval = setInterval(async () => {
            if (!this.peerConnection) return;

            const connectionState = this.peerConnection.connectionState;
            const iceState = this.peerConnection.iceConnectionState;

            let quality = 'unknown';

            // Determine quality based on connection states
            if (connectionState === 'connected' && iceState === 'connected') {
                // Get detailed stats for bandwidth/packet loss analysis
                const stats = await this.getConnectionQualityFromStats();
                quality = stats.quality;
            } else if (connectionState === 'connecting' || iceState === 'checking') {
                quality = 'connecting';
            } else if (connectionState === 'disconnected' || iceState === 'disconnected') {
                quality = 'poor';
            } else if (connectionState === 'failed' || iceState === 'failed') {
                quality = 'failed';
            }

            // Update quality if changed
            if (quality !== this.connectionQuality) {
                this.connectionQuality = quality;
                // console.log(`[VideoConference][${this.role}] Connection quality: ${quality}`);

                if (this.onConnectionQualityChange) {
                    this.onConnectionQualityChange(quality);
                }
            }
        }, 2000);

        // Monitor detailed stats every 5 seconds
        this.statsCheckInterval = setInterval(async () => {
            await this.logConnectionStats();
        }, 5000);
    }

    /**
     * Stop connection quality monitoring
     */
    stopConnectionMonitoring() {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
        if (this.statsCheckInterval) {
            clearInterval(this.statsCheckInterval);
            this.statsCheckInterval = null;
        }
    }

    /**
     * Get connection quality from WebRTC stats
     */
    async getConnectionQualityFromStats() {
        const stats = await this.getStats();
        if (!stats) return { quality: 'unknown', details: {} };

        let packetsLost = 0;
        let packetsReceived = 0;
        let bytesReceived = 0;
        let bytesSent = 0;
        let currentRoundTripTime = 0;

        stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
                packetsLost += report.packetsLost || 0;
                packetsReceived += report.packetsReceived || 0;
                bytesReceived += report.bytesReceived || 0;
            }
            if (report.type === 'outbound-rtp' && report.kind === 'video') {
                bytesSent += report.bytesSent || 0;
            }
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                currentRoundTripTime = report.currentRoundTripTime || 0;
            }
        });

        const packetLossRate = packetsReceived > 0 ? packetsLost / (packetsReceived + packetsLost) : 0;
        const rttMs = currentRoundTripTime * 1000;

        // Determine quality
        let quality = 'excellent';
        if (packetLossRate > 0.1 || rttMs > 300) {
            quality = 'poor';
        } else if (packetLossRate > 0.05 || rttMs > 200) {
            quality = 'fair';
        } else if (packetLossRate > 0.02 || rttMs > 100) {
            quality = 'good';
        }

        return {
            quality,
            details: {
                packetsLost,
                packetsReceived,
                packetLossRate: (packetLossRate * 100).toFixed(2) + '%',
                bytesReceived,
                bytesSent,
                rttMs: rttMs.toFixed(0)
            }
        };
    }

    /**
     * Log connection statistics for debugging
     */
    async logConnectionStats() {
        if (!this.peerConnection) return;

        const qualityData = await this.getConnectionQualityFromStats();

        if (qualityData.details.packetsReceived > 0) {
            // console.log(
            //     `[VideoConference][${this.role}] Stats:`,
            //     `Quality=${qualityData.quality}`,
            //     `Loss=${qualityData.details.packetLossRate}`,
            //     `RTT=${qualityData.details.rttMs}ms`,
            //     `Recv=${(qualityData.details.bytesReceived / 1024).toFixed(0)}KB`,
            //     `Sent=${(qualityData.details.bytesSent / 1024).toFixed(0)}KB`
            // );
        }
    }

    async diagnoseTurnConnectivity() {
        console.log('[VideoConference] Diagnosing TURN connectivity for 103.192.199.59...');
        const testPc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        const candidates = [];

        testPc.onicecandidate = (e) => {
            if (e.candidate) {
                candidates.push(e.candidate.type);
                console.log(`[TURN Diag] Candidate: type=${e.candidate.type} proto=${e.candidate.protocol}`);
            } else {
                const hasRelay = candidates.includes('relay');
                console.log(`[TURN Diag] Done. Has relay: ${hasRelay}. Types: ${[...new Set(candidates)].join(', ')}`);
                if (!hasRelay) {
                    console.error('[TURN Diag] ❌ TURN UNREACHABLE on 103.192.199.59. Check: 1) EC2 security group UDP/TCP 3478 open, 2) coturn running, 3) credentials correct, 4) UDP relay ports 49152-65535 open');
                } else {
                    console.log('[TURN Diag] ✅ TURN server reachable and working');
                }
                testPc.close();
            }
        };

        testPc.createDataChannel('diag');
        const offer = await testPc.createOffer();
        await testPc.setLocalDescription(offer);
        setTimeout(() => { try { testPc.close(); } catch (e) { } }, 10000);
    }

    /**
     * Cleanup and close connection
     */
    close() {
        // console.log(`[VideoConference][${this.role}] Closing video conference...`);

        // Mark session as inactive to prevent reconnection
        this.sessionActive = false;

        // Stop monitoring
        this.stopConnectionMonitoring();
        this.stopHeartbeat();

        // Clear disconnect timer
        if (this.disconnectTimer) {
            clearTimeout(this.disconnectTimer);
            this.disconnectTimer = null;
        }

        // Stop local media tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                // console.log(`[VideoConference][${this.role}] Stopped ${track.kind} track`);
            });
            this.localStream = null;
        }

        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        // Close WebSocket
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        // Reset state
        this.isInitialized = false;
        this.hasCreatedOffer = false;
        this.pendingIceCandidates = [];
        this.remoteStream = null;
        this.remoteStreamId = null;
        this.reconnectAttempts = 0;
        this.iceRestartAttempts = 0;
        this.connectionQuality = 'unknown';

        // console.log(`[VideoConference][${this.role}] Video conference closed`);
    }
}

export default VideoConferenceService;
