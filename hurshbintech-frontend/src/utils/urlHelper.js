/**
 * URL Helper utilities for handling S3 and local file URLs
 * S3 URLs are converted to presigned URLs via backend proxy.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://hurshbin.lumesoftai.in:8001';

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

  // If it's a direct Neev Cloud / S3-compatible URL, proxy it through backend to avoid CORS
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const S3_DOMAINS = ['s3-api.neevcloud.com', 'amazonaws.com'];
    if (S3_DOMAINS.some(domain => url.includes(domain))) {
      // Extract key after bucket name in the URL path and route through proxy
      try {
        const urlObj = new URL(url);
        // Remove the leading '/' and any query params to get the S3 key
        const key = urlObj.pathname.replace(/^\/[^/]+\//, ''); // remove /bucket-name/
        if (key) {
          return `${API_BASE_URL}/content/learning-content/s3-files/${key}`;
        }
      } catch (_) { /* fall through */ }
    }
    return url;
  }

  // Handle S3 URLs (s3://bucket/key format)
  if (url.startsWith('s3://')) {
    // Route through backend proxy which streams S3 content (avoids CORS)
    const parts = url.replace('s3://', '').split('/');
    const key = parts.slice(1).join('/');
    return `${API_BASE_URL}/content/learning-content/s3-files/${key}`;
  }

  // Handle backend proxy URLs (from API responses: /api/content/learning-content/s3-files/...)
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
