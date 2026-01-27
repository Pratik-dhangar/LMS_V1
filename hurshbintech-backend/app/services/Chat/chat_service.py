"""
Chat Service Layer
Business logic for chat operations and file handling
"""

import logging
import mimetypes
import os
from pathlib import Path
from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.Chat.chat_model import MessageType
from app.utils.s3_utils import S3Manager

logger = logging.getLogger(__name__)

# Initialize S3 manager if using S3
s3_manager = None
if settings.USE_S3:
    try:
        s3_manager = S3Manager(bucket_name=settings.S3_BUCKET_NAME)
    except Exception as e:
        logger.warning(f"Failed to initialize S3Manager: {str(e)}")


class ChatFileService:
    """Handle file uploads and storage for chat messages"""

    # Maximum file size: 60MB
    MAX_FILE_SIZE = 60 * 1024 * 1024

    # Allowed file types
    ALLOWED_MIMETYPES = {
        # Images
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
        # Videos
        "video/mp4",
        "video/webm",
        "video/ogg",
        "video/quicktime",
        # Audio
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/ogg",
        "audio/webm",
        # Documents
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "text/csv",
        # Archives
        "application/zip",
        "application/x-rar-compressed",
        "application/x-7z-compressed",
    }

    @classmethod
    def get_message_type_from_mime(cls, mime_type: str) -> MessageType:
        """Determine message type from MIME type"""
        if mime_type.startswith("image/"):
            return MessageType.IMAGE
        elif mime_type.startswith("video/"):
            return MessageType.VIDEO
        elif mime_type.startswith("audio/"):
            return MessageType.AUDIO
        else:
            return MessageType.FILE

    @classmethod
    async def validate_and_upload_file(
        cls,
        file: UploadFile,
        user_id: int,
        conversation_id: int
    ) -> Tuple[str, str, int, MessageType]:
        """
        Validate and upload file for chat message
        Returns: (file_url, file_name, file_size, message_type)
        """
        # Read file content
        content = await file.read()
        file_size = len(content)

        # Validate file size
        if file_size > cls.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File size exceeds maximum allowed size of {cls.MAX_FILE_SIZE / (1024 * 1024)}MB"
            )

        # Validate MIME type
        mime_type = file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
        
        if mime_type not in cls.ALLOWED_MIMETYPES:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{mime_type}' is not allowed"
            )

        # Determine message type
        message_type = cls.get_message_type_from_mime(mime_type)

        # Generate file path
        file_extension = Path(file.filename).suffix
        safe_filename = f"chat_{conversation_id}_{user_id}_{int(os.urandom(8).hex(), 16)}{file_extension}"

        # Upload file
        if settings.USE_S3 and s3_manager:
            # Upload to S3 - Production
            s3_key = f"uploads/chats/{conversation_id}/{safe_filename}"
            try:
                file_url = s3_manager.upload_file(
                    file_content=content,
                    s3_key=s3_key,
                    content_type=mime_type
                )
                logger.info(f"Uploaded chat file to S3: {s3_key}")
            except Exception as e:
                logger.error(f"Error uploading file to S3: {e}")
                raise HTTPException(status_code=500, detail="File upload failed")
        else:
            # Upload to local storage - Development
            upload_dir = Path("uploads") / "chats" / str(conversation_id)
            upload_dir.mkdir(parents=True, exist_ok=True)
            
            file_path = upload_dir / safe_filename
            with open(file_path, "wb") as f:
                f.write(content)
            
            file_url = f"/uploads/chats/{conversation_id}/{safe_filename}"
            logger.info(f"Uploaded chat file locally: {file_path}")

        return file_url, file.filename, file_size, message_type

    @classmethod
    def get_public_url(cls, file_url: str) -> str:
        """
        Convert file URL to public URL
        For S3: Generate presigned URL or use public URL
        For local: Return as-is
        """
        try:
            if settings.USE_S3 and s3_manager and file_url.startswith("s3://"):
                s3_key = file_url.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
                return s3_manager.get_public_url(s3_key)
            return file_url
        except Exception as e:
            logger.error(f"Error generating public URL: {e}")
            return file_url


