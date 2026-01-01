// Coach Appointment Session Service - Frontend Integration
// Add this to your sessionService.js or create a new coachSessionService.js

import api from './api';

/**
 * Coach Session API Service
 * Handles one-on-one sessions between coaches and clients
 */
const coachSessionService = {
  /**
   * Create a session from a confirmed appointment
   * @param {number} appointmentId - The appointment ID
   * @param {object} sessionData - Optional session data
   * @returns {Promise} Session details
   */
  async createSession(appointmentId, sessionData = {}) {
    const response = await api.post('/coach-sessions/create', {
      appointment_id: appointmentId,
      duration: sessionData.duration || 60,
      title: sessionData.title,
      description: sessionData.description,
    });
    return response.data;
  },

  /**
   * Get all sessions for the current coach
   * @returns {Promise<Array>} List of sessions
   */
  async getCoachSessions() {
    const response = await api.get('/coach-sessions/coach/sessions');
    return response.data;
  },

  /**
   * Get all sessions for the current client (user)
   * @returns {Promise<Array>} List of sessions
   */
  async getClientSessions() {
    const response = await api.get('/coach-sessions/client/sessions');
    return response.data;
  },

  /**
   * Get session details by ID
   * @param {string} sessionId - The session ID
   * @returns {Promise} Session details
   */
  async getSession(sessionId) {
    const response = await api.get(`/coach-sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Start a scheduled session (coach only)
   * @param {string} sessionId - The session ID
   * @returns {Promise} Updated session
   */
  async startSession(sessionId) {
    const response = await api.post(`/coach-sessions/${sessionId}/start`);
    return response.data;
  },

  /**
   * End an active session (coach only)
   * @param {string} sessionId - The session ID
   * @param {string} notes - Optional session notes
   * @returns {Promise} Result message
   */
  async endSession(sessionId, notes = '') {
    const response = await api.post(`/coach-sessions/${sessionId}/end`, {
      notes,
    });
    return response.data;
  },

  /**
   * Join an active session (client only)
   * @param {string} sessionId - The session ID
   * @returns {Promise} Result message
   */
  async joinSession(sessionId) {
    const response = await api.post(`/coach-sessions/${sessionId}/join`);
    return response.data;
  },

  /**
   * Update a scheduled session (coach only)
   * @param {string} sessionId - The session ID
   * @param {object} updates - Fields to update
   * @returns {Promise} Updated session
   */
  async updateSession(sessionId, updates) {
    const response = await api.put(`/coach-sessions/${sessionId}`, updates);
    return response.data;
  },

  /**
   * Cancel a scheduled session (coach only)
   * @param {string} sessionId - The session ID
   * @returns {Promise} Result message
   */
  async cancelSession(sessionId) {
    const response = await api.delete(`/coach-sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Upload session recording
   * @param {number} sessionId - The session database ID (not session_id string)
   * @param {Blob} recordingBlob - The recorded video blob
   * @param {string} recordingId - Unique recording identifier
   * @param {number} duration - Recording duration in seconds
   * @returns {Promise} Upload result
   */
  async uploadRecording(sessionId, recordingBlob, recordingId, duration) {
    const formData = new FormData();
    formData.append('file', recordingBlob, 'recording.webm');
    formData.append('session_id', sessionId);
    formData.append('recording_id', recordingId);
    formData.append('duration', duration);

    const response = await api.post('/coach-sessions/recordings/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Get recording playback URL
   * @param {number} sessionId - The session database ID
   * @returns {Promise} Playback URL and metadata
   */
  async getRecordingUrl(sessionId) {
    const response = await api.get(`/coach-sessions/${sessionId}/recording-url`);
    return response.data;
  },
};

/**
 * WebSocket Connection Manager for Coach Sessions
 */
class CoachSessionWebSocket {
  constructor(sessionId, role) {
    this.sessionId = sessionId;
    this.role = role; // 'coach' or 'client'
    this.rtcWs = null;
    this.whiteboardWs = null;
    this.listeners = {
      rtc: {},
      whiteboard: {},
    };
  }

  /**
   * Connect to WebRTC signaling server
   */
  connectRTC() {
    const wsUrl = `${import.meta.env.VITE_WS_URL}/ws/rtc/${this.sessionId}`;
    this.rtcWs = new WebSocket(wsUrl);

    this.rtcWs.onopen = () => {
      console.log('[RTC] Connected');
      // Send join message
      this.rtcWs.send(
        JSON.stringify({
          type: 'join',
          role: this.role,
        })
      );
    };

    this.rtcWs.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('[RTC] Received:', message.type);

      // Handle pings
      if (message.type === 'ping') {
        this.rtcWs.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      // Trigger listeners
      this.emit('rtc', message.type, message);
    };

    this.rtcWs.onerror = (error) => {
      console.error('[RTC] Error:', error);
      this.emit('rtc', 'error', error);
    };

    this.rtcWs.onclose = () => {
      console.log('[RTC] Disconnected');
      this.emit('rtc', 'disconnected');
    };
  }

  /**
   * Connect to whiteboard/media server
   */
  connectWhiteboard() {
    const wsUrl = `${import.meta.env.VITE_WS_URL}/ws/whiteboard/${this.sessionId}`;
    this.whiteboardWs = new WebSocket(wsUrl);

    this.whiteboardWs.onopen = () => {
      console.log('[Whiteboard] Connected');
      // Send join message
      this.whiteboardWs.send(
        JSON.stringify({
          type: 'join',
          role: this.role,
        })
      );
    };

    this.whiteboardWs.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('[Whiteboard] Received:', message.type);

      // Handle pings
      if (message.type === 'ping') {
        this.whiteboardWs.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      // Trigger listeners
      this.emit('whiteboard', message.type, message);
    };

    this.whiteboardWs.onerror = (error) => {
      console.error('[Whiteboard] Error:', error);
      this.emit('whiteboard', 'error', error);
    };

    this.whiteboardWs.onclose = () => {
      console.log('[Whiteboard] Disconnected');
      this.emit('whiteboard', 'disconnected');
    };
  }

  /**
   * Send WebRTC signaling message
   */
  sendRTC(message) {
    if (this.rtcWs && this.rtcWs.readyState === WebSocket.OPEN) {
      this.rtcWs.send(JSON.stringify(message));
    }
  }

  /**
   * Send whiteboard message
   */
  sendWhiteboard(message) {
    if (this.whiteboardWs && this.whiteboardWs.readyState === WebSocket.OPEN) {
      this.whiteboardWs.send(JSON.stringify(message));
    }
  }

  /**
   * Register event listener
   */
  on(channel, event, callback) {
    if (!this.listeners[channel][event]) {
      this.listeners[channel][event] = [];
    }
    this.listeners[channel][event].push(callback);
  }

  /**
   * Emit event to listeners
   */
  emit(channel, event, data) {
    if (this.listeners[channel][event]) {
      this.listeners[channel][event].forEach((callback) => callback(data));
    }
  }

  /**
   * Disconnect all WebSocket connections
   */
  disconnect() {
    if (this.rtcWs) {
      this.rtcWs.close();
      this.rtcWs = null;
    }
    if (this.whiteboardWs) {
      this.whiteboardWs.close();
      this.whiteboardWs = null;
    }
  }
}

// Example Usage:
/*
// 1. Coach confirms appointment and creates session
const session = await coachSessionService.createSession(appointmentId);

// 2. Navigate to session room
navigate(`/coach/sessions/${session.session_id}`);

// 3. In session room component:
const wsManager = new CoachSessionWebSocket(sessionId, userRole); // 'coach' or 'client'

// Connect to WebRTC
wsManager.connectRTC();
wsManager.on('rtc', 'peer_ready', () => {
  // Coach should create and send offer
  createAndSendOffer();
});

wsManager.on('rtc', 'offer', (message) => {
  // Client receives offer, send answer
  handleOffer(message);
});

// Connect to whiteboard
wsManager.connectWhiteboard();
wsManager.on('whiteboard', 'media_control', (message) => {
  // Sync media player state
  handleMediaControl(message.data);
});

// 4. Coach controls media
wsManager.sendWhiteboard({
  type: 'media_control',
  data: {
    action: 'open',
    mediaId: content.id,
    mediaType: 'video',
    mediaUrl: content.url,
  },
});

// 5. End session
await coachSessionService.endSession(sessionId, sessionNotes);
wsManager.disconnect();
*/

export { coachSessionService, CoachSessionWebSocket };
