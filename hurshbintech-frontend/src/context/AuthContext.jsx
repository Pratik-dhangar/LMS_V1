import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../api/services/authService';
import { toast } from 'react-toastify';
import logger from '../utils/logger';
import { useDeviceSession, getDeviceInfo } from '../hooks/useDeviceSession';
import SessionInvalidatedModal from '../components/SessionInvalidatedModal';

// Create Auth Context
const AuthContext = createContext(null);

/**
 * Custom hook to use auth context
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

/**
 * Auth Provider Component
 * Manages authentication state globally
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(null);
  const [showSessionInvalidatedModal, setShowSessionInvalidatedModal] = useState(false);
  const navigate = useNavigate();

  // Callback for session invalidation modal
  const handleShowSessionInvalidatedModal = () => {
    setShowSessionInvalidatedModal(true);
  };

  // Handle logout from session invalidated modal
  const handleSessionInvalidatedLogout = () => {
    logger.info('AuthContext: Logging out from session invalidated modal');
    setShowSessionInvalidatedModal(false);
    // Clear auth state
    authService.logout();
    setUser(null);
    setAccessToken(null);
    // Navigate to login
    navigate('/login');
  };

  // Initialize device session management with modal callback
  const { deviceInfo, isConnected } = useDeviceSession(accessToken, handleShowSessionInvalidatedModal);

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = () => {
      logger.debug('Loading user from localStorage');
      const userData = authService.getCurrentUser();
      const token = localStorage.getItem('access_token');

      if (userData && token) {
        logger.debug('User authenticated from localStorage:', { id: userData.id, role: userData.role });
        setUser(userData);
        setAccessToken(token);
      } else {
        logger.debug('No authenticated user found in localStorage');
      }
      setLoading(false);
    };

    loadUser();
  }, []);


  /**
   * User Login
   */
  const userLogin = async (credentials) => {
    try {
      logger.debug('AuthContext: Processing login for role:', { role: credentials.role });

      // Add device information to credentials
      const deviceInfo = getDeviceInfo();
      const loginCredentials = {
        ...credentials,
        ...deviceInfo,
      };

      logger.debug('AuthContext: Sending device info with login:', {
        device_id: deviceInfo.device_id,
        device_type: deviceInfo.device_type,
      });

      const response = await authService.userLogin(loginCredentials);

      logger.debug('AuthContext: Login successful, storing user data:', {
        userId: response.user_id,
        role: response.role
      });

      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('user_data', JSON.stringify({
        id: response.user_id,
        role: response.role,
        name: response.name,
      }));

      setAccessToken(response.access_token);
      setUser({
        id: response.user_id,
        role: response.role,
        name: response.name,
      });

      toast.success(`Welcome, ${response.name}`, {
        position: "top-center",
        autoClose: 3000,
      });

      // Redirect based on role
      logger.debug('AuthContext: Redirecting to dashboard for role:', { role: response.role });
      if (response.role === 'head') {
        navigate('/head/dashboard');
      } else if (response.role === 'trainer') {
        navigate('/trainer/dashboard');
      } else if (response.role === 'coach') {
        navigate('/coach/dashboard');
      } else if (response.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (response.role === 'learner') {
        navigate('/learner/dashboard');
      }
    } catch (error) {
      logger.error('AuthContext: Login failed:', {
        error: error.response?.data?.detail || 'Unknown error',
        status: error.response?.status
      });
      const errorMsg = error.response?.data?.detail || 'Login failed';
      toast.error(errorMsg, {
        position: "top-center",
        autoClose: 3000,
      });
      throw error;
    }
  };

  /**
   * Logs out the current user
   */
  const logout = () => {
    console.log('AuthContext: Logging out user:', {
      userId: user?.id,
      role: user?.role
    });
    authService.logout();
    setUser(null);
    setAccessToken(null);
    toast.success('Logged out successfully', {
      position: "top-center",
      autoClose: 3000,
    });
  };

  /**
   * Check if user has specific role
   */
  const hasRole = (role) => {
    return user?.role === role;
  };

  const value = {
    user,
    loading,
    userLogin,
    logout,
    hasRole,
    isAuthenticated: !!user,
    deviceInfo,
    isDeviceSessionConnected: isConnected,
  };

  return (
    <AuthContext.Provider value={value}>
      <SessionInvalidatedModal
        isOpen={showSessionInvalidatedModal}
        onConfirm={handleSessionInvalidatedLogout}
      />
      {!loading && children}
    </AuthContext.Provider>
  );
};
