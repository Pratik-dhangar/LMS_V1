import api from '../axios';

const programAssignmentService = {
  // ============= HEAD METHODS =============

  // Create program assignments (bulk)
  createAssignments: async (data) => {
    const response = await api.post('/program-assignments/head/assignments', data);
    return response.data;
  },

  // Get program assignments with optional filters
  getAssignments: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.learner_id) params.append('learner_id', filters.learner_id);
    if (filters.status) params.append('status', filters.status);

    const response = await api.get(`/program-assignments/head/assignments?${params.toString()}`);
    return response.data;
  },

  // Get assignment details
  getAssignmentById: async (assignmentId) => {
    const response = await api.get(`/program-assignments/head/assignments/${assignmentId}`);
    return response.data;
  },

  // Get completion stats for a learner
  getCompletionStats: async (learnerId) => {
    const response = await api.get(`/program-assignments/head/assignments/stats/${learnerId}`);
    return response.data;
  },

  // Update assignment
  updateAssignment: async (assignmentId, data) => {
    const response = await api.patch(`/program-assignments/head/assignments/${assignmentId}`, data);
    return response.data;
  },

  // Delete assignment
  deleteAssignment: async (assignmentId) => {
    await api.delete(`/program-assignments/head/assignments/${assignmentId}`);
  },

  // Upload attachment
  uploadAttachment: async (assignmentId, file, description = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);

    const response = await api.post(
      `/program-assignments/head/assignments/${assignmentId}/attachments`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  // Get attachments
  getAttachments: async (assignmentId) => {
    const response = await api.get(`/program-assignments/head/assignments/${assignmentId}/attachments`);
    return response.data;
  },

  // Delete attachment
  deleteAttachment: async (attachmentId) => {
    await api.delete(`/program-assignments/head/assignments/attachments/${attachmentId}`);
  },

  // ============= LEARNER METHODS =============

  // Get my learning contents
  getMyLearningContents: async () => {
    const response = await api.get('/program-assignments/learner/my-learning-contents');
    return response.data;
  },

  // Get my assignments
  getMyAssignments: async (status = null) => {
    const params = status ? `?status=${status}` : '';
    const response = await api.get(`/program-assignments/learner/assignments${params}`);
    return response.data;
  },

  // Get my assignment details
  getMyAssignmentById: async (assignmentId) => {
    const response = await api.get(`/program-assignments/learner/assignments/${assignmentId}`);
    return response.data;
  },

  // Get my completion stats
  getMyStats: async () => {
    const response = await api.get('/program-assignments/learner/assignments/stats');
    return response.data;
  },

  // Update my assignment (learner notes and status only)
  updateMyAssignment: async (assignmentId, data) => {
    const response = await api.patch(`/program-assignments/learner/assignments/${assignmentId}`, data);
    return response.data;
  },

  // Mark assignment as complete
  markComplete: async (assignmentId) => {
    const response = await api.patch(`/program-assignments/learner/assignments/${assignmentId}`, {
      completion_status: 'COMPLETED'
    });
    return response.data;
  },

  // Upload my attachment
  uploadMyAttachment: async (assignmentId, file, description = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (description) formData.append('description', description);

    const response = await api.post(
      `/program-assignments/learner/assignments/${assignmentId}/attachments`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  // ============= ADMIN METHODS (Program-Content Management) =============

  // Add content to program
  addContentToProgram: async (programId, contentId, sequenceOrder = null) => {
    const formData = new FormData();
    formData.append('content_id', contentId);
    if (sequenceOrder !== null) formData.append('sequence_order', sequenceOrder);

    const response = await api.post(`/admin/learning-goals/${programId}/contents`, formData);
    return response.data;
  },

  // Get program contents (for Admin)
  getAdminProgramContents: async (programId) => {
    const response = await api.get(`/admin/learning-goals/${programId}/contents`);
    return response.data;
  },

  // Get program contents (for Head)
  getProgramContents: async (programId) => {
    const response = await api.get(`/program-assignments/head/programs/${programId}/contents`);
    return response.data;
  },

  // Get assignments overview grouped by learner
  getAssignmentsOverview: async () => {
    const response = await api.get('/program-assignments/head/assignments/overview');
    return response.data;
  },

  // Reorder program contents
  reorderProgramContents: async (programId, contentOrders) => {
    const response = await api.patch(`/admin/learning-goals/${programId}/contents/reorder`, contentOrders);
    return response.data;
  },

  // Remove content from program
  removeContentFromProgram: async (programId, contentId) => {
    await api.delete(`/admin/learning-goals/${programId}/contents/${contentId}`);
  },

  // Get all learning contents for a specific assignment (auto + manual)
  getAssignmentLearnerContents: async (assignmentId) => {
    const response = await api.get(`/program-assignments/head/assignments/${assignmentId}/learner-contents`);
    return response.data;
  },

  // ============= CONTENT STATUS METHODS =============

  // Learner: Start content
  startContent: async (contentAssignmentId) => {
    const response = await api.patch(`/program-assignments/content-assignments/${contentAssignmentId}/start`);
    return response.data;
  },

  // Learner: Submit content
  submitContent: async (contentAssignmentId) => {
    const response = await api.patch(`/program-assignments/content-assignments/${contentAssignmentId}/submit`);
    return response.data;
  },

  // Head: Review content
  reviewContent: async (contentAssignmentId) => {
    const response = await api.patch(`/program-assignments/head/content-assignments/${contentAssignmentId}/review`);
    return response.data;
  },

  // Head: Submit feedback on content
  submitFeedback: async (contentAssignmentId, feedbackData) => {
    const response = await api.patch(
      `/program-assignments/head/content-assignments/${contentAssignmentId}/review`,
      feedbackData
    );
    return response.data;
  },

  // Head: Submit final feedback on program assignment
  submitFinalFeedback: async (assignmentId, feedbackData) => {
    const response = await api.post(
      `/program-assignments/head/assignments/${assignmentId}/final-feedback`,
      feedbackData
    );
    return response.data;
  },

  // Learner: Get content assignment with feedback
  getContentAssignmentFeedback: async (contentAssignmentId) => {
    const response = await api.get(`/program-assignments/learner/content-assignments/${contentAssignmentId}/feedback`);
    return response.data;
  },

  // Learner: Resubmit content
  resubmitContent: async (contentAssignmentId) => {
    const response = await api.patch(`/program-assignments/learner/content-assignments/${contentAssignmentId}/resubmit`);
    return response.data;
  },
};

export default programAssignmentService;
