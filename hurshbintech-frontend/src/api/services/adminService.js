import axiosInstance from '../axios';

/**
 * Admin Service
 * Handles admin-specific API calls
 */
const adminService = {
  /**
   * Get Dashboard Statistics
   * @returns {Promise} - Dashboard stats object
   */
  getDashboardStats: async () => {
    console.log('Fetching dashboard statistics');
    const response = await axiosInstance.get('/admin/dashboard/stats');
    console.log('Dashboard stats received:', { stats: response.data });
    return response.data;
  },

  /**
   * Create a new Head
   * @param {Object} headData 
   * @returns {Promise} 
   */
  createHead: async (headData) => {
    console.log('Creating new head:', { name: headData.name, contactNo: headData.contact_no });
    const response = await axiosInstance.post('/admin/heads', headData);
    console.log('Head created successfully:', { id: response.data.id, passcode: response.data.passcode });
    return response.data;
  },

  /**
   * Get all Heads
   * @returns {Promise} 
   */
  getAllHeads: async () => {
    console.log('Fetching all heads');
    const response = await axiosInstance.get('/admin/heads');
    console.log('Received heads data:', { count: response.data.length });
    return response.data;
  },

  /**
   * Get Head by ID
   * @param {number} headId
   * @returns {Promise} - Head object
   */
  getHeadById: async (headId) => {
    console.log('Fetching head details:', { headId });
    const response = await axiosInstance.get(`/admin/heads/${headId}`);
    console.log('Head details received:', { id: response.data.id, name: response.data.name });
    return response.data;
  },

  /**
   * Update Head
   * @param {number} headId
   * @param {Object} updateData
   * @returns {Promise} - Updated head object
   */
  updateHead: async (headId, updateData) => {
    const response = await axiosInstance.patch(`/admin/heads/${headId}`, updateData);
    return response.data;
  },

  /**
   * Delete Head
   * @param {number} headId
   * @returns {Promise} - Success message
   */
  deleteHead: async (headId) => {
    const response = await axiosInstance.delete(`/admin/heads/${headId}`);
    return response.data;
  },

  /**
   * Get all Trainers (system-wide, read-only)
   * @returns {Promise} - Array of trainer objects
   */
  getAllTrainers: async () => {
    console.log('Fetching all trainers (admin view)');
    const response = await axiosInstance.get('/admin/trainers');
    console.log('Received trainers data:', { count: response.data.length });
    return response.data;
  },

  /**
   * Get all Learners (system-wide, read-only)
   * @returns {Promise} - Array of learner objects
   */
  getAllLearners: async () => {
    console.log('Fetching all learners (admin view)');
    const response = await axiosInstance.get('/admin/learners');
    console.log('Received learners data:', { count: response.data.length });
    return response.data;
  },

  /**
   * Get all Consultants/Coaches (system-wide, read-only)
   * @returns {Promise} - Array of consultant objects
   */
  getAllConsultants: async () => {
    console.log('Fetching all consultants (admin view)');
    const response = await axiosInstance.get('/admin/consultants');
    console.log('Received consultants data:', { count: response.data.length });
    return response.data;
  },

  /**
   * Reveal (decrypt) a user's passcode (admin)
   * @param {number} userId - The user ID to reveal passcode for
   * @returns {Promise} - Object containing decrypted passcode
   */
  revealPasscode: async (userId) => {
    console.log('Admin revealing passcode for user:', { userId });
    const response = await axiosInstance.get(`/admin/users/${userId}/reveal-passcode`);
    console.log('Admin passcode reveal response received');
    return response.data;
  },
};

export default adminService;
