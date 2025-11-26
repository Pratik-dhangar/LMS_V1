import api from '../axios';

const learningContentService = {
  // Upload file
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/content/learning-content/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Get file URL (prepend backend base URL)
  getFileUrl: (fileUrl) => {
    if (!fileUrl) return '';
    // If already a full URL, return as is
    if (fileUrl.startsWith('http')) return fileUrl;
    // Remove /api prefix if present and add backend URL
    const cleanUrl = fileUrl.startsWith('/api') ? fileUrl.replace('/api', '') : fileUrl;
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://43.204.218.16:8000/api';
    const backendUrl = apiBaseUrl.replace('/api', ''); // Remove /api to get base URL
    return `${backendUrl}${cleanUrl}`;
  },

  // Admin APIs - for admin users
  admin: {
    create: async (contentData) => {
      const response = await api.post('/content/learning-content/admin', contentData);
      return response.data;
    },

    getAll: async () => {
      const response = await api.get('/content/learning-content/admin');
      return response.data;
    },

    getById: async (contentId) => {
      const response = await api.get(`/content/learning-content/admin/${contentId}`);
      return response.data;
    },

    update: async (contentId, contentData) => {
      const response = await api.patch(`/content/learning-content/admin/${contentId}`, contentData);
      return response.data;
    },

    delete: async (contentId) => {
      const response = await api.delete(`/content/learning-content/admin/${contentId}`);
      return response.data;
    }
  },

  // Trainer APIs - for trainer users (can create content from whiteboard)
  trainer: {
    create: async (contentData) => {
      const response = await api.post('/content/learning-content/trainer', contentData);
      return response.data;
    },

    getAll: async () => {
      const response = await api.get('/content/learning-content/trainer');
      return response.data;
    },

    getById: async (contentId) => {
      const response = await api.get(`/content/learning-content/trainer/${contentId}`);
      return response.data;
    },

    update: async (contentId, contentData) => {
      const response = await api.patch(`/content/learning-content/trainer/${contentId}`, contentData);
      return response.data;
    }
  },

  // Head APIs
  head: {
    getAll: async () => {
      const response = await api.get('/content/learning-content/head');
      return response.data;
    },

    getById: async (contentId) => {
      const response = await api.get(`/content/learning-content/head/${contentId}`);
      return response.data;
    },

    update: async (contentId, contentData) => {
      const response = await api.patch(`/content/learning-content/head/${contentId}`, contentData);
      return response.data;
    }
  }
};

export default learningContentService;
