import axios from 'axios';
import logger from '../utils/logger';
import { toast } from 'react-toastify';

// axios instance with default config
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://hurshbin.com/api',
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 10000,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  },
});

// Request interceptor - Handle FormData (remove Content-Type for multipart)
axiosInstance.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Request interceptor - Add token to all requests
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 - Unauthorized (token expired)
    if (error.response?.status === 401) {
      // Check if this is a login request - if so, let the component handle the error
      // and don't trigger session expiration logic
      if (error.config?.url?.includes('/auth/user/login')) {
        return Promise.reject(error);
      }

      // Check if this is a silent auth check (browsing without login)
      // Don't show error toast or redirect for optional authentication
      if (error.config?.silentAuthCheck) {
        return Promise.reject(error);
      }

      // Check if this is an optional endpoint that shouldn't trigger logout
      // (e.g., session notes, learning goals that fail due to permissions)
      const optionalEndpoints = ['/session-notes/', '/learning-goals/', '/head-session-notes/'];
      const isOptionalEndpoint = optionalEndpoints.some(endpoint => error.config?.url?.includes(endpoint));

      if (isOptionalEndpoint) {
        // Just reject the promise without triggering logout
        console.warn(`[Axios] Got 401 on optional endpoint: ${error.config?.url}, continuing without it`);
        return Promise.reject(error);
      }

      logger.warn('[Axios] Received 401 Unauthorized - clearing auth and redirecting to login');

      toast.error("Session expired! Please login Again.");

      localStorage.removeItem('access_token');
      localStorage.removeItem('user_data');
      // Use setTimeout to ensure state updates complete before navigation
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);

      return new Promise(() => { });
    }

    // Handle 403 - Forbidden
    if (error.response?.status === 403) {
      logger.error('[Axios] Access forbidden (403):', error.response?.data?.detail || 'No detail provided');
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
