#!/usr/bin/env python
"""
Configure S3 CORS policy to allow presigned URL access from frontend origins.
Usage: python configure_s3_cors.py
"""

import boto3
import json
import sys

# S3 Configuration
BUCKET_NAME = 'hurshbintech-media-bucket'
AWS_REGION = 'ap-south-1'

# CORS Configuration - Allow requests from frontend origins
CORS_CONFIG = {
    'CORSRules': [
        {
            'AllowedOrigins': [
                'https://43.204.218.16:3000',  # Frontend EC2 origin
                'http://localhost:3000',        # Local development
                'http://localhost:5173',        # Vite dev server
            ],
            'AllowedMethods': ['GET', 'HEAD', 'PUT', 'POST', 'DELETE'],
            'AllowedHeaders': ['*'],
            'ExposeHeaders': [
                'ETag',
                'x-amz-version-id',
                'x-amz-request-id',
                'Content-Length',
                'Content-Type',
                'Content-Range',
                'Last-Modified'
            ],
            'MaxAgeSeconds': 3000
        }
    ]
}

def configure_cors():
    """Configure S3 bucket CORS settings"""
    try:
        s3_client = boto3.client('s3', region_name=AWS_REGION)
        
        print(f"Configuring CORS for bucket: {BUCKET_NAME}")
        print(f"Region: {AWS_REGION}")
        print(f"CORS Rules:\n{json.dumps(CORS_CONFIG, indent=2)}\n")
        
        # Put CORS configuration
        s3_client.put_bucket_cors(
            Bucket=BUCKET_NAME,
            CORSConfiguration=CORS_CONFIG
        )
        
        print("✅ CORS configuration applied successfully!")
        
        # Verify by reading back the configuration
        response = s3_client.get_bucket_cors(Bucket=BUCKET_NAME)
        print(f"\n✓ Current CORS configuration:\n{json.dumps(response['CORSRules'], indent=2)}")
        
        return True
    
    except Exception as e:
        print(f"❌ Error configuring CORS: {str(e)}")
        print("\nTroubleshooting:")
        print("1. Ensure AWS credentials are configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)")
        print("2. Ensure IAM user has s3:PutBucketCors permission")
        print("3. Verify bucket name: hurshbintech-media-bucket")
        print("4. Verify region: ap-south-1")
        return False

if __name__ == '__main__':
    success = configure_cors()
    sys.exit(0 if success else 1)
