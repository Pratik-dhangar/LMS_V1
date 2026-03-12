import axiosInstance from '../axios';

/**
 * Admin Service
 * Handles admin-specific API calls
 */
const adminService = {
  /**
   * Create a new Head
   * @param {Object} headData 
   * @returns {Promise} 
   */
  createHead: async (headData) => {
    console.log('Creating new head:', { name: headData.name, contactNumber: headData.contact_number });
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
   * Delete Head Reference File
   * @param {number} headId
   * @param {number} referenceId
   * @returns {Promise} - Success message
   */
  deleteHeadReferenceFile: async (headId, referenceId) => {
    const response = await axiosInstance.delete(`/admin/heads/${headId}/reference/${referenceId}`);
    return response.data;
  },

  /**
   * Delete Coach Reference File
   * @param {number} coachId
   * @param {number} referenceId
   * @returns {Promise} - Success message
   */
  deleteCoachReferenceFile: async (coachId, referenceId) => {
    const response = await axiosInstance.delete(`/admin/coaches/${coachId}/reference/${referenceId}`);
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
   * @returns {Promise} - Array of coach objects
   */
  getAllConsultants: async () => {
    console.log('Fetching all coaches (admin view)');
    const response = await axiosInstance.get('/admin/coaches');
    console.log('Received coaches data:', { count: response.data.length });
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

  /**
   * Get all appointments (admin view)
   * @param {Object} params - Optional filters: guest_only (bool), status_filter (string)
   * @returns {Promise} - Array of appointment objects
   */
  getAppointments: async (params = {}) => {
    const response = await axiosInstance.get('/admin/appointments', { params });
    return response.data;
  },

  /**
   * Update appointment status (admin)
   * @param {number} appointmentId
   * @param {Object} data - e.g. { status: 'confirmed' }
   * @returns {Promise} - Updated appointment object
   */
  updateAppointmentStatus: async (appointmentId, data) => {
    const response = await axiosInstance.patch(`/admin/appointments/${appointmentId}`, data);
    return response.data;
  },

  /**
   * Delete an appointment record (admin)
   * @param {number} appointmentId
   */
  deleteAppointment: async (appointmentId) => {
    await axiosInstance.delete(`/admin/appointments/${appointmentId}`);
  },
};

export default adminService;
