import api from '../axios';
import { getFileUrl } from '../../utils/urlHelper';

const learningContentService = {
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name);

    const response = await api.post('/materials', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 200000,
    });
    return response.data;
  },

  getAllMaterials: async () => {
    const response = await api.get('/materials');
    return response.data?.materials || response.data || [];
  },

  trainer: {
    getAll: async () => {
      const response = await api.get('/materials');
      return response.data?.materials || response.data || [];
    },
  },

  admin: {
    getAll: async () => {
      const response = await api.get('/materials');
      return response.data?.materials || response.data || [];
    },
  },

  getFileUrl: (fileUrl) => {
    return getFileUrl(fileUrl);
  },
};

export default learningContentService;
