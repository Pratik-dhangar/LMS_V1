import axiosInstance from '../axios';

/**
 * Head Service
 * Handles head-specific API calls
 */
const headService = {
  // Trainer Management APIs
  /**
   * Create a new Trainer
   * @param {FormData} trainerData 
   * @returns {Promise} 
   */
  createTrainer: async (trainerData) => {
    console.log('Creating new trainer with FormData');
    const response = await axiosInstance.post('/head/trainers', trainerData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
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
   * @param {FormData} updateData
   * @returns {Promise} - Updated trainer object
   */
  updateTrainer: async (trainerId, updateData) => {
    const response = await axiosInstance.patch(`/head/trainers/${trainerId}`, updateData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
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

  /**
   * Delete a trainer reference file
   * @param {number} trainerId
   * @param {number} referenceId
   * @returns {Promise}
   */
  deleteTrainerReferenceFile: async (trainerId, referenceId) => {
    const response = await axiosInstance.delete(`/head/trainers/${trainerId}/reference/${referenceId}`);
    return response.data;
  },


  // Learner Management APIs
  /**
   * Create a new Learner
   * @param {Object} learnerData - Learner data
   * @param {Array<File>} referenceFiles - Optional reference files
   * @returns {Promise}
   */
  createLearner: async (learnerData, referenceFiles = []) => {
    console.log('Creating new learner:', { name: learnerData.name });
    
    const formData = new FormData();
    
    // Append learner_data as JSON string
    formData.append('learner_data', JSON.stringify(learnerData));
    
    // Append reference files if any
    if (referenceFiles && referenceFiles.length > 0) {
      referenceFiles.forEach((file) => {
        formData.append('reference_files', file);
      });
    }
    
    const response = await axiosInstance.post('/head/learners', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
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
   * @param {Array<File>} referenceFiles - Optional reference files
   * @returns {Promise} - Updated learner object
   */
  updateLearner: async (learnerId, updateData, referenceFiles = []) => {
    const formData = new FormData();
    
    // Always append learner_update as JSON string (even if empty)
    formData.append('learner_update', JSON.stringify(updateData));
    
    // Append reference files if any
    if (referenceFiles && referenceFiles.length > 0) {
      referenceFiles.forEach((file) => {
        formData.append('reference_files', file);
      });
    }
    
    const response = await axiosInstance.patch(`/head/learners/${learnerId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
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
   * Delete a learner reference file
   * @param {number} learnerId
   * @param {number} referenceId
   * @returns {Promise}
   */
  deleteLearnerReferenceFile: async (learnerId, referenceId) => {
    const response = await axiosInstance.delete(`/head/learners/${learnerId}/reference/${referenceId}`);
    return response.data;
  },

  // Coach Management APIs (ADMIN ONLY)
  /**
   * Create a new Coach (ADMIN ONLY - use /admin/coaches instead)
   * @param {Object} coachData 
   * @returns {Promise} 
   */
  createCoach: async (coachData) => {
    console.log('Creating new coach:', { name: coachData.get ? coachData.get('name') : coachData.name });
    const response = await axiosInstance.post('/admin/coaches', coachData);
    console.log('Coach created successfully:', { id: response.data.id, passcode: response.data.passcode });
    return response.data;
  },

  /**
   * Get all Coaches (ADMIN - all coaches in system)
   * @returns {Promise} 
   */
  getAllCoaches: async () => {
    console.log('Fetching all Coaches (admin)');
    const response = await axiosInstance.get('/admin/coaches');
    console.log('Received coaches data:', { count: response.data.length });
    return response.data;
  },

  /**
   * Get Coach by ID (ADMIN or HEAD)
   * @param {number} coachId
   * @returns {Promise} - Coach object
   */
  getCoachById: async (coachId) => {
    console.log('Fetching coach details:', { coachId });
    const response = await axiosInstance.get(`/admin/coaches/${coachId}`);
    console.log('Coach details received:', { id: response.data.id, name: response.data.name });
    return response.data;
  },

  /**
   * Update Coach (ADMIN ONLY)
   * @param {number} coachId
   * @param {Object} updateData
   * @returns {Promise} - Updated coach object
   */
  updateCoach: async (coachId, updateData) => {
    const response = await axiosInstance.patch(`/admin/coaches/${coachId}`, updateData);
    return response.data;
  },

  /**
   * Delete Coach (HEAD only - deletes their own coach)
   * @param {number} coachId
   * @returns {Promise} - Success message
   */
  deleteCoach: async (coachId) => {
    const response = await axiosInstance.delete(`/head/coaches/${coachId}`);
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
