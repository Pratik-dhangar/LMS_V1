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
    // Google STUN servers for NAT traversal
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },

    // ✅ Self-hosted TURN server on EC2 (Primary - Most Reliable)
    {
        urls: 'turn:43.204.218.16:3478',
        username: 'hurshbin',
        credential: 'SecureTurnPass2024!',
    },
    {
        urls: 'turn:43.204.218.16:3478?transport=tcp',
        username: 'hurshbin',
        credential: 'SecureTurnPass2024!',
    },

    // Backup: Free TURN servers (Fallback only)
    {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
    }
];

const RTC_CONFIG = {
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
};

class VideoConferenceService {
    constructor(wsUrl, sessionId, role) {
        this.wsUrl = wsUrl;
        this.sessionId = sessionId;
        this.role = role; // 'trainer' or 'learner'

        // WebRTC Components
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;

        // WebSocket for signaling
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        // State management
        this.isInitialized = false;
        this.pendingIceCandidates = [];
        this.hasCreatedOffer = false;

        // Callback functions
        this.onLocalStream = null;
        this.onRemoteStream = null;
        this.onConnectionStateChange = null;
        this.onError = null;
        this.onMessage = null;
        this.onPromptMeterUpdate = null;
        this.onReinforcementMeterUpdate = null;
        this.onPromptText = null;
        this.onFreeze = null;
    }

