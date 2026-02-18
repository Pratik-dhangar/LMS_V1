"""
S3 Upload Utilities for AWS Integration
Handles file uploads, thumbnails, and media management
"""

import io
import logging
import mimetypes
import os
import uuid
from typing import Optional, Tuple

import boto3
import cv2
from botocore.config import Config
from botocore.exceptions import ClientError
from PIL import Image

logger = logging.getLogger(__name__)


class S3Manager:
    """Manages S3 uploads and media processing"""

    def __init__(self, bucket_name: str, region: str = "ap-south-1"):
        """Initialize S3 client"""
        self.bucket_name = bucket_name
        self.region = region
        
        # Support S3-compatible services (Neev Cloud, MinIO, etc.)
        endpoint_url = os.getenv("S3_ENDPOINT_URL")
        
        # Force path-style addressing for S3-compatible services
        # (virtual-host style won't work with custom endpoints)
        s3_config = Config(s3={"addressing_style": "path"}) if endpoint_url else None
        
        self.s3_client = boto3.client(
            "s3",
            region_name=region,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            endpoint_url=endpoint_url,
            config=s3_config,
        )
        
        # Build S3 URL based on endpoint
        if endpoint_url:
            self.s3_url = f"{endpoint_url}/{bucket_name}"
        else:
            self.s3_url = f"https://{bucket_name}.s3.{region}.amazonaws.com"

    def upload_file(
        self,
        file_content: bytes,
        folder: str,
        filename: Optional[str] = None,
        content_type: str = "application/octet-stream",
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
                ext = mimetypes.guess_extension(content_type) or ".bin"
                filename = f"{uuid.uuid4()}{ext}"

            # Create S3 key with folder
            s3_key = f"uploads/{folder}/{filename}"

            # Upload to S3
            self.s3_client.put_object(
                Bucket=self.bucket_name, Key=s3_key, Body=file_content, ContentType=content_type
            )

            logger.info(f"Uploaded file to S3: s3://{self.bucket_name}/{s3_key}")
            return s3_key

        except ClientError as e:
            logger.error(f"Error uploading to S3: {str(e)}")
            raise

    def generate_thumbnail(
        self, file_content: bytes, file_type: str, size: Tuple[int, int] = (300, 300)
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
            if file_type == "image":
                return self._generate_image_thumbnail(file_content, size)
            elif file_type == "video":
                return self._generate_video_thumbnail(file_content, size)
            else:
                logger.warning(f"Cannot generate thumbnail for file type: {file_type}")
                return None

        except Exception as e:
            logger.error(f"Error generating thumbnail: {str(e)}")
            return None

    def _generate_image_thumbnail(
        self, file_content: bytes, size: Tuple[int, int] = (300, 300)
    ) -> bytes:
        """Generate thumbnail for image"""
        try:
            # Open image from bytes
            img = Image.open(io.BytesIO(file_content))

            # Convert RGBA to RGB if necessary
            if img.mode in ("RGBA", "LA", "P"):
                background = Image.new("RGB", img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
                img = background

            # Create thumbnail
            img.thumbnail(size, Image.Resampling.LANCZOS)

            # Save to bytes
            thumbnail_bytes = io.BytesIO()
            img.save(thumbnail_bytes, format="JPEG", quality=85)
            thumbnail_bytes.seek(0)

            return thumbnail_bytes.getvalue()

        except Exception as e:
            logger.error(f"Error generating image thumbnail: {str(e)}")
            raise

    def _generate_video_thumbnail(
        self, file_content: bytes, size: Tuple[int, int] = (300, 300)
    ) -> bytes:
        """Generate thumbnail from video (extract first frame)"""
        try:
            # Save video temporarily
            temp_video = f"/tmp/temp_video_{uuid.uuid4()}.mp4"
            with open(temp_video, "wb") as f:
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
            img.save(thumbnail_bytes, format="JPEG", quality=85)
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
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=s3_key)
            logger.info(f"Deleted S3 file: s3://{self.bucket_name}/{s3_key}")
            return True

        except ClientError as e:
            logger.error(f"Error deleting S3 file: {str(e)}")
            return False

    def generate_signed_url(self, s3_key: str, expiration_seconds: int = 3600) -> str:
        """
        Generate a signed URL for S3 object (valid for 1 hour by default)
        
        Args:
            s3_key: S3 object key
            expiration_seconds: URL expiration time in seconds (default: 3600 = 1 hour)
        
        Returns:
            Signed URL string
        """
        try:
            signed_url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': s3_key},
                ExpiresIn=expiration_seconds
            )
            logger.info(f"Generated signed URL for: s3://{self.bucket_name}/{s3_key}")
            return signed_url
        except ClientError as e:
            logger.error(f"Error generating signed URL: {str(e)}")
            raise

    def get_public_url(self, s3_key: str) -> str:
        """
        Get public/signed URL for S3 object
        - If public access is configured, returns direct S3 URL
        - Otherwise, returns signed URL valid for 1 hour
        """
        try:
            # Try to generate a signed URL (works even without public access)
            return self.generate_signed_url(s3_key, expiration_seconds=3600)
        except Exception as e:
            logger.warning(f"Could not generate signed URL: {str(e)}")
            # Fallback to direct S3 URL (will work only if bucket is public)
            return f"{self.s3_url}/{s3_key}"

    def create_s3_folders(self) -> bool:
        """Create standard folder structure in S3"""
        folders = [
            "uploads/learning-content/",
            "uploads/vlogs/",
            "uploads/reference_data/",
            "uploads/profile_pictures/",
            "uploads/coach_references/",
            "uploads/payment_screenshots/",
            "uploads/session_recordings/",
            "uploads/trainings/thumbnails/",
            "uploads/trainings/learning-materials/",
        ]

        try:
            for folder in folders:
                self.s3_client.put_object(Bucket=self.bucket_name, Key=folder)
                logger.info(f"Created S3 folder: {folder}")
            return True

        except ClientError as e:
            logger.error(f"Error creating S3 folders: {str(e)}")
            return False


# ============ HELPER FUNCTIONS ============


async def upload_to_s3(file: "UploadFile", s3_path: str) -> str:
    """
    Helper function to upload file to S3 and return public URL
    
    Args:
        file: FastAPI UploadFile object
        s3_path: Path within bucket (e.g., 'profile_pictures/filename.jpg')
    
    Returns:
        Public URL to access the file
    
    Raises:
        Exception if upload fails
    """
    from app.core.config import settings
    
    if not settings.USE_S3:
        raise ValueError("S3 is not enabled. Set USE_S3=true in environment")
    
    try:
        # Initialize S3 manager
        s3_manager = S3Manager(settings.S3_BUCKET_NAME, settings.AWS_REGION)
        
        # Read file content
        file_content = await file.read()
        
        # Determine content type
        content_type = file.content_type or "application/octet-stream"
        
        # Extract filename from s3_path
        filename = s3_path.split("/")[-1]
        
        # Get folder from s3_path (everything except the filename)
        folder = "/".join(s3_path.split("/")[:-1]) if "/" in s3_path else ""
        
        # Upload to S3
        s3_key = s3_manager.upload_file(
            file_content=file_content,
            folder=folder,
            filename=filename,
            content_type=content_type,
        )
        
        # Return public URL
        public_url = s3_manager.get_public_url(s3_key)
        
        logger.info(f"Successfully uploaded {s3_path} to S3: {public_url}")
        return public_url
        
    except Exception as e:
        logger.error(f"Failed to upload {s3_path} to S3: {str(e)}")
        raise

def convert_s3_url_to_signed(file_url: str, bucket_name: str = None, region: str = "ap-south-1") -> str:
    """
    Convert s3://bucket/key format URL to signed URL
    
    Args:
        file_url: S3 URL in s3://bucket/key format or local path
        bucket_name: S3 bucket name (uses settings.S3_BUCKET_NAME if not provided)
        region: AWS region (default: ap-south-1)
    
    Returns:
        Signed URL or original path if not S3
    """
    try:
        if not file_url:
            return file_url
            
        # If it's already a signed/public URL, return as-is
        if file_url.startswith('http://') or file_url.startswith('https://'):
            return file_url
        
        # If it's not an S3 URL, return as-is
        if not file_url.startswith('s3://'):
            return file_url
        
        from app.core.config import settings
        
        bucket = bucket_name or settings.S3_BUCKET_NAME
        
        # Extract S3 key from s3://bucket/key format
        s3_key = file_url.replace(f"s3://{bucket}/", "")
        
        # Generate signed URL
        manager = S3Manager(bucket, region)
        signed_url = manager.get_public_url(s3_key)
        
        logger.info(f"Converted S3 URL to signed URL: {file_url} -> [signed]")
        return signed_url
        
    except Exception as e:
        logger.warning(f"Error converting S3 URL {file_url}: {str(e)}")
        # Return original URL as fallback
        return file_url