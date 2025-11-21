  import axiosInstance from '../axios';

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
      console.log('authService - Login attempt with full credentials:', { 
        role: credentials.role, 
        passcode: credentials.passcode ? ('***' + credentials.passcode.slice(-2)) : 'MISSING PASSCODE',
        hasPasscode: !!credentials.passcode,
        passcodeType: typeof credentials.passcode,
        fullCredentials: JSON.stringify(credentials)
      });
      
      const response = await axiosInstance.post('/auth/user/login', credentials);
      console.log('Login successful:', { userId: response.data.user_id, role: response.data.role });
      return response.data;
    } catch (error) {
      console.error('authService login error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        hasResponse: !!error.response,
        isNetworkError: error.message === 'Network Error',
        errorCode: error.code,
        config: error.config ? {
          url: error.config.url,
          method: error.config.method,
          data: error.config.data
        } : 'no config'
      });
      throw error;
    }
  },  /**
    * Logout - Clear local storage
    */
    logout: () => {
      console.log('User logging out');
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