    /**
     * Initialize the video conference
     * @returns {Promise<MediaStream>} Local media stream
     */
    async initialize() {
        try {
            console.log(`[VideoConference][${this.role}] Initializing video conference...`);

            // Step 1: Get local media (camera + microphone)
            this.localStream = await this.getLocalMedia();

            // Step 2: Set up WebSocket for signaling
            await this.connectWebSocket();

            // Step 3: Create peer connection
            this.createPeerConnection();

            // Step 4: Add local tracks to peer connection
            this.addLocalTracksToConnection();

            // Step 5: Announce presence
            this.announcePresence();

            this.isInitialized = true;
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

    /**
     * Get local media stream (camera + microphone)
     * @returns {Promise<MediaStream>}
     */
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
                console.log(`[VideoConference][${this.role}] Attempting audio-only fallback...`);
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

    /**
     * Connect to WebSocket for signaling
     * @returns {Promise<void>}
     */
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

    /**
     * Handle WebSocket close and attempt reconnection
     */
    handleWebSocketClose() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
            console.log(`[VideoConference][${this.role}] Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);

            setTimeout(() => {
                this.connectWebSocket().catch(error => {
                    console.error(`[VideoConference][${this.role}] Reconnection failed:`, error);
                });
            }, delay);
        } else {
            console.error(`[VideoConference][${this.role}] Max reconnection attempts reached`);
            if (this.onError) {
                this.onError(new Error('WebSocket connection lost'));
            }
        }
    }

    /**
     * Create RTCPeerConnection
     */
    createPeerConnection() {
        console.log(`[VideoConference][${this.role}] Creating peer connection...`);

        this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log(`[VideoConference][${this.role}] New ICE candidate:`, {
                    type: event.candidate.type,
                    protocol: event.candidate.protocol
                });
                this.sendSignal({
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            } else {
                console.log(`[VideoConference][${this.role}] ICE gathering complete`);
            }
        };

        // Handle remote tracks
        this.peerConnection.ontrack = (event) => {
            console.log(`[VideoConference][${this.role}] Received remote track:`, event.track.kind);

            if (event.streams && event.streams[0]) {
                this.remoteStream = event.streams[0];
                console.log(`[VideoConference][${this.role}] Remote stream set with ${event.streams[0].getTracks().length} tracks`);

                if (this.onRemoteStream) {
                    this.onRemoteStream(this.remoteStream);
                }
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log(`[VideoConference][${this.role}] Connection state:`, state);

            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(state);
            }

            // Only restart ICE on 'failed' state, not on 'disconnected' which may be temporary
            if (state === 'failed') {
                console.error(`[VideoConference][${this.role}] Connection failed, attempting restart...`);
                // Add a small delay before restarting to ensure signaling state is stable
                setTimeout(() => {
                    this.restartIce();
                }, 500);
            }
        };

        // Handle ICE connection state changes
        this.peerConnection.oniceconnectionstatechange = () => {
            const iceState = this.peerConnection.iceConnectionState;
            console.log(`[VideoConference][${this.role}] ICE connection state:`, iceState);

            // Log but don't automatically restart - let connectionStateChange handle it
            if (iceState === 'failed') {
                console.warn(`[VideoConference][${this.role}] ICE connection failed (waiting for connectionState handling)`);
            }
        };

        // Handle signaling state changes
        this.peerConnection.onsignalingstatechange = () => {
            console.log(`[VideoConference][${this.role}] Signaling state:`, this.peerConnection.signalingState);
        };

        // Handle ICE gathering state changes
        this.peerConnection.onicegatheringstatechange = () => {
            console.log(`[VideoConference][${this.role}] ICE gathering state:`, this.peerConnection.iceGatheringState);
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
            console.log(`[VideoConference][${this.role}] Adding local track:`, track.kind);
            this.peerConnection.addTrack(track, this.localStream);
        });
    }

    /**
     * Announce presence to signaling server
     */
    announcePresence() {
        this.sendSignal({
            type: 'join',
            role: this.role,
            session_id: this.sessionId
        });
        console.log(`[VideoConference][${this.role}] Announced presence`);
    }

    /**
     * Handle incoming signaling messages
     */
    async handleSignalingMessage(message) {
        console.log(`[VideoConference][${this.role}] Received signal:`, message.type);

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
                    // Trainer creates offer when learner is ready
                    if (this.role === 'trainer' && !this.hasCreatedOffer) {
                        await this.createOffer();
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

                default:
                    console.log(`[VideoConference][${this.role}] Unknown message type:`, message.type);
            }
        } catch (error) {
            console.error(`[VideoConference][${this.role}] Error handling signal:`, error);
        }
    }

    /**
     * Create and send offer (Trainer initiates)
     */
    async createOffer() {
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
                    this.createOffer();
                }
            }, 500);
            return;
        }

        if (this.hasCreatedOffer) {
            console.warn(`[VideoConference][${this.role}] Offer already created, skipping`);
            return;
        }

        try {
            console.log(`[VideoConference][${this.role}] Creating offer...`);

            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });

            await this.peerConnection.setLocalDescription(offer);
            this.hasCreatedOffer = true;

            this.sendSignal({
                type: 'offer',
                offer: offer
            });

            console.log(`[VideoConference][${this.role}] Offer sent`);
        } catch (error) {
            console.error(`[VideoConference][${this.role}] Error creating offer:`, error);
            this.hasCreatedOffer = false;
        }
    }

    /**
     * Handle incoming offer (Learner receives)
     */
    async handleOffer(offer) {
        if (this.peerConnection.signalingState !== 'stable' && this.peerConnection.signalingState !== 'have-local-offer') {
            console.warn(`[VideoConference][${this.role}] Cannot handle offer in state:`, this.peerConnection.signalingState);
            return;
        }

        try {
            console.log(`[VideoConference][${this.role}] Handling offer...`);

            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            console.log(`[VideoConference][${this.role}] Remote description set`);

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.sendSignal({
                type: 'answer',
                answer: answer
            });

            console.log(`[VideoConference][${this.role}] Answer sent`);

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
            console.log(`[VideoConference][${this.role}] Handling answer...`);

            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            console.log(`[VideoConference][${this.role}] Remote answer set`);

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
            console.warn(`[VideoConference][${this.role}] Received null ICE candidate`);
            return;
        }

        if (!this.peerConnection.remoteDescription) {
            // Queue candidate until remote description is set
            this.pendingIceCandidates.push(candidate);
            console.log(`[VideoConference][${this.role}] ICE candidate queued (${this.pendingIceCandidates.length} total)`);
            return;
        }

        try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            console.log(`[VideoConference][${this.role}] ICE candidate added`);
        } catch (error) {
            console.error(`[VideoConference][${this.role}] Error adding ICE candidate:`, error);
        }
    }

    /**
     * Process pending ICE candidates
     */
    async processPendingIceCandidates() {
        if (this.pendingIceCandidates.length === 0) return;

        console.log(`[VideoConference][${this.role}] Processing ${this.pendingIceCandidates.length} pending ICE candidates...`);

        for (const candidate of this.pendingIceCandidates) {
            try {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error(`[VideoConference][${this.role}] Error adding pending candidate:`, error);
            }
        }

        this.pendingIceCandidates = [];
        console.log(`[VideoConference][${this.role}] Pending ICE candidates processed`);
    }

    /**
     * Restart ICE connection
     */
    async restartIce() {
        if (!this.peerConnection) return;

        // Check if signaling state allows offer creation
        if (this.peerConnection.signalingState !== 'stable') {
            console.warn(
                `[VideoConference][${this.role}] Cannot restart ICE in signaling state:`,
                this.peerConnection.signalingState,
                '- skipping restart'
            );
            return;
        }

        try {
            console.log(`[VideoConference][${this.role}] Restarting ICE...`);

            const offer = await this.peerConnection.createOffer({ iceRestart: true });
            await this.peerConnection.setLocalDescription(offer);

            this.sendSignal({
                type: 'offer',
                offer: offer
            });

            console.log(`[VideoConference][${this.role}] ICE restart offer sent`);
        } catch (error) {
            console.error(`[VideoConference][${this.role}] ICE restart failed:`, error);
        }
    }

    /**
     * Send signal via WebSocket
     */
    sendSignal(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
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
            console.log(`[VideoConference][${this.role}] Microphone ${audioTrack.enabled ? 'enabled' : 'disabled'}`);
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
            console.log(`[VideoConference][${this.role}] Camera ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
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
        console.log(`[VideoConference][${this.role}] Sending prompt meter:`, value);
        this.sendSignal({
            type: 'prompt_meter',
            value: value
        });
    }

    /**
     * Send reinforcement meter value to learner
     */
    sendReinforcementMeter(value) {
        console.log(`[VideoConference][${this.role}] Sending reinforcement meter:`, value);
        this.sendSignal({
            type: 'reinforcement_meter',
            value: value
        });
    }

    /**
     * Send chat message to other participant
     */
    sendMessage(message, senderRole) {
        console.log(`[VideoConference][${this.role}] Sending message:`, message);
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
        console.log(`[VideoConference][${this.role}] Sending prompt:`, promptText);
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
     * Cleanup and close connection
     */
    close() {
        console.log(`[VideoConference][${this.role}] Closing video conference...`);

        // Stop local media tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                console.log(`[VideoConference][${this.role}] Stopped ${track.kind} track`);
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

        console.log(`[VideoConference][${this.role}] Video conference closed`);
    }
}

export default VideoConferenceService;
