import axiosInstance from '../axios';

/**
 * Head Service
 * Handles head-specific API calls
 */
const headService = {
  /**
   * Get Dashboard Statistics
   * @returns {Promise} - Dashboard stats object
   */
  getDashboardStats: async () => {
    console.log('Fetching dashboard statistics');
    const response = await axiosInstance.get('/head/dashboard/stats');
    console.log('Dashboard stats received:', { stats: response.data });
    return response.data;
  },

  // Trainer Management APIs
  /**
   * Create a new Trainer
   * @param {Object} trainerData 
   * @returns {Promise} 
   */
  createTrainer: async (trainerData) => {
    console.log('Creating new trainer:', { name: trainerData.name, contactNo: trainerData.contact_no });
    const response = await axiosInstance.post('/head/trainers', trainerData);
    console.log('Trainer created successfully:', { id: response.data.id, passcode: response.data.passcode });
    return response.data;
  },

  /**
   * Get all Trainers
   * @returns {Promise} 
   */
  getAllTrainers: async () => {
    console.log('Fetching all Trainers');
    const response = await axiosInstance.get('/head/trainers');
    console.log('Received trainers data:', { count: response.data.length });
    return response.data;
  },

  /**
   * Get Trainer by ID
   * @param {number} trainerId
   * @returns {Promise} - Trainer object
   */
  getTrainerById: async (trainerId) => {
    console.log('Fetching trainer details:', { trainerId });
    const response = await axiosInstance.get(`/head/trainers/${trainerId}`);
    console.log('Trainer details received:', { id: response.data.id, name: response.data.name });
    return response.data;
  },

  /**
   * Update Trainer
   * @param {number} trainerId
   * @param {Object} updateData
   * @returns {Promise} - Updated trainer object
   */
  updateTrainer: async (trainerId, updateData) => {
    const response = await axiosInstance.patch(`/head/trainers/${trainerId}`, updateData);
    return response.data;
  },

  /**
   * Delete Trainer
   * @param {number} trainerId
   * @returns {Promise} - Success message
   */
  deleteTrainer: async (trainerId) => {
    const response = await axiosInstance.delete(`/head/trainers/${trainerId}`);
    return response.data;
  },


  // Learner Management APIs
  /**
   * Create a new Learner
   * @param {Object} learnerData
   * @returns {Promise}
   */
  createLearner: async (learnerData) => {
    console.log('Creating new learner:', { name: learnerData.name });
    const response = await axiosInstance.post('/head/learners', learnerData);
    console.log('Learner created successfully:', { id: response.data.id, passcode: response.data.passcode });
    return response.data;
  },

  /**
   * Get all Learners
   * @returns {Promise}
   */
  getAllLearners: async () => {
    console.log('Fetching all Learners');
    const response = await axiosInstance.get('/head/learners');
    console.log('Received learners data:', { count: response.data.length });
    return response.data;
  },


  /**
   * Get Learner by ID
   * @param {number} learnerId
   * @returns {Promise} - Learner object
   */
  getLearnerById: async (learnerId) => {
    console.log('Fetching learner details:', { learnerId });
    const response = await axiosInstance.get(`/head/learners/${learnerId}`);
    console.log('Learner details received:', { id: response.data.id, name: response.data.name });
    return response.data;
  },

  /**
   * Update Learner
   * @param {number} learnerId
   * @param {Object} updateData
   * @returns {Promise} - Updated learner object
   */
  updateLearner: async (learnerId, updateData) => {
    const response = await axiosInstance.patch(`/head/learners/${learnerId}`, updateData);
    return response.data;
  },


  /**
   * Delete Learner
   * @param {number} learnerId
   * @returns {Promise} - Success message
   */
  deleteLearner: async (learnerId) => {
    const response = await axiosInstance.delete(`/head/learners/${learnerId}`);
    return response.data;
  },

  /**
   * Reveal (decrypt) a user's passcode
   * @param {number} userId - The user ID to reveal passcode for
   * @returns {Promise} - Object containing decrypted passcode
   */
  revealPasscode: async (userId) => {
    console.log('Revealing passcode for user:', { userId });
    const response = await axiosInstance.get(`/head/users/${userId}/reveal-passcode`);
    console.log('Passcode revealed successfully');
    return response.data;
  },
};


export default headService;