class ChatPermissionService:
    """Handle permission checks for chat operations"""

    ADMIN_ROLES = {"ADMIN", "HEAD", "TRAINER", "COACH"}

    @classmethod
    def can_create_group(cls, user_role: str) -> bool:
        """Check if user can create group chats"""
        return user_role in cls.ADMIN_ROLES

    @classmethod
    def can_add_members(cls, user_role: str, creator_id: int, user_id: int) -> bool:
        """Check if user can add members to a group"""
        # Admin roles or group creator can add members
        return user_role in cls.ADMIN_ROLES or creator_id == user_id

    @classmethod
    def can_remove_members(cls, user_role: str, creator_id: int, user_id: int) -> bool:
        """Check if user can remove members from a group"""
        # Admin roles or group creator can remove members
        return user_role in cls.ADMIN_ROLES or creator_id == user_id

    @classmethod
    def can_delete_message(cls, user_id: int, message_sender_id: int, user_role: str) -> bool:
        """Check if user can delete a message"""
        # User can delete their own messages or admin can delete any message
        return user_id == message_sender_id or user_role == "ADMIN"


def build_message_response(message, current_user_id: int = None) -> dict:
    """
    Build message response dictionary with all details
    """
    from app.services.Chat.chat_connection_manager import chat_manager
    
    # Get sender info
    sender_name = message.sender.name if message.sender else "Unknown User"
    
    # Build read receipts
    read_receipts = []
    for receipt in message.read_receipts:
        if receipt.user:
            read_receipts.append({
                "user_id": receipt.user_id,
                "user_name": receipt.user.name,
                "read_at": receipt.read_at.isoformat()
            })
    
    # Get public file URL if file exists
    file_url = None
    if message.file_url:
        file_url = ChatFileService.get_public_url(message.file_url)
    
    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "sender_id": message.sender_id,
        "sender_name": sender_name,
        "message_type": message.message_type.value,
        "content": message.content,
        "file_url": file_url,
        "file_name": message.file_name,
        "file_size": message.file_size,
        "mime_type": message.mime_type,
        "created_at": message.created_at.isoformat(),
        "updated_at": message.updated_at.isoformat(),
        "is_deleted": message.is_deleted,
        "read_receipts": read_receipts
    }


async def build_conversation_response(
    conversation, 
    current_user_id: int, 
    db,
    prefetched_last_message=None
) -> dict:
    """
    Build conversation response dictionary with all details
    Performance optimized: accepts prefetched_last_message to avoid loading all messages
    """
    from app.crud.Chat import chat_crud
    
    # Build members list
    members = []
    member_ids = []
    for member in conversation.members:
        if member.is_active and member.user:
            member_ids.append(member.user_id)
            members.append({
                "user_id": member.user_id,
                "user_name": member.user.name,
                "user_role": member.user.role.value,
                "joined_at": member.joined_at.isoformat(),
                "is_active": member.is_active,
                "last_read_at": member.last_read_at.isoformat() if member.last_read_at else None
            })
    
    # Get last message - use prefetched if available (performance optimization)
    last_message = None
    if prefetched_last_message is not None:
        # Use the efficiently fetched message
        last_message = build_message_response(prefetched_last_message, current_user_id)
    # Note: We removed the fallback to conversation.messages to prevent lazy loading
    # All callers should now provide prefetched_last_message when needed
    
    # Get unread count
    unread_count = await chat_crud.get_unread_count(db, conversation.id, current_user_id)
    
    # For direct conversations, set name as other user's name
    conversation_name = conversation.name
    if conversation.type.value == "DIRECT" and len(members) == 2:
        other_member = next((m for m in members if m["user_id"] != current_user_id), None)
        if other_member:
            conversation_name = other_member["user_name"]
    
    return {
        "id": conversation.id,
        "type": conversation.type.value,
        "name": conversation_name,
        "created_by": conversation.created_by,
        "created_at": conversation.created_at.isoformat(),
        "updated_at": conversation.updated_at.isoformat(),
        "members": members,
        "member_ids": member_ids,
        "unread_count": unread_count,
        "last_message": last_message
    }
