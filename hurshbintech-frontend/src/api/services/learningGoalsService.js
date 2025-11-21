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
};

export default learningGoalsService;
