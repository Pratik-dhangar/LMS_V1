"""
File utility functions for handling uploads
Uses S3 for storage instead of local filesystem
"""
from fastapi import UploadFile, HTTPException
from typing import Optional
import os
from pathlib import Path
from app.utils.s3_utils import s3_manager, get_content_type_category

# Allowed file extensions
ALLOWED_EXTENSIONS = {
    'image': {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'},
    'video': {'.mp4', '.avi', '.mov', '.mkv', '.webm'},
    'audio': {'.mp3', '.wav', '.ogg', '.m4a', '.aac'},
    'pdf': {'.pdf'},
    'document': {'.doc', '.docx', '.txt', '.ppt', '.pptx', '.xls', '.xlsx', '.csv'}
}

# Maximum file sizes (in bytes)
MAX_FILE_SIZES = {
    'image': 10 * 1024 * 1024,      # 10 MB
    'video': 500 * 1024 * 1024,     # 500 MB
    'audio': 50 * 1024 * 1024,      # 50 MB
    'pdf': 20 * 1024 * 1024,        # 20 MB
    'document': 20 * 1024 * 1024    # 20 MB
}

def validate_file(file: UploadFile, allowed_types: list = None) -> tuple[bool, str]:
    """
    Validate file type and size
    
    Args:
        file: UploadFile object
        allowed_types: List of allowed content types (e.g., ['image', 'pdf'])
        
    Returns:
        Tuple of (is_valid: bool, message: str)
    """
    if not file or not file.filename:
        return False, "No file provided"
    
    # Get file extension
    file_extension = Path(file.filename).suffix.lower()
    
    # Determine content category
    content_category = get_content_type_category(file.filename)
    
    # Check if content type is allowed
    if allowed_types and content_category not in allowed_types:
        return False, f"File type not allowed. Allowed types: {', '.join(allowed_types)}"
    
    # Check file extension
    all_allowed_extensions = set()
    for category in (allowed_types or ALLOWED_EXTENSIONS.keys()):
        all_allowed_extensions.update(ALLOWED_EXTENSIONS.get(category, set()))
    
    if file_extension not in all_allowed_extensions:
        return False, f"File extension '{file_extension}' not allowed"
    
    # Check file size (if file.size is available)
    if hasattr(file, 'size') and file.size:
        max_size = MAX_FILE_SIZES.get(content_category, 50 * 1024 * 1024)
        if file.size > max_size:
            max_size_mb = max_size / (1024 * 1024)
            return False, f"File size exceeds maximum allowed size of {max_size_mb:.0f} MB"
    
    return True, "File is valid"

async def upload_file_to_s3(
    file: UploadFile,
    folder: str,
    allowed_types: list = None,
    make_public: bool = True
) -> dict:
    """
    Validate and upload file to S3
    
    Args:
        file: UploadFile object
        folder: S3 folder path (e.g., "learning_content", "vlogs")
        allowed_types: List of allowed content types
        make_public: Whether file should be publicly accessible
        
    Returns:
        Dictionary with file information
        
    Raises:
        HTTPException if validation fails or upload fails
    """
    # Validate file
    is_valid, message = validate_file(file, allowed_types)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    try:
        # Upload to S3
        result = await s3_manager.upload_file(
            file=file,
            folder=folder,
            make_public=make_public
        )
        
        return result
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload file: {str(e)}"
        )

def delete_file_from_s3(file_url: str) -> bool:
    """
    Delete file from S3 using its URL
    
    Args:
        file_url: Full S3 URL
        
    Returns:
        True if successful, False otherwise
    """
    try:
        return s3_manager.delete_file_by_url(file_url)
    except Exception as e:
        print(f"Error deleting file from S3: {str(e)}")
        return False

def get_file_url(s3_key: str) -> str:
    """
    Generate public S3 URL from key
    
    Args:
        s3_key: S3 object key
        
    Returns:
        Public S3 URL
    """
    bucket_name = os.getenv('S3_BUCKET_NAME', 'hurshbintech-media-bucket')
    region = os.getenv('AWS_REGION', 'ap-south-1')
    return f"https://{bucket_name}.s3.{region}.amazonaws.com/{s3_key}"