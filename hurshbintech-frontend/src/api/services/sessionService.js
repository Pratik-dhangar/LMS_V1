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
  getAllSessions: async () => {
    try {
      const response = await api.get('/sessions/all');
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
  }
};

export default sessionService;
