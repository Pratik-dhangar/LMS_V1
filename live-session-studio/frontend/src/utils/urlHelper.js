/**
 * URL Helper utilities for Live Session Studio.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002/api';

const getBackendBaseUrl = () => {
  if (API_BASE_URL.endsWith('/api')) {
    return API_BASE_URL.slice(0, -4);
  }
  return API_BASE_URL;
};

export const getFileUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  if (url.startsWith('/api/')) {
    return `${getBackendBaseUrl()}${url}`;
  }
  if (url.startsWith('/uploads/')) {
    return `${API_BASE_URL}${url}`;
  }
  const clean = url.replace(/^\/+/, '');
  return `${API_BASE_URL}/uploads/${clean}`;
};

export const getProfilePictureUrl = (profilePictureUrl) => {
  return getFileUrl(profilePictureUrl);
};

export default {
  getFileUrl,
  getProfilePictureUrl,
};
