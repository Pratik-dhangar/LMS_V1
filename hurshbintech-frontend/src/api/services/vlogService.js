import api from '../axios';

const vlogService = {
  // Get all vlogs
  getAllVlogs: async () => {
    const response = await api.get('/vlogs');
    return response.data;
  },

  // Get a single vlog by ID
  getVlogById: async (id) => {
    const response = await api.get(`/vlogs/${id}`);
    return response.data;
  },

  // Create a new vlog (admin only)
  createVlog: async (formData) => {
    const response = await api.post('/vlogs', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Update a vlog (admin only)
  updateVlog: async (id, formData) => {
    const response = await api.put(`/vlogs/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Delete a vlog (admin only)
  deleteVlog: async (id) => {
    const response = await api.delete(`/vlogs/${id}`);
    return response.status === 204 ? { success: true } : response.data;
  },
};

export default vlogService;
