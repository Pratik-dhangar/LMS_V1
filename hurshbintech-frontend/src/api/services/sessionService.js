import api from '../axios';

const sessionService = {
  // Trainer APIs
  createSession: async (sessionData) => {
    console.log('[sessionService] Creating session with data:', sessionData);
    try {
      const response = await api.post('/sessions/create', sessionData);
      console.log('[sessionService] Session created successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error creating session:', error);
      console.error('[sessionService] Error response:', error.response?.data);
      throw error;
    }
  },

  getTrainerSessions: async () => {
    console.log('[sessionService] Fetching trainer sessions');
    try {
      const response = await api.get('/sessions/trainer/sessions');
      console.log('[sessionService] Trainer sessions fetched:', response.data?.length);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error fetching trainer sessions:', error);
      throw error;
    }
  },

  startSession: async (sessionId) => {
    console.log('[sessionService] Starting session:', sessionId);
    try {
      const response = await api.post(`/sessions/${sessionId}/start`);
      console.log('[sessionService] Session started:', response.data);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error starting session:', error);
      throw error;
    }
  },

  endSession: async (sessionId, notes = '') => {
    console.log('[sessionService] Ending session:', sessionId, 'with notes:', notes);
    try {
      const response = await api.post(`/sessions/${sessionId}/end`, { notes });
      console.log('[sessionService] Session ended:', response.data);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error ending session:', error);
      throw error;
    }
  },

  // Learner APIs
  getLearnerSessions: async () => {
    console.log('[sessionService] Fetching learner sessions');
    try {
      const response = await api.get('/sessions/learner/sessions');
      console.log('[sessionService] Learner sessions fetched:', response.data?.length);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error fetching learner sessions:', error);
      throw error;
    }
  },

  joinSession: async (sessionId) => {
    console.log('[sessionService] Joining session:', sessionId);
    try {
      const response = await api.post(`/sessions/${sessionId}/join`);
      console.log('[sessionService] Joined session:', response.data);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error joining session:', error);
      throw error;
    }
  },

  leaveSession: async (sessionId) => {
    console.log('[sessionService] Leaving session:', sessionId);
    try {
      const response = await api.post(`/sessions/${sessionId}/leave`);
      console.log('[sessionService] Left session:', response.data);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error leaving session:', error);
      throw error;
    }
  },

  // Common
  getAllSessions: async () => {
    console.log('[sessionService] Fetching all sessions (Head)');
    try {
      const response = await api.get('/sessions/all');
      console.log('[sessionService] All sessions fetched:', response.data?.length);
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error fetching all sessions:', error);
      throw error;
    }
  },

  getSessionDetails: async (sessionId) => {
    console.log('[sessionService] Fetching session details for:', sessionId);
    try {
      const response = await api.get(`/sessions/${sessionId}`);
      console.log('[sessionService] Session details fetched:', {
        id: response.data.id,
        session_id: response.data.session_id,
        title: response.data.title,
        status: response.data.status,
        learning_contents: response.data.learning_contents?.length || 0,
        learning_goals: response.data.learning_goals?.length || 0
      });
      return response.data;
    } catch (error) {
      console.error('[sessionService] Error fetching session details:', error);
      throw error;
    }
  },

  // WebSocket
  initializeWebSocket: (sessionId, userId) => {
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    const wsUrl = baseURL.replace('http', 'ws') + `/api/sessions/ws/${sessionId}/${userId}`;
    console.log('Connecting to WebSocket:', wsUrl);
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
