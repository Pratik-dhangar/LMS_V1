import axiosInstance from '../../axios';
import logger from '../../../utils/logger';

/**
 * Webinar Service
 * Handles all webinar-related API calls
 */
const webinarService = {
  /**
   * Create a new webinar
   * @param {Object} webinarData - { title, description, meeting_link, scheduled_date, scheduled_time, participant_user_ids, unregistered_emails }
   * @returns {Promise} - Created webinar object
   */
  createWebinar: async (webinarData) => {
    try {
      logger.debug('webinarService - Creating webinar:', { title: webinarData.title });
      const response = await axiosInstance.post('/communication/webinars', webinarData);
      logger.debug('Webinar created successfully:', { id: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('webinarService create error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        fullError: error
      });
      throw error;
    }
  },

  /**
   * Get all webinars
   * @param {number} skip - Pagination skip
   * @param {number} limit - Pagination limit
   * @returns {Promise} - Array of webinars
   */
  getAllWebinars: async (skip = 0, limit = 100) => {
    try {
      logger.debug('webinarService - Fetching all webinars');
      const response = await axiosInstance.get('/communication/webinars', {
        params: { skip, limit }
      });
      logger.debug('Received webinars:', { count: response.data.length });
      return response.data;
    } catch (error) {
      logger.error('webinarService getAllWebinars error:', error);
      throw error;
    }
  },

  /**
   * Get webinars created by current user
   * @param {number} skip - Pagination skip
   * @param {number} limit - Pagination limit
   * @returns {Promise} - Array of webinars
   */
  getMyWebinars: async (skip = 0, limit = 100) => {
    try {
      logger.debug('webinarService - Fetching my webinars');
      const response = await axiosInstance.get('/communication/webinars/my-webinars', {
        params: { skip, limit }
      });
      logger.debug('Received my webinars:', { count: response.data.length });
      return response.data;
    } catch (error) {
      logger.error('webinarService getMyWebinars error:', error);
      throw error;
    }
  },

  /**
   * Get webinars where current user is invited as a participant
   * @param {number} skip - Pagination skip
   * @param {number} limit - Pagination limit
   * @returns {Promise} - Array of webinars
   */
  getMyInvitedWebinars: async (skip = 0, limit = 100) => {
    try {
      logger.debug('webinarService - Fetching my invited webinars');
      const response = await axiosInstance.get('/communication/webinars/my-invitations', {
        params: { skip, limit }
      });
      logger.debug('Received my invited webinars:', { count: response.data.length });
      return response.data;
    } catch (error) {
      logger.error('webinarService getMyInvitedWebinars error:', error);
      throw error;
    }
  },

  /**
   * Get webinar by ID
   * @param {number} webinarId
   * @returns {Promise} - Webinar object with full details
   */
  getWebinarById: async (webinarId) => {
    try {
      logger.debug('webinarService - Fetching webinar:', { webinarId });
      const response = await axiosInstance.get(`/communication/webinars/${webinarId}`);
      logger.debug('Received webinar details:', { id: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('webinarService getWebinarById error:', error);
      throw error;
    }
  },

  /**
   * Update webinar
   * @param {number} webinarId
   * @param {Object} updateData - { title, description, meeting_link, scheduled_date, scheduled_time }
   * @returns {Promise} - Updated webinar object
   */
  updateWebinar: async (webinarId, updateData) => {
    try {
      logger.debug('webinarService - Updating webinar:', { webinarId });
      const response = await axiosInstance.patch(`/communication/webinars/${webinarId}`, updateData);
      logger.debug('Webinar updated successfully:', { id: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('webinarService updateWebinar error:', error);
      throw error;
    }
  },

  /**
   * Delete webinar
   * @param {number} webinarId
   * @returns {Promise}
   */
  deleteWebinar: async (webinarId) => {
    try {
      logger.debug('webinarService - Deleting webinar:', { webinarId });
      await axiosInstance.delete(`/communication/webinars/${webinarId}`);
      logger.debug('Webinar deleted successfully');
    } catch (error) {
      logger.error('webinarService deleteWebinar error:', error);
      throw error;
    }
  },

  /**
   * Resend invitations to all participants
   * @param {number} webinarId
   * @returns {Promise} - { message, sent_count, total_participants }
   */
  resendInvitations: async (webinarId) => {
    try {
      logger.debug('webinarService - Resending invitations:', { webinarId });
      const response = await axiosInstance.post(`/communication/webinars/${webinarId}/resend-invitations`);
      logger.debug('Invitations resent:', response.data);
      return response.data;
    } catch (error) {
      logger.error('webinarService resendInvitations error:', error);
      throw error;
    }
  },

  /**
   * Get all registered users for participant selection
   * @returns {Promise} - Array of users
   */
  getRegisteredUsers: async () => {
    try {
      logger.debug('webinarService - Fetching registered users');
      const response = await axiosInstance.get('/communication/webinars/users/registered');
      logger.debug('Received registered users:', { count: response.data.length });
      return response.data;
    } catch (error) {
      logger.error('webinarService getRegisteredUsers error:', error);
      throw error;
    }
  }
};

export default webinarService;
