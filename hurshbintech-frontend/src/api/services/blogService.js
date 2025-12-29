import api from '../axios';

const blogService = {
    // Admin endpoints
    getAdminBlogs: async ({ page = 1, per_page = 10, status_filter, search }) => {
        const params = new URLSearchParams();
        params.append('page', page);
        params.append('per_page', per_page);
        if (status_filter) params.append('status_filter', status_filter);
        if (search) params.append('search', search);

        const response = await api.get(`/admin/blogs?${params.toString()}`);
        return response.data;
    },

    getAdminBlog: async (id) => {
        const response = await api.get(`/admin/blogs/${id}`);
        return response.data;
    },

    createBlog: async (formData) => {
        const response = await api.post('/admin/blogs', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    updateBlog: async (id, formData) => {
        const response = await api.put(`/admin/blogs/${id}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    deleteBlog: async (id) => {
        try {
            const response = await api.delete(`/admin/blogs/${id}`);
            console.log('Delete response status:', response.status);
            console.log('Delete response data:', response.data);
            // 204 No Content returns empty response, which is success
            return { success: true };
        } catch (error) {
            console.error('Delete error:', error);
            throw error;
        }
    },

    // Public endpoints
    getPublicBlogs: async ({ page = 1, per_page = 10, search }) => {
        const params = new URLSearchParams();
        params.append('page', page);
        params.append('per_page', per_page);
        if (search) params.append('search', search);

        const response = await api.get(`/blogs?${params.toString()}`);
        return response.data;
    },

    getPublicBlogBySlug: async (slug) => {
        const response = await api.get(`/blogs/${slug}`);
        return response.data;
    },
};

export default blogService;
