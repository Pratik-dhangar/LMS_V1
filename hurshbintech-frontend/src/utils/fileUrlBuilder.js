/**
 * Build file URLs based on storage type (local vs S3)
 * Handles both local storage (uploads/) and S3 storage seamlessly
 */

/**
 * Get the correct URL for a file path
 * - If path is a local path (starts with uploads/), serves via backend
 * - If path is an S3 path or S3 URL, returns S3 URL
 * 
 * @param {string} s3PathOrUrl - The file path from database (e.g., "uploads/receipts/uuid/file.jpg" or "s3_key_path")
 * @returns {string} - The full URL to access the file
 */
export const getFileUrl = (s3PathOrUrl) => {
    if (!s3PathOrUrl) return null;

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://127.0.0.1:8000';

    // Check if it's a local storage path
    if (s3PathOrUrl.startsWith('uploads/')) {
        // Local storage - serve through backend
        return `${API_BASE_URL}/${s3PathOrUrl}`;
    }

    // Check if it's already an S3 URL
    if (s3PathOrUrl.startsWith('https://')) {
        return s3PathOrUrl;
    }

    // Otherwise, it's an S3 key path - build S3 URL
    const bucketName = import.meta.env.REACT_APP_S3_BUCKET_NAME || 'hurshbintech-media-bucket';
    const awsRegion = import.meta.env.REACT_APP_AWS_REGION || 'ap-south-1';
    return `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${s3PathOrUrl}`;
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
