import axios from '../axios';

const sessionReportService = {
  // Create a new session report
  create: async (reportData) => {
    try {
      const response = await axios.post('/session-reports/', reportData);
      return response.data;
    } catch (error) {
      console.error('Error creating session report:', error);
      throw error;
    }
  },

  // Get all reports for a session
  getBySession: async (sessionId) => {
    try {
      const response = await axios.get(`/session-reports/session/${sessionId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching session reports:', error);
      throw error;
    }
  },

  // Get all reports for a learner
  getByLearner: async (learnerId) => {
    try {
      const response = await axios.get(`/session-reports/learner/${learnerId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching learner reports:', error);
      throw error;
    }
  },

  // Get learner reports grouped by program
  getByLearnerGrouped: async (learnerId) => {
    try {
      const response = await axios.get(`/session-reports/learner/${learnerId}/grouped`);
      return response.data;
    } catch (error) {
      console.error('Error fetching grouped learner reports:', error);
      throw error;
    }
  },

  // Get statistics for a learner (for charts)
  getStatistics: async (learnerId) => {
    try {
      const response = await axios.get(`/session-reports/learner/${learnerId}/statistics`);
      return response.data;
    } catch (error) {
      console.error('Error fetching learner statistics:', error);
      throw error;
    }
  },

  // Get all learners with report summaries (Head only)
  getLearnersSummary: async () => {
    try {
      const response = await axios.get('/session-reports/learners/summary');
      return response.data;
    } catch (error) {
      console.error('Error fetching learners summary:', error);
      throw error;
    }
  },

  // Delete a session report
  delete: async (reportId) => {
    try {
      await axios.delete(`/session-reports/${reportId}`);
    } catch (error) {
      console.error('Error deleting session report:', error);
      throw error;
    }
  }
};

export default sessionReportService;
