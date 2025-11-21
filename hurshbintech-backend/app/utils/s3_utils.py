"""
AWS S3 Utility Module for File Upload/Download/Delete Operations
Handles all media files (images, videos, documents, audio) for HurshBinTech
"""
import boto3
from botocore.exceptions import ClientError
from fastapi import UploadFile
import os
import uuid
from pathlib import Path
from typing import Optional, Dict

class S3Manager:
    """
    Manages all S3 operations for file storage
    Supports: Upload, Delete, Generate URLs, List files
    """
    
    def __init__(self):
        """Initialize S3 client with credentials from environment variables"""
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION', 'ap-south-1')
        )
        self.bucket_name = os.getenv('S3_BUCKET_NAME', 'hurshbintech-media')
        self.region = os.getenv('AWS_REGION', 'ap-south-1')
    
    async def upload_file(
        self, 
        file: UploadFile, 
        folder: str = "uploads",
        make_public: bool = True
    ) -> Dict[str, any]:
        """
        Upload file to S3 and return file information
        
        Args:
            file: FastAPI UploadFile object
            folder: S3 folder path (e.g., "learning_content", "vlogs")
            make_public: Whether file should be publicly accessible
            
        Returns:
            Dictionary with file_url, s3_key, file_size, original_filename
        """
        try:
            # Generate unique filename to prevent overwrites
            file_extension = Path(file.filename).suffix.lower()
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            s3_key = f"{folder}/{unique_filename}"
            
            # Read file content
            file_content = await file.read()
            await file.seek(0)  # Reset file pointer for potential re-use
            
            # Prepare upload parameters
            upload_params = {
                'Bucket': self.bucket_name,
                'Key': s3_key,
                'Body': file_content,
                'ContentType': file.content_type or 'application/octet-stream'
            }
            
            # Add public-read ACL if public access required
            if make_public:
                upload_params['ACL'] = 'public-read'
            
            # Upload to S3
            self.s3_client.put_object(**upload_params)
            
            # Generate public URL
            file_url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{s3_key}"
            
            return {
                "file_url": file_url,
                "s3_key": s3_key,
                "file_size": len(file_content),
                "original_filename": file.filename,
                "content_type": file.content_type
            }
        
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            print(f"S3 Upload Error [{error_code}]: {error_message}")
            raise Exception(f"Failed to upload file to S3: {error_message}")
        
        except Exception as e:
            print(f"Unexpected S3 Upload Error: {str(e)}")
            raise Exception(f"Failed to upload file: {str(e)}")
    
    def delete_file(self, s3_key: str) -> bool:
        """
        Delete file from S3 bucket
        
        Args:
            s3_key: Full S3 key (e.g., "learning_content/abc123.pdf")
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            print(f"Successfully deleted: {s3_key}")
            return True
        
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            print(f"S3 Delete Error [{error_code}]: {error_message}")
            return False
        
        except Exception as e:
            print(f"Unexpected S3 Delete Error: {str(e)}")
            return False
    
    def delete_file_by_url(self, file_url: str) -> bool:
        """
        Delete file from S3 using its public URL
        
        Args:
            file_url: Full S3 URL (e.g., "https://bucket.s3.region.amazonaws.com/key")
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Extract S3 key from URL
            # Format: https://hurshbintech-media.s3.ap-south-1.amazonaws.com/folder/file.ext
            if '.amazonaws.com/' in file_url:
                s3_key = file_url.split('.amazonaws.com/')[-1]
                return self.delete_file(s3_key)
            else:
                print(f"Invalid S3 URL format: {file_url}")
                return False
        
        except Exception as e:
            print(f"Error extracting S3 key from URL: {str(e)}")
            return False
    
    def get_presigned_url(
        self, 
        s3_key: str, 
        expiration: int = 3600,
        download: bool = False
    ) -> Optional[str]:
        """
        Generate presigned URL for temporary access to private files
        
        Args:
            s3_key: Full S3 key
            expiration: URL validity in seconds (default: 1 hour)
            download: If True, forces browser to download instead of display
            
        Returns:
            Presigned URL string or None if error
        """
        try:
            params = {
                'Bucket': self.bucket_name,
                'Key': s3_key
            }
            
            # Add download header if required
            if download:
                params['ResponseContentDisposition'] = f'attachment; filename="{Path(s3_key).name}"'
            
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params=params,
                ExpiresIn=expiration
            )
            return url
        
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            print(f"S3 Presigned URL Error [{error_code}]: {error_message}")
            return None
    
    def list_files(self, folder: str = "", max_keys: int = 1000) -> list:
        """
        List files in a specific S3 folder
        
        Args:
            folder: S3 folder prefix (e.g., "learning_content")
            max_keys: Maximum number of files to return
            
        Returns:
            List of file dictionaries with key, size, last_modified
        """
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=folder,
                MaxKeys=max_keys
            )
            
            if 'Contents' not in response:
                return []
            
            files = []
            for obj in response['Contents']:
                files.append({
                    'key': obj['Key'],
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'],
                    'url': f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{obj['Key']}"
                })
            
            return files
        
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            print(f"S3 List Error [{error_code}]: {error_message}")
            return []
    
    def file_exists(self, s3_key: str) -> bool:
        """
        Check if file exists in S3
        
        Args:
            s3_key: Full S3 key to check
            
        Returns:
            True if exists, False otherwise
        """
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=s3_key)
            return True
        except ClientError:
            return False
    
    def get_file_metadata(self, s3_key: str) -> Optional[Dict]:
        """
        Get file metadata from S3
        
        Args:
            s3_key: Full S3 key
            
        Returns:
            Dictionary with metadata or None if error
        """
        try:
            response = self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            
            return {
                'content_type': response.get('ContentType'),
                'content_length': response.get('ContentLength'),
                'last_modified': response.get('LastModified'),
                'etag': response.get('ETag'),
                'metadata': response.get('Metadata', {})
            }
        
        except ClientError as e:
            print(f"Error getting file metadata: {str(e)}")
            return None

# Singleton instance for use across the application
s3_manager = S3Manager()

# Helper function for content type detection
def get_content_type_category(filename: str) -> str:
    """
    Determine content category based on file extension
    
    Args:
        filename: Name of the file
        
    Returns:
        Category string: 'image', 'video', 'audio', 'pdf', 'document'
    """
    extension = Path(filename).suffix.lower()
    
    content_type_map = {
        # Images
        '.jpg': 'image', '.jpeg': 'image', '.png': 'image', 
        '.gif': 'image', '.webp': 'image', '.svg': 'image',
        '.bmp': 'image', '.ico': 'image',
        
        # Videos
        '.mp4': 'video', '.avi': 'video', '.mov': 'video', 
        '.mkv': 'video', '.webm': 'video', '.flv': 'video',
        '.wmv': 'video', '.m4v': 'video',
        
        # Audio
        '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio', 
        '.m4a': 'audio', '.aac': 'audio', '.flac': 'audio',
        '.wma': 'audio',
        
        # PDF
        '.pdf': 'pdf',
        
        # Documents
        '.doc': 'document', '.docx': 'document', '.txt': 'document',
        '.ppt': 'document', '.pptx': 'document', '.xls': 'document',
        '.xlsx': 'document', '.csv': 'document', '.rtf': 'document',
        '.odt': 'document', '.ods': 'document'
    }
    
    return content_type_map.get(extension, 'document')
