#!/usr/bin/env python
"""
S3 Public URL Helper Module

PURPOSE:
- Provides helper methods for S3 URL generation
- Not meant to be run as standalone script
- Import functions into backend code

IMPLEMENTATION USE:
This module is imported and used by backend endpoints:

Example - In backend endpoint:
    from configure_s3_cors import S3Manager
    
    s3_manager = S3Manager('hurshbintech-media-bucket', 'ap-south-1')
    
    # Generate public URL (no expiration)
    public_url = s3_manager.get_public_url('uploads/learning-content/file.png')
    # Returns: https://bucket.s3.ap-south-1.amazonaws.com/uploads/learning-content/file.png
    
    # Generate presigned URL (deprecated - use get_public_url instead)
    presigned_url = s3_manager.get_presigned_url('uploads/learning-content/file.png', expiration=86400)
    # Returns: https://bucket.s3.ap-south-1.amazonaws.com/uploads/...?X-Amz-Algorithm=...

MIGRATION FROM PRESIGNED TO PUBLIC:
1. Old approach used presigned URLs that expired after 24 hours
2. Users received "Request has expired" errors when accessing old media
3. New approach uses public S3 URLs that never expire
4. More reliable, faster, simpler

REQUIREMENTS:
- S3 bucket must have public read access configured
- CORS must be configured for frontend domain
- See S3_PUBLIC_ACCESS_SETUP.md for complete setup instructions

SECURITY NOTE:
- Public read access is secure for learning/training content
- Only authenticated users can upload via backend API
- Frontend can only load from your domain (CORS controlled)
- URLs are in database, not publicly listed
"""

import boto3
from botocore.exceptions import ClientError
import logging
import os

logger = logging.getLogger(__name__)


class S3Manager:
    """Manages S3 URLs for media content"""
    
    def __init__(self, bucket_name: str, region: str = "ap-south-1"):
        """Initialize S3 manager"""
        self.bucket_name = bucket_name
        self.region = region
        self.s3_client = boto3.client(
            's3',
            region_name=region,
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )
    
    def get_public_url(self, s3_key: str) -> str:
        """
        Generate public HTTP URL for S3 object
        
        Args:
            s3_key: S3 object key (e.g., 'uploads/learning-content/file.png')
        
        Returns:
            Public HTTPS URL - valid indefinitely until file is deleted
        
        Example:
            url = manager.get_public_url('uploads/learning-content/image.png')
            # Returns: https://bucket.s3.ap-south-1.amazonaws.com/uploads/learning-content/image.png
        
        Advantages:
            - No expiration (always works)
            - Faster than presigned URLs
            - No AWS signature needed
            - Browser can cache indefinitely
        """
        return f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{s3_key}"
    
    def get_presigned_url(self, s3_key: str, expiration: int = 3600) -> str:
        """
        Generate presigned URL for S3 object (DEPRECATED)
        
        Note: Use get_public_url() instead. Presigned URLs expire and are not suitable
              for permanent content access.
        
        Args:
            s3_key: S3 object key
            expiration: URL expiration in seconds (default: 3600 = 1 hour)
        
        Returns:
            Presigned URL with expiration signature
        
        Example:
            url = manager.get_presigned_url('uploads/learning-content/image.png', expiration=86400)
            # Returns: https://bucket.s3.ap-south-1.amazonaws.com/uploads/...?X-Amz-Algorithm=AWS4-HMAC-SHA256...
        
        Problems with presigned URLs:
            - Expire after specified time
            - Generate "Request has expired" errors
            - Not suitable for user-facing content
        """
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': s3_key},
                ExpiresIn=expiration
            )
            return url
        except ClientError as e:
            logger.error(f"Error generating presigned URL: {str(e)}")
            raise


if __name__ == '__main__':
    print(__doc__)

