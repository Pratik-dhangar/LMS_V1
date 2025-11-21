import axios from '../axios';

const learningContentAssignmentService = {
  // Get all learners for assignment dropdown
  getLearners: async () => {
    try {
      const response = await axios.get('/learning-content-assignments/learners');
      return response.data;
    } catch (error) {
      console.error('Error fetching learners:', error);
      throw error;
    }
  },

  // Get all learning contents for assignment dropdown
  getContents: async () => {
    try {
      const response = await axios.get('/learning-content-assignments/contents');
      return response.data;
    } catch (error) {
      console.error('Error fetching contents:', error);
      throw error;
    }
  },

  // Assign learning content to learner
  assignContent: async (assignmentData) => {
    try {
      const response = await axios.post('/learning-content-assignments/', assignmentData);
      return response.data;
    } catch (error) {
      console.error('Error assigning content:', error);
      throw error;
    }
  },

  // Get assignments by learner ID
  getAssignmentsByLearner: async (learnerId) => {
    try {
      const response = await axios.get(`/learning-content-assignments/by-learner/${learnerId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching assignments:', error);
      throw error;
    }
  },

  // Revoke assignment
  revokeAssignment: async (assignmentId) => {
    try {
      await axios.delete(`/learning-content-assignments/${assignmentId}`);
    } catch (error) {
      console.error('Error revoking assignment:', error);
      throw error;
    }
  }
};

export default learningContentAssignmentService;
