import axiosInstance from '../../axios';

/**
 * Store Service - Public product catalog browsing
 */
const storeService = {
    /**
     * Browse products with filters
     * @param {Object} filters - { search, category_id, age_group_ids, skill_ids, price_min, price_max, sort, page, limit }
     * @returns {Promise} - { products, pagination }
     */
    browseProducts: async (filters = {}) => {
        try {
            const params = new URLSearchParams();
            Object.keys(filters).forEach(key => {
                const value = filters[key];
                // Skip null, undefined, empty strings, and empty arrays
                if (value !== null && value !== undefined && value !== '') {
                    params.append(key, value);
                }
            });

            const response = await axiosInstance.get(`/store/products?${params.toString()}`);
            return response.data;
        } catch (error) {
            console.error('Error browsing products:', error);
            throw error;
        }
    },

    /**
     * Get product details by ID
     * @param {string} productId - UUID
     * @returns {Promise} - Product details
     */
    getProductDetail: async (productId) => {
        try {
            const response = await axiosInstance.get(`/store/products/${productId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching product detail:', error);
            throw error;
        }
    },

    /**
     * Get all product categories
     * @returns {Promise} - Array of categories
     */
    getCategories: async () => {
        try {
            const response = await axiosInstance.get('/products/categories');
            return response.data;
        } catch (error) {
            console.error('Error fetching categories:', error);
            throw error;
        }
    },

    /**
     * Get all age groups
     * @returns {Promise} - Array of age groups
     */
    getAgeGroups: async () => {
        try {
            const response = await axiosInstance.get('/products/age-groups');
            return response.data;
        } catch (error) {
            console.error('Error fetching age groups:', error);
            throw error;
        }
    },

    /**
     * Get all skill focuses
     * @returns {Promise} - Array of skills
     */
    getSkills: async () => {
        try {
            const response = await axiosInstance.get('/products/skills');
            return response.data;
        } catch (error) {
            console.error('Error fetching skills:', error);
            throw error;
        }
    }
};

export default storeService;
