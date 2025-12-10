import axios from '../axios';

const sessionReportService = {
  // Create a new session report
  create: async (reportData) => {
    try {
      const response = await axios.post('/session-reports/', reportData);
      return response.data;
    } catch (error) {
      console.error('Error creating session report:', error);
      console.error('Error response data:', error.response?.data);
      console.error('Error response status:', error.response?.status);
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

  // Get overall statistics across all learners (Head only)
  getOverallStatistics: async () => {
    try {
      const response = await axios.get('/session-reports/overall/statistics');
      return response.data;
    } catch (error) {
      console.error('Error fetching overall statistics:', error);
      throw error;
    }
  },

  // Get statistics for a specific program of a learner
  getProgramStatistics: async (learnerId, programName) => {
    try {
      const response = await axios.get(`/session-reports/learner/${learnerId}/program/${encodeURIComponent(programName)}/statistics`);
      return response.data;
    } catch (error) {
      console.error('Error fetching program statistics:', error);
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
  },

  // Get unique learners from session reports (Head only)
  getUniqueLearners: async () => {
    try {
      const response = await axios.get('/session-reports/unique-learners');
      return response.data;
    } catch (error) {
      console.error('Error fetching unique learners:', error);
      throw error;
    }
  },

  // Get all programs/goals for a specific learner (Head only)
  getLearnerPrograms: async (learnerId) => {
    try {
      const response = await axios.get(`/session-reports/learner/${learnerId}/programs`);
      return response.data;
    } catch (error) {
      console.error('Error fetching learner programs:', error);
      throw error;
    }
  },

  // Get session data for a specific program/goal (Head only)
  getProgramSessionData: async (learnerId, programName) => {
    try {
      const response = await axios.get(
        `/session-reports/learner/${learnerId}/program-sessions`,
        {
          params: { program_name: programName }
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching program session data:', error);
      throw error;
    }
  }
};

export default sessionReportService;
