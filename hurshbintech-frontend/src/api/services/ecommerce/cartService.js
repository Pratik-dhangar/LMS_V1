import axiosInstance from '../../axios';

/**
 * Cart Service - User cart management
 */
const cartService = {
    /**
     * Get user's cart
     * @returns {Promise} - { cart_id, items, subtotal, discount_total, total }
     */
    getCart: async () => {
        try {
            const response = await axiosInstance.get('/cart');
            return response.data;
        } catch (error) {
            console.error('Error fetching cart:', error);
            throw error;
        }
    },

    /**
     * Add item to cart
     * @param {Object} itemData - { product_id, quantity }
     * @returns {Promise} - Updated cart
     */
    addToCart: async (itemData) => {
        try {
            const response = await axiosInstance.post('/cart/items', itemData);
            return response.data;
        } catch (error) {
            console.error('Error adding to cart:', error);
            throw error;
        }
    },

    /**
     * Update cart item quantity
     * @param {string} itemId - Cart item UUID
     * @param {number} quantity - New quantity
     * @returns {Promise} - Updated cart
     */
    updateCartItem: async (itemId, quantity) => {
        try {
            const response = await axiosInstance.put(`/cart/items/${itemId}`, { quantity });
            return response.data;
        } catch (error) {
            console.error('Error updating cart item:', error);
            throw error;
        }
    },

    /**
     * Remove item from cart
     * @param {string} itemId - Cart item UUID
     * @returns {Promise}
     */
    removeFromCart: async (itemId) => {
        try {
            await axiosInstance.delete(`/cart/items/${itemId}`);
        } catch (error) {
            console.error('Error removing from cart:', error);
            throw error;
        }
    },

    /**
     * Clear entire cart
     * @returns {Promise}
     */
    clearCart: async () => {
        try {
            await axiosInstance.delete('/cart');
        } catch (error) {
            console.error('Error clearing cart:', error);
            throw error;
        }
    }
};

export default cartService;
