/**
 * URL Helper utilities for handling S3 and local file URLs
 * S3 URLs are converted to presigned URLs via backend proxy.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://hurshbin.com/api';

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
 * 
 * S3 URLs are routed through backend proxy which generates presigned URLs
 * with 24-hour expiration. All user roles can access the same content.
 * 
 * Handles:
 * - s3://bucket/key -> backend proxy (generates presigned URL)
 * - /uploads/path -> https://backend-base/uploads/path
 * - https://... -> returns as-is (already valid presigned URL)
 */
export const getFileUrl = (url) => {
  if (!url) return null;

  // If it's a direct S3 URL (AWS or Neev), proxy it through backend to avoid CORS and expiry issues
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      const urlObj = new URL(url);

      // AWS S3 virtual-hosted style: https://bucket.s3.region.amazonaws.com/key
      // Bucket is in the HOSTNAME — pathname is already the full key (e.g. /uploads/profile_pictures/...)
      if (urlObj.hostname.includes('amazonaws.com')) {
        const key = urlObj.pathname.slice(1); // remove leading '/'
        if (key) return `${API_BASE_URL}/media/s3/${key}`;
      }

      // Neev Cloud / path-style S3: https://s3-api.neevcloud.com/bucket/key
      // Bucket is in the PATH — need to strip /bucket/ prefix
      if (urlObj.hostname.includes('s3-api.neevcloud.com')) {
        const key = urlObj.pathname.replace(/^\/[^/]+\//, ''); // remove /bucket-name/
        if (key) return `${API_BASE_URL}/media/s3/${key}`;
      }

      // Rewrite old frontend-proxy S3 URLs (e.g. stored with :3001/s3/... from previous deployment)
      // Detected by: same domain (hurshbin.lumesoftai.in) with /s3/ path — rewrite to current origin
      if (urlObj.pathname.startsWith('/s3/') &&
        !urlObj.hostname.includes('amazonaws.com') &&
        !urlObj.hostname.includes('neevcloud.com')) {
        return `${window.location.origin}${urlObj.pathname}`;
      }
    } catch (_) { /* fall through */ }
    return url;
  }

  // Handle S3 URLs (s3://bucket/key format)
  if (url.startsWith('s3://')) {
    // Route through backend proxy which streams S3 content (avoids CORS)
    const parts = url.replace('s3://', '').split('/');
    const key = parts.slice(1).join('/');
    return `${API_BASE_URL}/media/s3/${key}`;
  }

  // Handle backend proxy URLs (from API responses: /api/media/s3/...)
  if (url.startsWith('/api/')) {
    return `${getBackendBaseUrl()}${url}`;
  }

  // Handle local uploads paths (/uploads/...)
  if (url.startsWith('/uploads/')) {
    return `${getBackendBaseUrl()}${url}`;
  }

  // Default: assume it's a local path and prepend backend URL
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
