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
    console.log('[🎬 VIEW CLICK] Initial fileUrl received:', fileUrl);

    if (!fileUrl) {
      console.warn('[🎬 VIEW CLICK] ❌ fileUrl is empty/null');
      return '';
    }

    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://hurshbin.com/api';
    console.log('[🎬 VIEW CLICK] API Base URL:', apiBaseUrl);

    // If already a full URL, check if it's an old frontend-proxy S3 URL (e.g. :3001/s3/...)
    // and rewrite to current frontend origin before returning
    if (fileUrl.startsWith('http')) {
      console.log('[🎬 VIEW CLICK] Case: Full HTTP URL');
      try {
        const urlObj = new URL(fileUrl);
        if (urlObj.pathname.startsWith('/s3/') &&
          !urlObj.hostname.includes('amazonaws.com') &&
          !urlObj.hostname.includes('neevcloud.com')) {
          const rewrittenUrl = `${window.location.origin}${urlObj.pathname}`;
          console.log('[🎬 VIEW CLICK] ✅ Rewritten old frontend proxy URL:', rewrittenUrl);
          return rewrittenUrl;
        }
      } catch (e) {
        console.error('[🎬 VIEW CLICK] Error parsing URL:', e);
      }
      console.log('[🎬 VIEW CLICK] ✅ Returning full HTTP URL as-is:', fileUrl);
      return fileUrl;
    }

    // Handle S3 URLs (s3://bucket/key) - convert to backend proxy for signed access
    if (fileUrl.startsWith('s3://')) {
      console.log('[🎬 VIEW CLICK] Case: S3 URL');
      const parts = fileUrl.replace('s3://', '').split('/');
      console.log('[🎬 VIEW CLICK] S3 parts:', parts);
      const key = parts.slice(1).join('/');
      const finalUrl = `${apiBaseUrl}/media/s3/${key}`;
      console.log('[🎬 VIEW CLICK] ✅ Converted S3 URL to proxy:', { original: fileUrl, key, finalUrl });
      return finalUrl;
    }

    // Handle backend proxy URLs (already have /api prefix from backend response)
    if (fileUrl.startsWith('/api/')) {
      console.log('[🎬 VIEW CLICK] Case: Already a proxy URL with /api/');
      const backendUrl = apiBaseUrl.replace('/api', '');
      const finalUrl = `${backendUrl}${fileUrl}`;
      console.log('[🎬 VIEW CLICK] ✅ Returning proxy URL:', finalUrl);
      return finalUrl;
    }

    // Handle other paths
    console.log('[🎬 VIEW CLICK] Case: Other path');
    const cleanUrl = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
    const backendUrl = apiBaseUrl.replace('/api', ''); // Remove /api to get base URL
    const finalUrl = `${backendUrl}${cleanUrl}`;
    console.log('[🎬 VIEW CLICK] ✅ Returning final URL:', finalUrl);
    return finalUrl;
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
