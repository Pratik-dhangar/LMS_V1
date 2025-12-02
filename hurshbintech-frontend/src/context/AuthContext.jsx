import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../api/services/authService';
import { toast } from 'react-toastify';
import logger from '../utils/logger';

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
  const navigate = useNavigate();

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = () => {
      logger.debug('Loading user from localStorage');
      const userData = authService.getCurrentUser();
      const token = localStorage.getItem('access_token');

      if (userData && token) {
        logger.debug('User authenticated from localStorage:', { id: userData.id, role: userData.role });
        setUser(userData);
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
      const response = await authService.userLogin(credentials);

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
      } else if (response.role === 'consultant') {
        navigate('/consultant/dashboard');
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
    toast.success('Logged out successfully', {
      position: "top-center",
      autoClose: 3000,
    });
    navigate('/login');
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
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
