import api from '../axios';

const aboutUsService = {
    // Admin endpoints
    getAdminAboutUs: async (language_code = 'en') => {
        const response = await api.get(`/admin/about-us?language_code=${language_code}`);
        return response.data;
    },

    createAboutUs: async (formData) => {
        const response = await api.post('/admin/about-us', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    updateAboutUs: async (id, formData) => {
        const response = await api.put(`/admin/about-us/${id}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    deleteAboutUs: async (id) => {
        try {
            const response = await api.delete(`/admin/about-us/${id}`);
            console.log('Delete response status:', response.status);
            console.log('Delete response data:', response.data);
            // 204 No Content returns empty response, which is success
            return { success: true };
        } catch (error) {
            console.error('Delete error:', error);
            throw error;
        }
    },

    // Public endpoint
    getPublicAboutUs: async (language_code = 'en') => {
        const response = await api.get(`/about-us/public?language_code=${language_code}`);
        return response.data;
    },
};

export default aboutUsService;
