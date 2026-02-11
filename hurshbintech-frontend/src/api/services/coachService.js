import api from '../axios';

const coachService = {
  /**
   * Get available learners for session
   */
  getAvailableLearners: async () => {
    const response = await api.get('/coaches/available-users/learners');
    return response.data;
  },

  /**
   * Get available trainers for session
   */
  getAvailableTrainers: async () => {
    const response = await api.get('/coaches/available-users/trainers');
    return response.data;
  },

  /**
   * Get available heads for session
   */
  getAvailableHeads: async () => {
    const response = await api.get('/coaches/available-users/heads');
    return response.data;
  },

  /**
   * Get learning contents
   */
  getLearningContents: async () => {
    const response = await api.get('/coaches/learning-contents');
    return response.data;
  },

  /**
   * Create a new coach session
   */
  createSession: async (sessionData) => {
    const response = await api.post('/coaches/sessions', sessionData);
    return response.data;
  },

  /**
   * Get all sessions for current coach
   */
  getMySessions: async () => {
    const response = await api.get('/coaches/sessions');
    return response.data;
  },

  /**
   * Get session details
   */
  getSessionById: async (sessionId) => {
    const response = await api.get(`/coaches/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Update session
   */
  updateSession: async (sessionId, sessionData) => {
    const response = await api.patch(`/coaches/sessions/${sessionId}`, sessionData);
    return response.data;
  },

  /**
   * Delete session
   */
  deleteSession: async (sessionId) => {
    const response = await api.delete(`/coaches/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Get appointments for coach (created by others)
   */
  getMyAppointments: async () => {
    const response = await api.get('/coaches/appointments');
    return response.data;
  },

  /**
   * Update appointment status (accept/reject)
   */
  updateAppointmentStatus: async (appointmentId, status) => {
    const response = await api.patch(`/coaches/appointments/${appointmentId}`, { status });
    return response.data;
  },

  /**
   * Get current coach profile
   */
  getCurrentProfile: async () => {
    try {
      console.log('[coachService] Fetching current profile...');
      const response = await api.get('/profile/me/user');
      console.log('[coachService] Profile response status:', response.status);
      console.log('[coachService] Profile response data:', response.data);
      return response.data;
    } catch (error) {
      console.error('[coachService] Error fetching profile:', error);
      console.error('[coachService] Error response:', error.response?.data);
      throw error;
    }
  },

  /**
   * Reject an appointment with reason and optional refund receipt
   */
  rejectAppointment: async (appointmentId, formData) => {
    const response = await api.post(`/coaches/appointments/${appointmentId}/reject`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export default coachService;
