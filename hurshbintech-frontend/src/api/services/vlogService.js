import api from '../axios';

const vlogService = {
  // Admin endpoints
  getAllVlogs: async () => {
    const response = await api.get('/vlogs');
    return response.data;
  },

  getVlogById: async (id) => {
    const response = await api.get(`/vlogs/${id}`);
    return response.data;
  },

  createVlog: async (formData) => {
    const response = await api.post('/vlogs', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  updateVlog: async (id, formData) => {
    const response = await api.put(`/vlogs/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  deleteVlog: async (id) => {
    const response = await api.delete(`/vlogs/${id}`);
    return response.status === 204 ? { success: true } : response.data;
  },

  // Public endpoints
  getPublicVlogs: async ({ page = 1, per_page = 10, search }) => {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('per_page', per_page);
    if (search) params.append('search', search);

    const response = await api.get(`/vlogs/public?${params.toString()}`);
    return response.data;
  },

  getPublicVlogById: async (id) => {
    const response = await api.get(`/vlogs/public/${id}`);
    return response.data;
  },
};

export default vlogService;
