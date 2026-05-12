import axios from 'axios';
import axiosInstance from '../../axios';

const publicAxios = axios.create({
    baseURL: axiosInstance.defaults.baseURL,
    timeout: axiosInstance.defaults.timeout,
    headers: {
        'Content-Type': 'application/json'
    }
});

/**
 * Order Service - Order and payment management
 */
const orderService = {
    /**
     * Checkout - Create order from cart
     * @param {Object} orderData - { delivery_address, delivery_city, delivery_pincode, payment_method }
     * @returns {Promise} - Order details with payment instructions
     */
    checkout: async (orderData, isGuestCheckout = false) => {
        try {
            const client = isGuestCheckout ? publicAxios : axiosInstance;
            const response = await client.post('/orders/checkout', orderData);
            return response.data;
        } catch (error) {
            console.error('Error during checkout:', error);
            throw error;
        }
    },

    /**
     * Get user's orders with optional filters
     * @param {Object} filters - { status, page, limit }
     * @returns {Promise} - { orders, pagination }
     */
    getOrders: async (filters = {}) => {
        try {
            const params = new URLSearchParams();
            Object.keys(filters).forEach(key => {
                if (filters[key] !== null && filters[key] !== undefined) {
                    params.append(key, filters[key]);
                }
            });

            const response = await axiosInstance.get(`/orders?${params.toString()}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching orders:', error);
            throw error;
        }
    },

    /**
     * Get order by ID
     * @param {string} orderId - Order UUID
     * @returns {Promise} - Order details
     */
    getOrder: async (orderId) => {
        try {
            const response = await axiosInstance.get(`/orders/${orderId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching order:', error);
            throw error;
        }
    },

    /**
     * Track order by tracking ID (order_number or guest_token)
     * Public endpoint - no authentication required
     * @param {string} trackingId - Order number or guest token
     * @returns {Promise} - Order details
     */
    getOrderByTrackingId: async (trackingId) => {
        try {
            const response = await publicAxios.get(`/orders/track/${trackingId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching order by tracking ID:', error);
            throw error;
        }
    },

    /**
     * Upload payment receipt
     * @param {string} orderId - Order UUID
     * @param {File} receiptFile - Receipt file (JPG, PNG, PDF)
     * @returns {Promise} - Receipt upload confirmation
     */
    uploadReceipt: async (orderId, receiptFile, guestToken = null) => {
        try {
            const formData = new FormData();
            formData.append('receipt', receiptFile);

            const url = guestToken
                ? `/orders/${orderId}/payment-receipt?guest_token=${encodeURIComponent(guestToken)}`
                : `/orders/${orderId}/payment-receipt`;

            const client = guestToken ? publicAxios : axiosInstance;
            const response = await client.post(url, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error uploading receipt:', error);
            throw error;
        }
    }
};

export default orderService;
