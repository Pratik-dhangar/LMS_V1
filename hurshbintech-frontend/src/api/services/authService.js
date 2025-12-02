import axiosInstance from '../axios';
import logger from '../../utils/logger';

/**
 * Authentication Service
 * Handles all authentication-related API calls
 */
const authService = {

  /**
   * User Login (Admin/Head/Trainer/Consultant/Learner)
   * @param {Object} credentials - { role, passcode }
   * @returns {Promise} - { access_token, token_type, user_id, role, name }
   */
  userLogin: async (credentials) => {
    try {
      logger.debug('authService - Login attempt with credentials:', {
        role: credentials.role,
        hasPasscode: !!credentials.passcode
      });

      const response = await axiosInstance.post('/auth/user/login', credentials);
      logger.debug('Login successful:', { userId: response.data.user_id, role: response.data.role });
      return response.data;
    } catch (error) {
      logger.error('authService login error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      throw error;
    }
  },  /**
    * Logout - Clear local storage
    */
  logout: () => {
    logger.debug('User logging out');
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_data');
  },

  /**
   * Get current user data from localStorage
   */
  getCurrentUser: () => {
    const userData = localStorage.getItem('user_data');
    const user = userData ? JSON.parse(userData) : null;
    console.log('Current user data:', { user });
    return user;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: () => {
    return !!localStorage.getItem('access_token');
  },
};

export default authService;
