/**
 * Simple WebRTC Service for HurshBin Training Sessions
 * Handles peer-to-peer video/audio connection between trainer and learner
 */

const ICE_SERVERS = {
  iceServers: [
    // Google STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Free TURN servers for NAT traversal
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

class SimpleWebRTC {
  constructor(wsUrl, sessionId, role) {
    this.wsUrl = wsUrl;
    this.sessionId = sessionId;
    this.role = role; // 'trainer' or 'learner'
    this.ws = null;
    this.pc = null; // PeerConnection
    this.localStream = null;
    this.remoteStream = null;

    // Callbacks
    this.onRemoteStream = null;
    this.onConnectionChange = null;
    this.onError = null;
    this.onMessage = null;
    this.onPromptMeterUpdate = null;
    this.onReinforcementMeterUpdate = null;
    this.onNotesUpdate = null;

    // State
    this.isInitialized = false;
    this.pendingCandidates = [];
    this.offerCreated = false; // Flag to prevent multiple offers
  }

  /**
   * Initialize WebRTC connection
   * Gets local media and sets up WebSocket signaling
   */
  async initialize() {
    try {
      console.log(`[SimpleWebRTC][${this.role}] Initializing...`);

      // 1. Get local media (camera + mic)
      this.localStream = await this.getLocalMedia();
      console.log(`[SimpleWebRTC][${this.role}] Got local stream:`, {
        video: this.localStream.getVideoTracks().length,
        audio: this.localStream.getAudioTracks().length
      });

      // 2. Setup WebSocket for signaling
      await this.setupWebSocket();

      // 3. Create peer connection
      this.createPeerConnection();

      // 4. Add local tracks to peer connection
      this.localStream.getTracks().forEach(track => {
        console.log(`[SimpleWebRTC][${this.role}] Adding track:`, track.kind);
        this.pc.addTrack(track, this.localStream);
      });

      this.isInitialized = true;
      console.log(`[SimpleWebRTC][${this.role}] Initialization complete`);

      return this.localStream;
    } catch (error) {
      console.error(`[SimpleWebRTC][${this.role}] Initialization error:`, error);
      if (this.onError) this.onError(error);
      throw error;
    }
  }

  /**
   * Get user media (camera + microphone)
   */
  async getLocalMedia() {
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          'Camera/microphone access not available. ' +
          'This usually happens when accessing via HTTP from a non-localhost address. ' +
          'Please use HTTPS or access from localhost.'
        );
      }

      console.log(`[SimpleWebRTC][${this.role}] Requesting local media (video + audio)...`);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log(`[SimpleWebRTC][${this.role}] Got local stream with video and audio`);
      return stream;
    } catch (error) {
      console.error(`[SimpleWebRTC][${this.role}] Media access error:`, error);

      // If getUserMedia not available, throw specific error
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          'Camera/microphone access requires HTTPS. ' +
          'Please use: https://localhost:5173 or enable HTTPS for local network access.'
        );
      }

      // Try audio-only fallback
      try {
        console.log(`[SimpleWebRTC][${this.role}] Video+audio failed, trying audio-only fallback...`);
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        console.log(`[SimpleWebRTC][${this.role}] Got audio-only stream as fallback`);
        return audioStream;
      } catch (audioError) {
        console.error(`[SimpleWebRTC][${this.role}] Audio-only fallback failed:`, audioError);

        // Last resort: try basic audio without constraints
        try {
          console.log(`[SimpleWebRTC][${this.role}] Trying basic audio without constraints...`);
          const basicAudio = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log(`[SimpleWebRTC][${this.role}] Got basic audio stream`);
          return basicAudio;
        } catch (basicError) {
          console.error(`[SimpleWebRTC][${this.role}] All audio attempts failed:`, basicError);
          throw new Error('Failed to access microphone. Please check permissions: ' + basicError.message);
        }
      }
    }
  }

  /**
   * Setup WebSocket connection for signaling
   */
  setupWebSocket() {
    return new Promise((resolve, reject) => {
      const wsUrl = this.wsUrl
        .replace(/^https:/, 'wss:')
        .replace(/^http:/, 'ws:');
      this.ws = new WebSocket(`${wsUrl}/ws/rtc/${this.sessionId}`);

      this.ws.onopen = () => {
        console.log(`[SimpleWebRTC][${this.role}] WebSocket connected`);
        // Announce ourselves
        this.send({
          type: 'join',
          role: this.role,
          session_id: this.sessionId
        });
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleSignalingMessage(JSON.parse(event.data));
      };

      this.ws.onerror = (error) => {
        console.error(`[SimpleWebRTC][${this.role}] WebSocket error:`, error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log(`[SimpleWebRTC][${this.role}] WebSocket closed`);
      };
    });
  }

  /**
   * Create RTCPeerConnection
   */
  createPeerConnection() {
    this.pc = new RTCPeerConnection(ICE_SERVERS);

    // Handle ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[SimpleWebRTC][${this.role}] Sending ICE candidate:`, {
          type: event.candidate.type,
          protocol: event.candidate.protocol,
          address: event.candidate.address
        });
        this.send({
          type: 'ice-candidate',
          candidate: event.candidate
        });
      } else {
        console.log(`[SimpleWebRTC][${this.role}] ICE gathering complete`);
      }
    };

    // Handle ICE gathering state
    this.pc.onicegatheringstatechange = () => {
      console.log(`[SimpleWebRTC][${this.role}] ICE gathering state:`, this.pc.iceGatheringState);
    };

    // Handle remote track
    this.pc.ontrack = (event) => {
      console.log(`[SimpleWebRTC][${this.role}] Received remote track:`, event.track.kind, 'readyState:', event.track.readyState);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        console.log(`[SimpleWebRTC][${this.role}] Remote stream tracks:`,
          event.streams[0].getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState }))
        );
        if (this.onRemoteStream) {
          this.onRemoteStream(this.remoteStream);
        }
      }
    };

    // Handle connection state changes
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      console.log(`[SimpleWebRTC][${this.role}] Connection state:`, state);

      if (state === 'failed') {
        console.error(`[SimpleWebRTC][${this.role}] Connection failed. ICE state: ${this.pc.iceConnectionState}`);
        // You could implement reconnection logic here
      }

      if (this.onConnectionChange) {
        this.onConnectionChange(state);
      }
    };

    // Handle ICE connection state
    this.pc.oniceconnectionstatechange = () => {
      const iceState = this.pc.iceConnectionState;
      console.log(`[SimpleWebRTC][${this.role}] ICE connection state:`, iceState);

      if (iceState === 'failed') {
        console.error(`[SimpleWebRTC][${this.role}] ICE connection failed. Connection state: ${this.pc.connectionState}`);
        console.log(`[SimpleWebRTC][${this.role}] Local description:`, this.pc.localDescription?.type);
        console.log(`[SimpleWebRTC][${this.role}] Remote description:`, this.pc.remoteDescription?.type);
      } else if (iceState === 'disconnected') {
        console.warn(`[SimpleWebRTC][${this.role}] ICE connection disconnected, waiting for reconnection...`);
      } else if (iceState === 'connected' || iceState === 'completed') {
        console.log(`[SimpleWebRTC][${this.role}] ICE connection established successfully!`);
      }
    };

    // Handle signaling state changes
    this.pc.onsignalingstatechange = () => {
      console.log(`[SimpleWebRTC][${this.role}] Signaling state:`, this.pc.signalingState);
    };
  }

  /**
   * Handle incoming signaling messages
   */
  async handleSignalingMessage(message) {
    console.log(`[SimpleWebRTC][${this.role}] Received:`, message.type);

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
          if (this.role === 'trainer' && !this.offerCreated) {
            console.log(`[SimpleWebRTC][${this.role}] Peer ready signal received, creating offer...`);
            await this.createOffer();
          } else if (this.role === 'trainer' && this.offerCreated) {
            console.log(`[SimpleWebRTC][${this.role}] Offer already created, ignoring peer_ready`);
          }
          break;

        case 'prompt_meter':
          if (this.role === 'learner' && this.onPromptMeterUpdate) {
            this.onPromptMeterUpdate(message.value);
          }
          break;

        case 'reinforcement_meter':
          if (this.role === 'learner' && this.onReinforcementMeterUpdate) {
            this.onReinforcementMeterUpdate(message.value);
          }
          break;

        case 'message':
          if (this.onMessage) {
            this.onMessage(message);
          }
          break;

        case 'notes_update':
          if (this.role === 'learner' && this.onNotesUpdate) {
            this.onNotesUpdate(message.notes);
          }
          break;

        case 'ping':
          // Respond to server heartbeat ping with pong
          this.send({
            type: 'pong',
            timestamp: new Date().toISOString()
          });
          console.debug(`[SimpleWebRTC][${this.role}] Responded to ping with pong`);
          break;

        default:
          console.log(`[SimpleWebRTC][${this.role}] Unknown message type:`, message.type);
      }
    } catch (error) {
      console.error(`[SimpleWebRTC][${this.role}] Error handling message:`, error);
    }
  }

  /**
   * Create and send offer (trainer initiates)
   */
  async createOffer() {
    try {
      // Check if we can create an offer
      if (this.pc.signalingState !== 'stable') {
        console.warn(`[SimpleWebRTC][${this.role}] Cannot create offer in state: ${this.pc.signalingState}`);
        return;
      }

      if (this.offerCreated) {
        console.warn(`[SimpleWebRTC][${this.role}] Offer already created, skipping`);
        return;
      }

      console.log(`[SimpleWebRTC][${this.role}] Creating offer...`);
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      this.offerCreated = true; // Mark offer as created

      console.log(`[SimpleWebRTC][${this.role}] Local description set, signaling state: ${this.pc.signalingState}`);

      this.send({
        type: 'offer',
        offer: offer
      });

      console.log(`[SimpleWebRTC][${this.role}] Offer sent`);
    } catch (error) {
      console.error(`[SimpleWebRTC][${this.role}] Error creating offer:`, error);
    }
  }

  /**
   * Handle incoming offer (learner receives)
   */
  async handleOffer(offer) {
    try {
      console.log(`[SimpleWebRTC][${this.role}] Handling offer, current signaling state: ${this.pc.signalingState}`);

      // Check if we're in the right state
      if (this.pc.signalingState !== 'stable' && this.pc.signalingState !== 'have-local-offer') {
        console.warn(`[SimpleWebRTC][${this.role}] Cannot handle offer in state: ${this.pc.signalingState}`);
        return;
      }

      await this.pc.setRemoteDescription(offer);
      console.log(`[SimpleWebRTC][${this.role}] Remote description set, signaling state: ${this.pc.signalingState}`);

      // Create answer
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      console.log(`[SimpleWebRTC][${this.role}] Local answer set, signaling state: ${this.pc.signalingState}`);

      this.send({
        type: 'answer',
        answer: answer
      });

      console.log(`[SimpleWebRTC][${this.role}] Answer sent`);

      // Add pending ICE candidates
      for (const candidate of this.pendingCandidates) {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      this.pendingCandidates = [];
    } catch (error) {
      console.error(`[SimpleWebRTC][${this.role}] Error handling offer:`, error);
    }
  }

  /**
   * Handle incoming answer (trainer receives)
   */
  async handleAnswer(answer) {
    try {
      console.log(`[SimpleWebRTC][${this.role}] Handling answer, current signaling state: ${this.pc.signalingState}`);

      // Check if we're expecting an answer
      if (this.pc.signalingState !== 'have-local-offer') {
        console.warn(`[SimpleWebRTC][${this.role}] Received answer but not expecting one. Current state: ${this.pc.signalingState}`);
        return;
      }

      await this.pc.setRemoteDescription(answer);
      console.log(`[SimpleWebRTC][${this.role}] Remote answer set, signaling state: ${this.pc.signalingState}`);

      // Add pending ICE candidates
      for (const candidate of this.pendingCandidates) {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      this.pendingCandidates = [];

      console.log(`[SimpleWebRTC][${this.role}] Answer processed`);
    } catch (error) {
      console.error(`[SimpleWebRTC][${this.role}] Error handling answer:`, error);
    }
  }

  /**
   * Handle incoming ICE candidate
   */
  async handleIceCandidate(candidate) {
    try {
      if (!candidate) {
        console.warn(`[SimpleWebRTC][${this.role}] Received null ICE candidate`);
        return;
      }

      if (!this.pc) {
        console.warn(`[SimpleWebRTC][${this.role}] No peer connection to add ICE candidate`);
        return;
      }

      if (!this.pc.remoteDescription) {
        // Queue candidate until remote description is set
        this.pendingCandidates.push(candidate);
        console.log(`[SimpleWebRTC][${this.role}] ICE candidate queued (${this.pendingCandidates.length} total)`);
        return;
      }

      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log(`[SimpleWebRTC][${this.role}] ICE candidate added:`, {
        type: candidate.type,
        protocol: candidate.protocol
      });
    } catch (error) {
      console.error(`[SimpleWebRTC][${this.role}] Error adding ICE candidate:`, error);
      console.error(`[SimpleWebRTC][${this.role}] Failed candidate details:`, {
        type: candidate?.type,
        protocol: candidate?.protocol,
        address: candidate?.address,
        error: error.message
      });
      console.warn(`[SimpleWebRTC][${this.role}] Continuing despite candidate error (may still establish connection)`);
    }
  }

  /**
   * Send message via WebSocket
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn(`[SimpleWebRTC][${this.role}] WebSocket not ready`);
    }
  }

  /**
   * Toggle microphone on/off
   */
  toggleMic() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log(`[SimpleWebRTC][${this.role}] Mic ${audioTrack.enabled ? 'enabled' : 'disabled'}`);
        return audioTrack.enabled;
      }
    }
    return false;
  }

  /**
   * Toggle camera on/off
   */
  toggleCamera() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        console.log(`[SimpleWebRTC][${this.role}] Camera ${videoTrack.enabled ? 'enabled' : 'disabled'}`);
        return videoTrack.enabled;
      }
    }
    return false;
  }

  /**
   * Get mic status
   */
  isMicEnabled() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      return audioTrack ? audioTrack.enabled : false;
    }
    return false;
  }

  /**
   * Get camera status
   */
  isCameraEnabled() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      return videoTrack ? videoTrack.enabled : false;
    }
    return false;
  }

  /**
   * Send prompt meter value to learner
   */
  sendPromptMeter(value) {
    console.log(`[SimpleWebRTC][${this.role}] Sending prompt meter:`, value);
    this.send({
      type: 'prompt_meter',
      value: value
    });
  }

  /**
   * Send reinforcement meter value to learner
   */
  sendReinforcementMeter(value) {
    console.log(`[SimpleWebRTC][${this.role}] Sending reinforcement meter:`, value);
    this.send({
      type: 'reinforcement_meter',
      value: value
    });
  }

  /**
   * Send chat message to other participant
   */
  sendMessage(message, senderRole) {
    console.log(`[SimpleWebRTC][${this.role}] Sending message:`, message);
    this.send({
      type: 'message',
      text: message,
      sender: senderRole,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send session notes update to learner
   */
  sendNotesUpdate(notes) {
    console.log(`[SimpleWebRTC][${this.role}] Sending notes update:`, notes);
    this.send({
      type: 'notes_update',
      notes: notes
    });
  }

  /**
   * Close connection and cleanup
   */
  close() {
    console.log(`[SimpleWebRTC][${this.role}] Closing connection and revoking media access...`);

    // Stop all local media tracks (camera, microphone, etc.)
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log(`[SimpleWebRTC][${this.role}] Stopped ${track.kind} track`);
      });
      this.localStream = null;
    }

    // Close peer connection
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isInitialized = false;
    console.log(`[SimpleWebRTC][${this.role}] Connection closed and media access revoked`);
  }
}

export default SimpleWebRTC;