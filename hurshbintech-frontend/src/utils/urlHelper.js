/**
 * URL Helper utilities for handling S3 and local file URLs
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://hurshbin.lumesoftai.in:8001';
const MEDIA_PROXY_URL = import.meta.env.VITE_MEDIA_PROXY_URL || 'https://hurshbin.lumesoftai.in:3001';

/**
 * Get backend base URL (without /api prefix)
 * API_BASE_URL typically ends with /api, so we remove it for static file serving
 */
const getBackendBaseUrl = () => {
  if (API_BASE_URL.endsWith('/api')) {
    return API_BASE_URL.slice(0, -4); // Remove '/api' from the end
  }
  return API_BASE_URL;
};

/**
 * Convert S3 URLs or local paths to accessible URLs
 * Handles:
 * - s3://bucket/key -> https://media-proxy/s3/bucket/key
 * - /uploads/path -> https://backend-base/uploads/path (without /api)
 * - https://... -> returns as is
 */
export const getFileUrl = (url) => {
  if (!url) return null;

  // If it's already an absolute URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Handle S3 URLs (s3://bucket/key format)
  if (url.startsWith('s3://')) {
    // Convert s3://bucket/key to https://media-proxy/s3/bucket/key
    const s3Path = url.replace('s3://', '');
    return `${MEDIA_PROXY_URL}/s3/${s3Path}`;
  }

  // Handle local uploads paths (/uploads/...) - use backend base URL without /api
  if (url.startsWith('/uploads/')) {
    return `${getBackendBaseUrl()}${url}`;
  }

  // Default: assume it's a local path with /api prefix needed (for API responses)
  return `${API_BASE_URL}${url}`;
};

/**
 * Get profile picture URL with proper fallback
 */
export const getProfilePictureUrl = (profilePictureUrl) => {
  return getFileUrl(profilePictureUrl);
};

export default {
  getFileUrl,
  getProfilePictureUrl,
};
