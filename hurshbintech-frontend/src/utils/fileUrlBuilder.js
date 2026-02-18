/**
 * Build file URLs based on storage type (local vs S3)
 * Handles both local storage (uploads/) and S3 storage with presigned URL access
 * 
 * S3 URLs are routed through the backend which generates presigned URLs
 * with 24-hour expiration. All user roles can access the same content.
 */

/**
 * Get the correct URL for a file path
 * - If path is a local path (starts with uploads/), serves via backend
 * - If path is an S3 URL (s3://bucket/key), routes through backend proxy for signed access
 * - If path is already HTTPS, uses directly (presigned URL from backend)
 * 
 * @param {string} s3PathOrUrl - The file path from database (e.g., "uploads/receipts/uuid/file.jpg" or "s3://bucket/key")
 * @returns {string} - The full URL to access the file
 */
export const getFileUrl = (s3PathOrUrl) => {
    if (!s3PathOrUrl) return null;

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
    const BACKEND_URL = API_BASE_URL.replace('/api', ''); // Remove /api suffix for static file serving

    // Check if it's already an HTTPS URL
    if (s3PathOrUrl.startsWith('https://') || s3PathOrUrl.startsWith('http://')) {
        return s3PathOrUrl;
    }

    // Check if it's a local storage path
    if (s3PathOrUrl.startsWith('uploads/')) {
        return `${BACKEND_URL}/${s3PathOrUrl}`;
    }

    // Check if it's an S3 URL format (s3://bucket/key)
    if (s3PathOrUrl.startsWith('s3://')) {
        // Route through backend proxy which streams S3 content (avoids CORS)
        const parts = s3PathOrUrl.replace('s3://', '').split('/');
        const key = parts.slice(1).join('/');
        return `${API_BASE_URL}/content/learning-content/s3-files/${key}`;
    }

    // Handle backend proxy URLs (from API responses: /api/content/...)
    if (s3PathOrUrl.startsWith('/api/')) {
        return `${BACKEND_URL}${s3PathOrUrl}`;
    }

    // Default: treat as local path and prepend backend URL
    return `${BACKEND_URL}/${s3PathOrUrl}`;
};

/**
 * Check if a file is stored locally
 * @param {string} s3PathOrUrl - The file path from database
 * @returns {boolean} - True if file is stored locally
 */
export const isLocalFile = (s3PathOrUrl) => {
    return s3PathOrUrl && s3PathOrUrl.startsWith('uploads/');
};

/**
 * Check if a file is an S3 file
 * @param {string} s3PathOrUrl - The file path from database
 * @returns {boolean} - True if file is stored on S3
 */
export const isS3File = (s3PathOrUrl) => {
    return s3PathOrUrl && (
        s3PathOrUrl.startsWith('https://') ||
        (!s3PathOrUrl.startsWith('uploads/') && s3PathOrUrl.includes('.'))
    );
};
