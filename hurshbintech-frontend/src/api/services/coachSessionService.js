import api from '../axios';

const coachSessionService = {
  // Create session from appointment
  createSessionFromAppointment: async (appointmentId) => {
    try {
      const response = await api.post('/coach-sessions/create', {
        appointment_id: appointmentId
      });
      return response.data;
    } catch (error) {
      console.error('[coachSessionService] Error creating session:', error);
      throw error;
    }
  },

  // Get coach's sessions
  getCoachSessions: async () => {
    try {
      const response = await api.get('/coach-sessions/coach/sessions');
      return response.data;
    } catch (error) {
      console.error('[coachSessionService] Error fetching coach sessions:', error);
      throw error;
    }
  },

  // Get client's sessions
  getClientSessions: async () => {
    try {
      const response = await api.get('/coach-sessions/client/sessions');
      return response.data;
    } catch (error) {
      console.error('[coachSessionService] Error fetching client sessions:', error);
      throw error;
    }
  },

  // Get session details
  getSessionDetails: async (sessionId) => {
    try {
      const response = await api.get(`/coach-sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error('[coachSessionService] Error fetching session details:', error);
      throw error;
    }
  },

  // Start session (coach only)
  startSession: async (sessionId) => {
    try {
      const response = await api.post(`/coach-sessions/${sessionId}/start`);
      return response.data;
    } catch (error) {
      console.error('[coachSessionService] Error starting session:', error);
      throw error;
    }
  },

  // End session
  endSession: async (sessionId, notes = '') => {
    try {
      const response = await api.post(`/coach-sessions/${sessionId}/end`, {
        notes: notes
      });
      return response.data;
    } catch (error) {
      console.error('[coachSessionService] Error ending session:', error);
      throw error;
    }
  },

  // Join session (client)
  joinSession: async (sessionId) => {
    try {
      const response = await api.post(`/coach-sessions/${sessionId}/join`);
      return response.data;
    } catch (error) {
      console.error('[coachSessionService] Error joining session:', error);
      throw error;
    }
  },

  // Update session
  updateSession: async (sessionId, updates) => {
    try {
      const response = await api.put(`/coach-sessions/${sessionId}`, updates);
      return response.data;
    } catch (error) {
      console.error('[coachSessionService] Error updating session:', error);
      throw error;
    }
  },

  // Cancel session
  cancelSession: async (sessionId) => {
    try {
      const response = await api.delete(`/coach-sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error('[coachSessionService] Error cancelling session:', error);
      throw error;
    }
  },

  // Upload recording
  uploadRecording: async (sessionId, recordingBlob, filename) => {
    try {
      const formData = new FormData();
      formData.append('file', recordingBlob, filename);
      formData.append('session_id', sessionId);

      const response = await api.post('/coach-sessions/recordings/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('[coachSessionService] Error uploading recording:', error);
      throw error;
    }
  },

  // Get recording URL
  getRecordingUrl: async (sessionId) => {
    try {
      const response = await api.get(`/coach-sessions/${sessionId}/recording-url`);
      return response.data;
    } catch (error) {
      console.error('[coachSessionService] Error fetching recording URL:', error);
      throw error;
    }
  },
};

export default coachSessionService;
