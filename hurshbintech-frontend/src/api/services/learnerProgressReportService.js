import axios from '../axios';

const learnerProgressReportService = {
    // Create a new progress report
    create: async (reportData) => {
        try {
            const response = await axios.post('/learner-progress-reports/', reportData);
            return response.data;
        } catch (error) {
            console.error('Error creating learner progress report:', error);
            throw error;
        }
    },

    // Get all reports
    getAll: async (skip = 0, limit = 100) => {
        try {
            const response = await axios.get(`/learner-progress-reports/?skip=${skip}&limit=${limit}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching progress reports:', error);
            throw error;
        }
    },

    // Get reports for a specific learner (called by Head/Coach/Admin)
    getByLearner: async (learnerId) => {
        try {
            const response = await axios.get(`/learner-progress-reports/learner/${learnerId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching learner progress reports:', error);
            throw error;
        }
    },

    // Get reports for the currently logged-in learner (called by Learner role)
    getMyReports: async () => {
        try {
            const response = await axios.get('/learner-progress-reports/my-reports');
            return response.data;
        } catch (error) {
            console.error('Error fetching my progress reports:', error);
            throw error;
        }
    },

    // Get a single report by ID
    getById: async (reportId) => {
        try {
            const response = await axios.get(`/learner-progress-reports/${reportId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching progress report:', error);
            throw error;
        }
    },

    // Update a report
    update: async (reportId, updateData) => {
        try {
            const response = await axios.put(`/learner-progress-reports/${reportId}`, updateData);
            return response.data;
        } catch (error) {
            console.error('Error updating progress report:', error);
            throw error;
        }
    },

    // Delete a report
    delete: async (reportId) => {
        try {
            await axios.delete(`/learner-progress-reports/${reportId}`);
        } catch (error) {
            console.error('Error deleting progress report:', error);
            throw error;
        }
    },

    // Upload PDF to S3 (only active on deploy when USE_S3=true; silently skipped on local)
    uploadPDF: async (reportId, pdfBlob) => {
        try {
            const formData = new FormData();
            formData.append('file', pdfBlob, `progress_report_${reportId}.pdf`);
            const response = await axios.post(
                `/learner-progress-reports/${reportId}/upload-pdf`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            return response.data;
        } catch (error) {
            // Non-fatal: log but don't break the UI
            console.warn('PDF S3 upload skipped or failed:', error?.response?.data?.detail || error.message);
            return null;
        }
    },

    // Send Final Progress Report email to learner (Coach/Head only)
    sendFinalReportEmail: async (reportId, sentByName = '') => {
        try {
            const response = await axios.post(`/learner-progress-reports/${reportId}/send-email`, {
                sent_by_name: sentByName || null,
            });
            return response.data;
        } catch (error) {
            console.error('Error sending final report email:', error);
            throw error;
        }
    },
};

export default learnerProgressReportService;
