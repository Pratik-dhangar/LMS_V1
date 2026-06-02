import api from '../axios';

const learningGoalsService = {
  admin: {
    create: async (goalData) => {
      const response = await api.post('/learning-goals/admin', goalData);
      return response.data;
    },
    getAll: async () => {
      const response = await api.get('/learning-goals/admin');
      return response.data;
    },
    update: async (goalId, goalData) => {
      const response = await api.patch(`/learning-goals/admin/${goalId}`, goalData);
      return response.data;
    },
    delete: async (goalId) => {
      const response = await api.delete(`/learning-goals/admin/${goalId}`);
      return response.data;
    },
  },
  head: {
    getAll: async () => {
      const response = await api.get('/learning-goals/head');
      return response.data;
    },
  },
  trainer: {
    getAll: async () => {
      const response = await api.get('/learning-goals/trainer');
      return response.data;
    },
  },
  // Fallback for coaches to access learning goals with multiple endpoint attempts
  coach: {
    getAll: async () => {
      try {
        // Try coach-specific endpoint first (if it exists)
        const response = await api.get('/learning-goals/coach');
        return response.data;
      } catch (error) {
        if (error.response?.status === 404) {
          // Endpoint doesn't exist, try admin endpoint as fallback
          try {
            const response = await api.get('/learning-goals/admin');
            return response.data;
          } catch (adminError) {
            // Admin endpoint also failed, throw the original error
            throw error;
          }
        }
        throw error;
      }
    }
  }
};

export default learningGoalsService;
