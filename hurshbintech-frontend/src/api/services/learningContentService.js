import api from '../axios';

const learningContentService = {
  // Upload file (supports large videos up to 100MB - 5 min timeout)
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/content/learning-content/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 200000, // 3 minutes for large video uploads
    });
    return response.data;
  },

  // Get file URL - handles S3 URLs, proxy URLs, local paths, and full URLs
  getFileUrl: (fileUrl) => {
    if (!fileUrl) return '';
    // If already a full URL (presigned or direct), return as is
    if (fileUrl.startsWith('http')) return fileUrl;
    // Handle S3 URLs (s3://bucket/key) - convert to backend proxy for signed access
    if (fileUrl.startsWith('s3://')) {
      const parts = fileUrl.replace('s3://', '').split('/');
      const key = parts.slice(1).join('/');
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://43.204.218.16:8000/api';
      return `${apiBaseUrl}/content/learning-content/s3-files/${key}`;
    }
    // Handle backend proxy URLs (already have /api prefix from backend response)
    if (fileUrl.startsWith('/api/')) {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://43.204.218.16:8000/api';
      const backendUrl = apiBaseUrl.replace('/api', '');
      return `${backendUrl}${fileUrl}`;
    }
    // Handle other paths
    const cleanUrl = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
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

  // Coach APIs - for coach users (similar to trainer)
  coach: {
    create: async (contentData) => {
      const response = await api.post('/content/learning-content/coach', contentData);
      return response.data;
    },

    getAll: async () => {
      const response = await api.get('/content/learning-content/coach');
      return response.data;
    },

    getById: async (contentId) => {
      const response = await api.get(`/content/learning-content/coach/${contentId}`);
      return response.data;
    },

    update: async (contentId, contentData) => {
      const response = await api.patch(`/content/learning-content/coach/${contentId}`, contentData);
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
  },

  // Convenience method for Head
  getAllContentsForHead: async () => {
    const response = await api.get('/content/learning-content/head');
    return response.data;
  }
};

export default learningContentService;
