import axiosInstance from '../axios';

/**
 * Subscription Service
 * Handles subscription management API calls for HEAD, ADMIN, and other roles
 */

// Helper function to determine the correct endpoint prefix
const getPackageEndpointPrefix = () => {
  // Get the current path to determine if it's admin or head
  const path = window.location.pathname;
  if (path.includes('/admin')) {
    return '/admin';
  }
  return '/head';
};

const subscriptionService = {
  // ============ SUBSCRIPTION PACKAGE APIs (HEAD & ADMIN) ============

  /**
   * Create a new subscription package
   * @param {Object} packageData - Package details
   * @returns {Promise} - Created package
   */
  createPackage: async (packageData) => {
    const prefix = getPackageEndpointPrefix();
    console.log('Creating new subscription package:', packageData, 'Endpoint:', prefix);
    const response = await axiosInstance.post(`${prefix}/subscription-packages`, packageData);
    console.log('Package created successfully:', response.data);
    return response.data;
  },

  /**
   * Get all subscription packages
   * @param {boolean} activeOnly - Filter active packages only
   * @returns {Promise} - Array of packages
   */
  getAllPackages: async (activeOnly = true) => {
    const prefix = getPackageEndpointPrefix();
    console.log('Fetching subscription packages, activeOnly:', activeOnly, 'Endpoint:', prefix);
    try {
      const response = await axiosInstance.get(`${prefix}/subscription-packages`, {
        params: { active_only: activeOnly }
      });
      console.log('Packages fetched successfully:', {
        count: response.data?.length || 0,
        data: response.data
      });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching packages:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        error: error
      });
      return [];
    }
  },

  /**
   * Get package details by ID
   * @param {number} packageId
   * @returns {Promise} - Package details
   */
  getPackageById: async (packageId) => {
    const prefix = getPackageEndpointPrefix();
    console.log('Fetching package details:', { packageId });
    const response = await axiosInstance.get(`${prefix}/subscription-packages/${packageId}`);
    return response.data;
  },

  /**
   * Update a subscription package
   * @param {number} packageId
   * @param {Object} updateData
   * @returns {Promise} - Updated package
   */
  updatePackage: async (packageId, updateData) => {
    const prefix = getPackageEndpointPrefix();
    console.log('Updating package:', { packageId, updateData });
    const response = await axiosInstance.patch(`${prefix}/subscription-packages/${packageId}`, updateData);
    return response.data;
  },

  /**
   * Delete a subscription package (soft delete)
   * @param {number} packageId
   * @returns {Promise}
   */
  deletePackage: async (packageId) => {
    const prefix = getPackageEndpointPrefix();
    console.log('Deleting package:', { packageId });
    const response = await axiosInstance.delete(`${prefix}/subscription-packages/${packageId}`);
    return response.data;
  },

  // ============ LEARNER SUBSCRIPTION APIs (HEAD) ============

  /**
   * Get learner's own subscriptions (FOR LEARNER ROLE)
   * @returns {Promise} - Array of learner's subscriptions
   */
  getMySubscriptions: async () => {
    console.log('Fetching my subscriptions (learner)');
    const response = await axiosInstance.get('/profile/me/subscriptions');
    console.log('My subscriptions fetched:', { count: response.data.length });
    return response.data;
  },

  /**
   * Create a new subscription for a learner
   * @param {Object} subscriptionData
   * @returns {Promise} - Created subscription
   */
  createSubscription: async (subscriptionData) => {
    console.log('Creating new subscription:', subscriptionData);
    const response = await axiosInstance.post('/head/subscriptions', subscriptionData);
    console.log('Subscription created successfully:', response.data);
    return response.data;
  },

  /**
   * Create a backdated subscription renewal
   * @param {Object} subscriptionData
   * @param {number} oldSubscriptionId
   * @returns {Promise} - Created subscription
   */
  createBackdatedSubscription: async (subscriptionData, oldSubscriptionId) => {
    console.log('Creating backdated subscription:', { subscriptionData, oldSubscriptionId });
    const response = await axiosInstance.post('/head/subscriptions/backdate', subscriptionData, {
      params: { old_subscription_id: oldSubscriptionId }
    });
    return response.data;
  },

  /**
   * Validate backdate request
   * @param {number} learnerId
   * @param {number} oldSubscriptionId
   * @param {string} newStartDate - ISO date string
   * @returns {Promise} - Validation result
   */
  validateBackdate: async (learnerId, oldSubscriptionId, newStartDate) => {
    console.log('Validating backdate:', { learnerId, oldSubscriptionId, newStartDate });
    const response = await axiosInstance.get('/head/subscriptions/validate-backdate', {
      params: {
        learner_id: learnerId,
        old_subscription_id: oldSubscriptionId,
        new_start_date: newStartDate
      }
    });
    return response.data;
  },

  /**
   * Get all subscriptions managed by HEAD
   * @param {string} status - Optional status filter
   * @param {number} limit - Optional limit
   * @returns {Promise} - Array of subscriptions
   */
  getAllSubscriptions: async (status = null, limit = null) => {
    try {
      const response = await axiosInstance.get('/head/subscriptions', {
        params: { status, limit }
      });
      return response.data || [];
    } catch (error) {
      console.error('Error fetching subscriptions:', error.response?.data || error.message);
      return [];
    }
  },

  /**
   * Get subscription details by ID
   * @param {number} subscriptionId
   * @returns {Promise} - Subscription details
   */
  getSubscriptionById: async (subscriptionId) => {
    const response = await axiosInstance.get(`/head/subscriptions/${subscriptionId}`);
    return response.data;
  },

  /**
   * Get renewal chain for a subscription
   * @param {number} subscriptionId
   * @returns {Promise} - Array of subscriptions in chain
   */
  getRenewalChain: async (subscriptionId) => {
    console.log('Fetching renewal chain:', { subscriptionId });
    const response = await axiosInstance.get(`/head/subscriptions/${subscriptionId}/renewal-chain`);
    return response.data;
  },

  /**
   * Pause a subscription
   * @param {number} subscriptionId
   * @param {string} reason - Optional reason
   * @returns {Promise} - Updated subscription
   */
  pauseSubscription: async (subscriptionId, reason = null) => {
    console.log('Pausing subscription:', { subscriptionId, reason });
    const response = await axiosInstance.post(`/head/subscriptions/${subscriptionId}/pause`, {
      subscription_id: subscriptionId,
      reason
    });
    return response.data;
  },

  /**
   * Freeze a subscription
   * @param {number} subscriptionId
   * @param {string} reason - Optional reason
   * @returns {Promise} - Updated subscription
   */
  /**
   * Resume a paused/frozen subscription
   * @param {number} subscriptionId
   * @returns {Promise} - Updated subscription
   */
  resumeSubscription: async (subscriptionId) => {
    console.log('Resuming subscription:', { subscriptionId });
    const response = await axiosInstance.post(`/head/subscriptions/${subscriptionId}/resume`);
    return response.data;
  },

  /**
   * Cancel a subscription
   * @param {number} subscriptionId
   * @param {string} reason - Cancellation reason (minimum 10 characters)
   * @returns {Promise} - Updated subscription
   */
  cancelSubscription: async (subscriptionId, reason) => {
    console.log('Cancelling subscription:', { subscriptionId, reason });
    const response = await axiosInstance.post(`/head/subscriptions/${subscriptionId}/cancel`, {
      subscription_id: subscriptionId,
      reason: typeof reason === 'string' ? reason : reason.cancellation_reason
    });
    return response.data;
  },

  /**
   * Delete a subscription (permanently remove from database)
   * @param {number} subscriptionId
   * @returns {Promise}
   */
  deleteSubscription: async (subscriptionId) => {
    console.log('Deleting subscription:', { subscriptionId });
    const response = await axiosInstance.delete(`/head/subscriptions/${subscriptionId}`);
    return response.data;
  },

  /**
   * Process refund for a subscription
   * @param {number} subscriptionId
   * @param {string} refundType - 'FULL' or 'PRORATED'
   * @param {string} reason - Refund reason (minimum 10 characters)
   * @returns {Promise} - Refund details
   */
  processRefund: async (subscriptionId, refundType, reason) => {
    console.log('Processing refund:', { subscriptionId, refundType, reason });
    const response = await axiosInstance.post(`/head/subscriptions/${subscriptionId}/refund`, {
      subscription_id: subscriptionId,
      refund_type: refundType,
      reason: typeof reason === 'string' ? reason : reason.reason || reason.refund_reason
    });
    return response.data;
  },

  /**
   * Adjust session count manually
   * @param {number} subscriptionId
   * @param {Object} adjustmentData - { subscription_id, adjustment_type, adjustment_amount, reason }
   * @returns {Promise} - Adjustment log
   */
  adjustSessions: async (subscriptionId, adjustmentData) => {
    console.log('Adjusting sessions:', { subscriptionId, adjustmentData });
    const response = await axiosInstance.post(`/head/subscriptions/${subscriptionId}/adjust-sessions`, adjustmentData);
    return response.data;
  },

  /**
   * Upload payment receipt
   * @param {number} subscriptionId
   * @param {File} file
   * @returns {Promise} - Receipt details
   */
  uploadPaymentReceipt: async (subscriptionId, file) => {
    console.log('Uploading payment receipt:', { subscriptionId, fileName: file.name });
    const formData = new FormData();
    formData.append('file', file);

    const response = await axiosInstance.post(
      `/head/subscriptions/${subscriptionId}/upload-receipt`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response.data;
  },

  /**
   * Get expiring subscriptions
   * @param {number} days - Number of days before expiry
   * @returns {Promise} - Array of expiring subscriptions
   */
  getExpiringSubscriptions: async (days = 7) => {
    console.log('Fetching expiring subscriptions:', { days });
    const response = await axiosInstance.get('/head/subscriptions/expiring-soon', {
      params: { days }
    });
    return response.data;
  },

  // ============ ADMIN APIs ============

  /**
   * Create a discount code (ADMIN)
   * @param {Object} discountData
   * @returns {Promise} - Created discount
   */
  createDiscountCode: async (discountData) => {
    console.log('Creating discount code:', discountData);
    const response = await axiosInstance.post('/admin/discount-codes', discountData);
    return response.data;
  },

  /**
   * Bulk create discount codes (ADMIN)
   * @param {Object} bulkData
   * @returns {Promise} - Array of created discounts
   */
  bulkCreateDiscountCodes: async (bulkData) => {
    console.log('Bulk creating discount codes:', bulkData);
    const response = await axiosInstance.post('/admin/discount-codes/bulk', bulkData);
    return response.data;
  },

  /**
   * Get all discount codes (ADMIN)
   * @param {boolean} activeOnly
   * @returns {Promise} - Array of discounts
   */
  getAllDiscountCodes: async (activeOnly = true) => {
    console.log('Fetching discount codes, activeOnly:', activeOnly);
    try {
      const response = await axiosInstance.get('/admin/discount-codes', {
        params: { active_only: activeOnly }
      });
      // Return empty array if response is null or undefined
      return response.data || [];
    } catch (error) {
      console.error('Error fetching discount codes:', error);
      // Return empty array on error instead of throwing
      return [];
    }
  },

  /**
   * Get discount code by code (ADMIN)
   * @param {string} code
   * @returns {Promise} - Discount details
   */
  getDiscountByCode: async (code) => {
    console.log('Fetching discount code:', { code });
    const response = await axiosInstance.get(`/admin/discount-codes/${code}`);
    return response.data;
  },

  /**
   * Update discount code (ADMIN)
   * @param {number} discountId
   * @param {Object} updateData
   * @returns {Promise} - Updated discount
   */
  updateDiscountCode: async (discountId, updateData) => {
    console.log('Updating discount code:', { discountId, updateData });
    const response = await axiosInstance.patch(`/admin/discount-codes/${discountId}`, updateData);
    return response.data;
  },

  /**
   * Delete discount code (ADMIN)
   * @param {number} discountId
   * @returns {Promise}
   */
  deleteDiscountCode: async (discountId) => {
    console.log('Deleting discount code:', { discountId });
    const response = await axiosInstance.delete(`/admin/discount-codes/${discountId}`);
    return response.data;
  },

  /**
   * Get all subscriptions (ADMIN)
   * @param {Object} filters - { status, head_id, learner_id, limit }
   * @returns {Promise} - Array of subscriptions
   */
  getAllSubscriptionsAdmin: async (filters = {}) => {
    console.log('Fetching all subscriptions (ADMIN):', filters);
    const response = await axiosInstance.get('/admin/subscriptions', {
      params: filters
    });
    return response.data;
  },

  /**
   * Get subscription details (ADMIN)
   * @param {number} subscriptionId
   * @returns {Promise} - Subscription details
   */
  getSubscriptionByIdAdmin: async (subscriptionId) => {
    console.log('Fetching subscription details (ADMIN):', { subscriptionId });
    const response = await axiosInstance.get(`/admin/subscriptions/${subscriptionId}`);
    return response.data;
  },

  /**
   * Get subscription statistics (ADMIN)
   * @returns {Promise} - Statistics object
   */
  getSubscriptionStats: async () => {
    console.log('Fetching subscription statistics');
    const response = await axiosInstance.get('/admin/subscriptions/stats');
    return response.data;
  },

  /**
   * Get revenue by HEAD (ADMIN)
   * @param {string} startDate - Optional start date (YYYY-MM-DD)
   * @param {string} endDate - Optional end date (YYYY-MM-DD)
   * @returns {Promise} - Revenue data by HEAD
   */
  getRevenueByHead: async (startDate = null, endDate = null) => {
    console.log('Fetching revenue by HEAD:', { startDate, endDate });
    const response = await axiosInstance.get('/admin/revenue/by-head', {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  },

  /**
   * Adjust sessions (ADMIN - unlimited)
   * @param {number} subscriptionId
   * @param {Object} adjustmentData
   * @returns {Promise} - Adjustment log
   */
  adjustSessionsAdmin: async (subscriptionId, adjustmentData) => {
    console.log('Adjusting sessions (ADMIN):', { subscriptionId, adjustmentData });
    const response = await axiosInstance.post(`/admin/subscriptions/${subscriptionId}/adjust-sessions`, adjustmentData);
    return response.data;
  },
};

export default subscriptionService;
