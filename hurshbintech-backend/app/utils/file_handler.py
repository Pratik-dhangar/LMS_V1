"""
File upload handler - conditionally uses S3 or local storage based on configuration
"""

import asyncio
import os
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.utils.s3_utils import S3Manager

# Create local uploads directory
LOCAL_UPLOAD_DIR = Path("uploads")
LOCAL_UPLOAD_DIR.mkdir(exist_ok=True)


async def upload_file(
    file_content: bytes,
    folder: str,
    filename: str,
    content_type: str = "application/octet-stream",
) -> str:
    """
    Upload file - uses S3 if enabled, otherwise stores locally
    
    Args:
        file_content: File bytes to upload
        folder: Folder/directory name (e.g., 'products', 'receipts/order-id')
        filename: Original filename
        content_type: MIME type of the file
    
    Returns:
        File URL or path
    """
    
    if settings.USE_S3:
        # Upload to S3 (non-async call, but wrapped in async function for consistency)
        try:
            s3_manager = S3Manager(bucket_name=settings.S3_BUCKET_NAME)
            s3_path = s3_manager.upload_file(
                file_content=file_content,
                folder=folder,
                filename=filename,
                content_type=content_type,
            )
            return s3_path
        except Exception as e:
            raise Exception(f"Failed to upload to S3: {str(e)}")
    else:
        # Store locally - run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, 
            save_file_locally, 
            file_content, 
            folder, 
            filename
        )


def save_file_locally(
    file_content: bytes,
    folder: str,
    filename: str,
) -> str:
    """
    Save file to local filesystem
    
    Args:
        file_content: File bytes to save
        folder: Folder path (e.g., 'products', 'receipts/order-id')
        filename: Filename to save as
    
    Returns:
        Relative file path (can be served by static file handler)
    """
    
    # Create folder structure
    folder_path = LOCAL_UPLOAD_DIR / folder
    folder_path.mkdir(parents=True, exist_ok=True)
    
    # Save file
    file_path = folder_path / filename
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    # Return relative path for storage in DB
    # e.g., "uploads/products/filename.jpg"
    relative_path = str(file_path).replace("\\", "/")
    return relative_path
