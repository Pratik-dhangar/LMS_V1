import api from '../axios';

const assignedTrainingService = {
    // ========== ADMIN ENDPOINTS ==========

    /**
     * Create a new assigned training (Admin only)
     * @param {Object} data - Training data
     * @param {string} data.title - Training title
     * @param {string} data.description - Training description
     * @param {string} data.training_type - Type: 'custom', 'program', 'content', 'vlog'
     * @param {string} data.custom_content - HTML/rich text content for custom trainings
     * @param {Array<number>} data.training_ref_ids - Referenced IDs (for non-custom types)
     * @param {Array<string>} data.target_roles - Roles: 'all', 'admin', 'head', 'coach', 'trainer', 'learner'
     * @param {string} data.start_date - Start date (YYYY-MM-DD)
     * @param {string} data.end_date - End date (YYYY-MM-DD)
     * @param {number} data.duration_days - Duration in days
     * @param {boolean} data.active - Is active
     * @returns {Promise<Object>} Created training
     */
    adminCreate: async (data) => {
        const response = await api.post('/admin/assigned-trainings', data);
        return response.data;
    },

    /**
     * Get all assigned trainings with pagination (Admin only)
     * @param {Object} options
     * @param {number} options.skip - Pagination skip
     * @param {number} options.limit - Pagination limit
     * @param {boolean} options.active_only - Filter to active trainings only
     * @param {string} options.search - Search query
     * @returns {Promise<Object>} Paginated list of trainings
     */
    adminGetList: async ({ skip = 0, limit = 10, active_only = false, search = null } = {}) => {
        const params = new URLSearchParams();
        params.append('skip', skip);
        params.append('limit', limit);
        params.append('active_only', active_only);
        if (search) params.append('search', search);

        const response = await api.get(`/admin/assigned-trainings?${params.toString()}`);
        return response.data;
    },

    /**
     * Get a single assigned training details (Admin only)
     * @param {number} trainingId - Training ID
     * @returns {Promise<Object>} Training details
     */
    adminGet: async (trainingId) => {
        const response = await api.get(`/admin/assigned-trainings/${trainingId}`);
        return response.data;
    },

    /**
     * Update an assigned training (Admin only)
     * @param {number} trainingId - Training ID
     * @param {Object} data - Updated training data
     * @returns {Promise<Object>} Updated training
     */
    adminUpdate: async (trainingId, data) => {
        const response = await api.patch(`/admin/assigned-trainings/${trainingId}`, data);
        return response.data;
    },

    /**
     * Delete an assigned training (Admin only)
     * @param {number} trainingId - Training ID
     * @returns {Promise<void>}
     */
    adminDelete: async (trainingId) => {
        try {
            const response = await api.delete(`/admin/assigned-trainings/${trainingId}`);
            // 204 No Content returns empty response, which is success
            return { success: true };
        } catch (error) {
            console.error('Delete error:', error);
            throw error;
        }
    },

    // ========== USER ENDPOINTS ==========

    /**
     * Get all trainings assigned to current user based on their role
     * @param {Object} options
     * @param {number} options.skip - Pagination skip
     * @param {number} options.limit - Pagination limit
     * @returns {Promise<Object>} Paginated list of trainings for user
     */
    getMyAssignedTrainings: async ({ skip = 0, limit = 10 } = {}) => {
        const params = new URLSearchParams();
        params.append('skip', skip);
        params.append('limit', limit);

        const response = await api.get(`/assigned-trainings/me?${params.toString()}`);
        return response.data;
    },

    /**
     * Get a single assigned training with user progress
     * @param {number} trainingId - Training ID
     * @returns {Promise<Object>} Training details with user progress
     */
    getAssignedTraining: async (trainingId) => {
        const response = await api.get(`/assigned-trainings/${trainingId}`);
        return response.data;
    },

    /**
     * Mark an assigned training as in-progress
     * @param {number} trainingId - Training ID
     * @returns {Promise<Object>} Updated training with status
     */
    markInProgress: async (trainingId) => {
        const response = await api.post(`/assigned-trainings/${trainingId}/mark-in-progress`);
        return response.data;
    },

    /**
     * Mark an assigned training as completed
     * @param {number} trainingId - Training ID
     * @param {Object} options
     * @param {string} options.evidence - Optional evidence/notes
     * @returns {Promise<Object>} Updated training with status
     */
    markComplete: async (trainingId, { evidence = null } = {}) => {
        const payload = {};
        if (evidence) payload.evidence = evidence;

        const response = await api.post(`/assigned-trainings/${trainingId}/mark-complete`, payload);
        return response.data;
    },
};

export default assignedTrainingService;
