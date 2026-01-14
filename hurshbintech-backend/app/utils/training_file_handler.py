"""
Training File Upload Handler
Manages file uploads for trainings with proper folder structure for both local and S3 storage
"""

import logging
import mimetypes
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Tuple

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)

# Base upload directory for local storage
# File is at: hurshbintech-backend/app/utils/training_file_handler.py
# So we go up 3 levels to reach hurshbintech-backend
BASE_DIR = Path(__file__).resolve().parent.parent.parent
LOCAL_UPLOADS_DIR = BASE_DIR / "uploads" / "trainings"


class TrainingFileHandler:
    """Handles training file uploads to local storage or S3"""

    def __init__(self):
        """Initialize the handler"""
        self.use_s3 = settings.USE_S3
        self.bucket_name = settings.S3_BUCKET_NAME
        self.aws_region = settings.AWS_REGION
        self.frontend_url = settings.FRONTEND_URL

        # Ensure local upload directory exists
        if not self.use_s3:
            LOCAL_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
            logger.info(f"Training files will be stored locally in: {LOCAL_UPLOADS_DIR}")

        # Initialize S3 client if enabled
        self.s3_client = None
        if self.use_s3:
            try:
                self.s3_client = boto3.client(
                    "s3",
                    region_name=self.aws_region,
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                )
                # Test connection
                self.s3_client.head_bucket(Bucket=self.bucket_name)
                logger.info(f"S3 connection successful for bucket: {self.bucket_name}")
            except ClientError as e:
                logger.error(f"Failed to initialize S3 client: {str(e)}")
                raise

    def _get_file_category(self, filename: str) -> str:
        """Categorize file type"""
        file_extension = os.path.splitext(filename)[1].lower()
        content_type_map = {
            ".jpg": "image",
            ".jpeg": "image",
            ".jfif": "image",
            ".png": "image",
            ".gif": "image",
            ".webp": "image",
            ".pdf": "pdf",
            ".mp4": "video",
            ".avi": "video",
            ".mov": "video",
            ".mkv": "video",
            ".webm": "video",
            ".mp3": "audio",
            ".wav": "audio",
            ".ogg": "audio",
            ".m4a": "audio",
            ".doc": "document",
            ".docx": "document",
            ".txt": "document",
            ".ppt": "document",
            ".pptx": "document",
        }
        return content_type_map.get(file_extension, "document")

    def _get_content_type(self, filename: str) -> str:
        """Determine content type based on filename"""
        content_type, _ = mimetypes.guess_type(filename)
        return content_type or "application/octet-stream"

    def _validate_file_size(self, file_content: bytes, file_type: str) -> bool:
        """
        Validate file size based on type
        Returns: True if valid, False otherwise
        """
        file_size = len(file_content)

        # Set limits based on file type
        if file_type == "video":
            max_size = 500 * 1024 * 1024  # 500MB for videos
        elif file_type == "image":
            max_size = 50 * 1024 * 1024  # 50MB for images
        else:
            max_size = 100 * 1024 * 1024  # 100MB for other files

        return file_size <= max_size

    def _validate_file_type(self, filename: str, allowed_types: Optional[list] = None) -> bool:
        """
        Validate file extension against allowed types
        allowed_types: list of allowed file extensions (e.g., ['.pdf', '.mp4'])
        Returns: True if valid, False otherwise
        """
        if not allowed_types:
            # Default allowed types for trainings
            allowed_types = [
                ".pdf", ".doc", ".docx", ".txt", ".ppt", ".pptx",  # Documents
                ".mp4", ".avi", ".mov", ".mkv", ".webm",  # Videos
                ".jpg", ".jpeg", ".jfif", ".png", ".gif", ".webp",  # Images
                ".mp3", ".wav", ".ogg", ".m4a",  # Audio
            ]

        file_extension = os.path.splitext(filename)[1].lower()
        return file_extension in allowed_types

    def create_training_folder(self, training_id: int) -> str:
        """
        Create a folder for training files (local or S3)
        
        Args:
            training_id: ID of the training
            
        Returns:
            Folder path (local relative path or S3 prefix)
        """
        folder_name = f"training_{training_id}_{datetime.now().strftime('%Y%m%d')}"

        if self.use_s3:
            # S3 folder path (no actual folder creation needed)
            s3_folder = f"uploads/trainings/{folder_name}"
            logger.info(f"Created S3 training folder path: {s3_folder}")
            return s3_folder
        else:
            # Local folder
            local_folder = LOCAL_UPLOADS_DIR / folder_name
            local_folder.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created local training folder: {local_folder}")
            return str(local_folder.relative_to(BASE_DIR))

    def upload_training_file(
        self,
        file_content: bytes,
        filename: str,
        training_folder: str,
        file_type: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Upload a training file to local storage or S3
        
        Args:
            file_content: File bytes
            filename: Original filename
            training_folder: Training folder path (returned from create_training_folder)
            file_type: Type of file ('image', 'video', 'document', etc.)
            
        Returns:
            Dict with 'file_url' and 'original_filename'
            
        Raises:
            ValueError: If file validation fails
            Exception: If upload fails
        """
        # Determine file type
        if not file_type:
            file_type = self._get_file_category(filename)

        # Validate file
        if not self._validate_file_type(filename):
            raise ValueError(f"File type not allowed: {filename}")

        if not self._validate_file_size(file_content, file_type):
            max_size = 500 if file_type == "video" else (50 if file_type == "image" else 100)
            raise ValueError(f"File size exceeds {max_size}MB limit")

        # Generate unique filename with original extension
        file_extension = os.path.splitext(filename)[1].lower()
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        content_type = self._get_content_type(filename)

        if self.use_s3:
            return self._upload_to_s3(
                file_content, training_folder, unique_filename, content_type, filename
            )
        else:
            return self._upload_to_local(file_content, training_folder, unique_filename, filename)

    def _upload_to_local(
        self, file_content: bytes, training_folder: str, unique_filename: str, original_filename: str
    ) -> Dict[str, str]:
        """Upload file to local storage"""
        try:
            # Ensure training_folder is properly resolved to LOCAL_UPLOADS_DIR
            # training_folder might be just the folder name or a relative path
            if not training_folder.startswith("uploads"):
                folder_path = LOCAL_UPLOADS_DIR / training_folder
            else:
                folder_path = Path(training_folder)
            
            # Create folder if it doesn't exist
            folder_path.mkdir(parents=True, exist_ok=True)
            
            file_path = folder_path / unique_filename

            # Write file
            with open(file_path, "wb") as f:
                f.write(file_content)

            # Return relative URL path - always relative to /uploads
            # Get the relative path from project root
            try:
                relative_to_project = file_path.relative_to(BASE_DIR)
            except ValueError:
                relative_to_project = file_path
            
            file_url = f"/{str(relative_to_project).replace(os.sep, '/')}"

            logger.info(f"Uploaded training file locally: {file_url} (actual path: {file_path})")
            return {
                "file_url": file_url,
                "original_filename": original_filename,
                "local_path": str(file_path),
            }
        except Exception as e:
            logger.error(f"Error uploading to local storage: {str(e)}")
            raise

    def _upload_to_s3(
        self,
        file_content: bytes,
        training_folder: str,
        unique_filename: str,
        content_type: str,
        original_filename: str,
    ) -> Dict[str, str]:
        """Upload file to S3"""
        try:
            # Construct S3 key
            s3_key = f"{training_folder}/{unique_filename}"

            # Upload to S3
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_content,
                ContentType=content_type,
            )

            # Generate permanent presigned URL (valid for 1 year)
            presigned_url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key
                },
                ExpiresIn=31536000  # 1 year in seconds
            )

            logger.info(f"Uploaded training file to S3: {s3_key}")
            return {
                "file_url": presigned_url,
                "original_filename": original_filename,
                "s3_key": s3_key,
            }
        except ClientError as e:
            logger.error(f"Error uploading to S3: {str(e)}")
            raise

    def _get_nginx_proxy_url(self, s3_key: str) -> str:
        """
        Generate Nginx proxy URL for S3 files
        The Nginx reverse proxy ensures permanent URLs without expiration
        
        Args:
            s3_key: S3 object key
            
        Returns:
            Public HTTPS URL through Nginx proxy
        """
        # Extract domain from frontend URL
        frontend_domain = self.frontend_url.replace("http://", "").replace("https://", "")
        
        # Generate proxy URL (Nginx will proxy to S3)
        # URL format: https://domain/s3-media/bucket/key
        proxy_url = f"https://{frontend_domain}/s3-media/{self.bucket_name}/{s3_key}"
        
        logger.debug(f"Generated Nginx proxy URL: {proxy_url}")
        return proxy_url

    def delete_training_file(self, file_url: str) -> bool:
        """
        Delete a training file from local storage or S3
        
        Args:
            file_url: File URL (local path or s3:// URL)
            
        Returns:
            True if deletion successful, False otherwise
        """
        try:
            if self.use_s3 and file_url.startswith("s3://"):
                # Extract S3 key
                s3_key = file_url.replace(f"s3://{self.bucket_name}/", "")
                self.s3_client.delete_object(Bucket=self.bucket_name, Key=s3_key)
                logger.info(f"Deleted file from S3: {s3_key}")
                return True
            elif not file_url.startswith("s3://"):
                # Local file deletion
                # Handle both relative and absolute paths
                if file_url.startswith("/uploads/"):
                    file_url = file_url[1:]  # Remove leading /
                
                file_path = BASE_DIR / file_url
                if file_path.exists():
                    os.remove(file_path)
                    logger.info(f"Deleted local file: {file_path}")
                    return True
            return False
        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}")
            return False

    def delete_training_folder(self, training_folder: str) -> bool:
        """
        Delete entire training folder and its contents
        
        Args:
            training_folder: Folder path
            
        Returns:
            True if deletion successful, False otherwise
        """
        try:
            if self.use_s3:
                # List and delete all S3 objects in folder
                objects = self.s3_client.list_objects_v2(
                    Bucket=self.bucket_name, Prefix=training_folder
                )

                if "Contents" in objects:
                    for obj in objects["Contents"]:
                        self.s3_client.delete_object(Bucket=self.bucket_name, Key=obj["Key"])

                logger.info(f"Deleted S3 training folder: {training_folder}")
                return True
            else:
                # Local folder deletion
                folder_path = BASE_DIR / training_folder
                if folder_path.exists():
                    import shutil
                    shutil.rmtree(folder_path)
                    logger.info(f"Deleted local training folder: {folder_path}")
                    return True
            return False
        except Exception as e:
            logger.error(f"Error deleting training folder: {str(e)}")
            return False

    def get_file_url(self, file_url: str) -> str:
        """
        Get publicly accessible URL for a file
        
        Args:
            file_url: S3 URL or local path
            
        Returns:
            Public HTTPS URL (Nginx proxy for S3, direct path for local)
        """
        if self.use_s3 and file_url.startswith("s3://"):
            s3_key = file_url.replace(f"s3://{self.bucket_name}/", "")
            return self._get_nginx_proxy_url(s3_key)
        return file_url


# Global instance
training_file_handler = TrainingFileHandler()

# Export constants for use in other modules
__all__ = ['training_file_handler', 'LOCAL_UPLOADS_DIR', 'TrainingFileHandler']
