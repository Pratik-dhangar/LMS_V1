import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Helper function to get auth headers
const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
    };
};

const vendorService = {
    /**
     * Create a new vendor
     */
    createVendor: async (vendorData) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/admin/vendors`, vendorData, {
                headers: getAuthHeaders(),
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    /**
     * Get vendor by ID
     */
    getVendor: async (vendorId) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/admin/vendors/${vendorId}`, {
                headers: getAuthHeaders(),
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    /**
     * Get all vendors for admin
     */
    getAllVendors: async (skip = 0, limit = 100, activeOnly = false) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/admin/vendors`, {
                params: {
                    skip,
                    limit,
                    active_only: activeOnly,
                },
                headers: getAuthHeaders(),
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    /**
     * Update vendor information
     */
    updateVendor: async (vendorId, vendorData) => {
        try {
            const response = await axios.put(`${API_BASE_URL}/admin/vendors/${vendorId}`, vendorData, {
                headers: getAuthHeaders(),
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    /**
     * Delete (deactivate) a vendor
     */
    deleteVendor: async (vendorId) => {
        try {
            const response = await axios.delete(`${API_BASE_URL}/admin/vendors/${vendorId}`, {
                headers: getAuthHeaders(),
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    /**
     * Toggle vendor active/inactive status
     */
    toggleVendorStatus: async (vendorId) => {
        try {
            const response = await axios.patch(`${API_BASE_URL}/admin/vendors/${vendorId}/toggle-status`, {}, {
                headers: getAuthHeaders(),
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },

    /**
     * Get vendor count
     */
    getVendorCount: async (activeOnly = false) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/admin/vendors/count/total`, {
                params: {
                    active_only: activeOnly,
                },
                headers: getAuthHeaders(),
            });
            return response.data;
        } catch (error) {
            throw error.response?.data || error.message;
        }
    },
};

export default vendorService;
