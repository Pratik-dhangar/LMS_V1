import api from '../axios';

const galleryService = {
    // Admin endpoints
    getAllGalleries: async () => {
        const response = await api.get('/gallery');
        return response.data;
    },

    getGalleryById: async (id) => {
        const response = await api.get(`/gallery/${id}`);
        return response.data;
    },

    createGallery: async (formData) => {
        const response = await api.post('/gallery', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    updateGallery: async (id, formData) => {
        const response = await api.put(`/gallery/${id}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    deleteGallery: async (id) => {
        const response = await api.delete(`/gallery/${id}`);
        return response.status === 204 ? { success: true } : response.data;
    },

    // Public endpoints
    getPublicGalleries: async ({ page = 1, per_page = 12, search }) => {
        const params = new URLSearchParams();
        params.append('page', page);
        params.append('per_page', per_page);
        if (search) params.append('search', search);

        const response = await api.get(`/gallery/public/list?${params.toString()}`);
        return response.data;
    },

    getPublicGalleryById: async (id) => {
        const response = await api.get(`/gallery/public/${id}`);
        return response.data;
    },
};

export default galleryService;
