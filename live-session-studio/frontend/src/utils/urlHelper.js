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
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  // If pointing to our backend (port 8002), convert to relative /api path so Vite proxies it as same-origin
  if (url.startsWith('http://localhost:8002') || url.startsWith('http://127.0.0.1:8002')) {
    const path = url.replace(/^http:\/\/(localhost|127\.0\.0\.1):8002/, '');
    return path.startsWith('/api/') ? path : `/api${path}`;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/api/')) {
    return url;
  }
  if (url.startsWith('/uploads/')) {
    return `/api${url}`;
  }
  const clean = url.replace(/^\/+/, '');
  return `/api/uploads/${clean}`;
};

export const getProfilePictureUrl = (profilePictureUrl) => {
  return getFileUrl(profilePictureUrl);
};

export default {
  getFileUrl,
  getProfilePictureUrl,
};
