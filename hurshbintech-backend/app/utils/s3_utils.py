"""
S3 Upload Utilities for AWS Integration
Handles file uploads, thumbnails, and media management
"""

import os
import io
import uuid
import mimetypes
from pathlib import Path
from typing import Optional, Tuple
import logging

import boto3
from botocore.exceptions import ClientError
from PIL import Image
import cv2

logger = logging.getLogger(__name__)

class S3Manager:
    """Manages S3 uploads and media processing"""
    
    def __init__(self, bucket_name: str, region: str = "ap-south-1"):
        """Initialize S3 client"""
        self.bucket_name = bucket_name
        self.region = region
        self.s3_client = boto3.client(
            's3',
            region_name=region,
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )
        self.s3_url = f"https://{bucket_name}.s3.{region}.amazonaws.com"
    
    def upload_file(
        self,
        file_content: bytes,
        folder: str,
        filename: Optional[str] = None,
        content_type: str = "application/octet-stream"
    ) -> str:
        """
        Upload file to S3
        Args:
            file_content: File bytes to upload
            folder: S3 folder (e.g., 'learning-content', 'vlogs', 'reference_data')
            filename: Custom filename (auto-generated if not provided)
            content_type: MIME type of the file
        
        Returns:
            S3 object key (path)
        """
        try:
            if not filename:
                # Generate unique filename
                ext = mimetypes.guess_extension(content_type) or '.bin'
                filename = f"{uuid.uuid4()}{ext}"
            
            # Create S3 key with folder
            s3_key = f"uploads/{folder}/{filename}"
            
            # Upload to S3
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=file_content,
                ContentType=content_type
            )
            
            logger.info(f"Uploaded file to S3: s3://{self.bucket_name}/{s3_key}")
            return s3_key
        
        except ClientError as e:
            logger.error(f"Error uploading to S3: {str(e)}")
            raise
    
    def generate_thumbnail(
        self,
        file_content: bytes,
        file_type: str,
        size: Tuple[int, int] = (300, 300)
    ) -> Optional[bytes]:
        """
        Generate thumbnail for image or video
        Args:
            file_content: Original file bytes
            file_type: 'image' or 'video'
            size: Thumbnail dimensions (width, height)
        
        Returns:
            Thumbnail bytes or None if generation fails
        """
        try:
            if file_type == 'image':
                return self._generate_image_thumbnail(file_content, size)
            elif file_type == 'video':
                return self._generate_video_thumbnail(file_content, size)
            else:
                logger.warning(f"Cannot generate thumbnail for file type: {file_type}")
                return None
        
        except Exception as e:
            logger.error(f"Error generating thumbnail: {str(e)}")
            return None
    
    def _generate_image_thumbnail(
        self,
        file_content: bytes,
        size: Tuple[int, int] = (300, 300)
    ) -> bytes:
        """Generate thumbnail for image"""
        try:
            # Open image from bytes
            img = Image.open(io.BytesIO(file_content))
            
            # Convert RGBA to RGB if necessary
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            
            # Create thumbnail
            img.thumbnail(size, Image.Resampling.LANCZOS)
            
            # Save to bytes
            thumbnail_bytes = io.BytesIO()
            img.save(thumbnail_bytes, format='JPEG', quality=85)
            thumbnail_bytes.seek(0)
            
            return thumbnail_bytes.getvalue()
        
        except Exception as e:
            logger.error(f"Error generating image thumbnail: {str(e)}")
            raise
    
    def _generate_video_thumbnail(
        self,
        file_content: bytes,
        size: Tuple[int, int] = (300, 300)
    ) -> bytes:
        """Generate thumbnail from video (extract first frame)"""
        try:
            # Save video temporarily
            temp_video = f"/tmp/temp_video_{uuid.uuid4()}.mp4"
            with open(temp_video, 'wb') as f:
                f.write(file_content)
            
            # Extract first frame
            cap = cv2.VideoCapture(temp_video)
            ret, frame = cap.read()
            cap.release()
            
            if not ret:
                logger.warning("Could not read video frame")
                return None
            
            # Convert BGR to RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Convert to PIL Image
            img = Image.fromarray(frame_rgb)
            img.thumbnail(size, Image.Resampling.LANCZOS)
            
            # Save to bytes
            thumbnail_bytes = io.BytesIO()
            img.save(thumbnail_bytes, format='JPEG', quality=85)
            thumbnail_bytes.seek(0)
            
            # Clean up temp file
            os.remove(temp_video)
            
            return thumbnail_bytes.getvalue()
        
        except Exception as e:
            logger.error(f"Error generating video thumbnail: {str(e)}")
            raise
    
    def delete_file(self, s3_key: str) -> bool:
        """Delete file from S3"""
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            logger.info(f"Deleted S3 file: s3://{self.bucket_name}/{s3_key}")
            return True
        
        except ClientError as e:
            logger.error(f"Error deleting S3 file: {str(e)}")
            return False
    
    def get_public_url(self, s3_key: str) -> str:
        """
        Get public URL for S3 object via Nginx proxy (NO EXPIRATION)
        
        Args:
            s3_key: S3 object key (e.g., 'uploads/learning-content/file.png')
        
        Returns:
            Public HTTPS URL through Nginx proxy - valid indefinitely until deleted
        
        Note: URLs go through Nginx proxy which:
              - Adds CORS headers for browser access
              - Handles proper content delivery
              - Ensures consistent access from frontend
        """
        # Return Nginx proxy URL - Nginx forwards to S3 and adds CORS headers
        return f"https://43.204.218.16:3000/s3/{s3_key}"
    
    def create_s3_folders(self) -> bool:
        """Create standard folder structure in S3"""
        folders = [
            'uploads/learning-content/',
            'uploads/vlogs/',
            'uploads/reference_data/'
        ]
        
        try:
            for folder in folders:
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=folder
                )
                logger.info(f"Created S3 folder: {folder}")
            return True
        
        except ClientError as e:
            logger.error(f"Error creating S3 folders: {str(e)}")
            return False
