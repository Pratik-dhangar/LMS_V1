import api from '../axios';

const sessionService = {
  // Trainer APIs
  createSession: async (sessionData) => {
    try {
      const response = await api.post('/sessions/create', sessionData);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error creating session:', error);
      console.error('[sessionService] Error response:', error.response?.data);
      throw error;
    }
  },

  getTrainerSessions: async () => {
    try {
      const response = await api.get('/sessions/trainer/sessions');
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error fetching trainer sessions:', error);
      throw error;
    }
  },

  startSession: async (sessionId) => {
    try {
      const response = await api.post(`/sessions/${sessionId}/start`);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error starting session:', error);
      throw error;
    }
  },

  endSession: async (sessionId, notes = '') => {
    try {
      const response = await api.post(`/sessions/${sessionId}/end`, { notes });
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error ending session:', error);
      throw error;
    }
  },

  // Learner APIs
  getLearnerSessions: async () => {
    try {
      const response = await api.get('/sessions/learner/sessions');
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error fetching learner sessions:', error);
      throw error;
    }
  },

  joinSession: async (sessionId) => {
    try {
      const response = await api.post(`/sessions/${sessionId}/join`);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error joining session:', error);
      throw error;
    }
  },

  leaveSession: async (sessionId) => {
    try {
      const response = await api.post(`/sessions/${sessionId}/leave`);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error leaving session:', error);
      throw error;
    }
  },

  // Common
  getAllSessions: async (skip = 0, limit = 10) => {
    try {
      const response = await api.get(`/sessions/all?skip=${skip}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error fetching all sessions:', error);
      throw error;
    }
  },

  getSessionDetails: async (sessionId) => {
    try {
      const response = await api.get(`/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error fetching session details:', error);
      throw error;
    }
  },

  // Delete session (Head only)
  deleteSession: async (sessionId) => {
    try {
      const response = await api.delete(`/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error deleting session:', error);
      throw error;
    }
  },

  // Cancel session (Head only)
  cancelSession: async (sessionId) => {
    try {
      const response = await api.post(`/sessions/${sessionId}/cancel`);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error cancelling session:', error);
      throw error;
    }
  },

  // Update session (Head only)
  updateSession: async (sessionId, sessionData) => {
    try {
      const response = await api.put(`/sessions/${sessionId}`, sessionData);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error updating session:', error);
      console.error('[sessionService] Error response:', error.response?.data);
      throw error;
    }
  },

  // WebSocket
  initializeWebSocket: (sessionId, userId) => {
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const wsUrl = baseURL.replace('http', 'ws') + `/api/sessions/ws/${sessionId}/${userId}`;
    return new WebSocket(wsUrl);
  },

  // WebSocket message helpers
  sendWebSocketMessage: (ws, type, payload) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    } else {
      console.error('WebSocket not open, cannot send message');
    }
  },

  // Recording APIs
  getRecordingUrl: async (sessionId) => {
    try {
      const response = await api.get(`/sessions/${sessionId}/recording-url`);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error fetching recording URL:', error);
      throw error;
    }
  },

  // Webhook to notify recording completion (called by Janus or file watcher)
  notifyRecordingComplete: async (sessionId, filePath, recordingId, duration) => {
    try {
      const response = await api.post('/sessions/recordings/webhook/complete', {
        session_id: sessionId,
        file_path: filePath,
        recording_id: recordingId,
        duration: duration
      });
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error notifying recording completion:', error);
      throw error;
    }
  },

  // Upload actual recording file
  uploadRecording: async (formData) => {
    try {
      const response = await api.post('/sessions/recordings/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error uploading recording:', error);
      throw error;
    }
  },

  submitFeedback: async (sessionId, { rating, remark, attendeeRole, attendeeName }) => {
    try {
      const response = await api.post(`/sessions/${sessionId}/feedback`, {
        rating,
        remark: remark || null,
        attendee_role: attendeeRole || 'learner',
        attendee_name: attendeeName || null,
      });
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error submitting feedback:', error);
      throw error;
    }
  },

  getSessionFeedback: async (sessionId) => {
    try {
      const response = await api.get(`/sessions/${sessionId}/feedback`);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error fetching session feedback:', error);
      throw error;
    }
  }
};

export default sessionService;
