"""
Pydantic Schemas for Chat System
Request and response models for chat operations
"""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, validator

from app.models.Chat.chat_model import ConversationType, MessageType


# ============ USER SCHEMAS ============

class ChatUserBase(BaseModel):
    """Basic user info for chat"""
    id: int
    name: str
    email: Optional[str]
    role: str


class ChatUserResponse(ChatUserBase):
    """User response with online status"""
    is_online: bool = False
    last_seen: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ CONVERSATION SCHEMAS ============

class ConversationCreate(BaseModel):
    """Create new conversation (direct or group)"""
    type: ConversationType
    name: Optional[str] = None  # Required for groups
    member_ids: List[int] = Field(..., min_length=1)  # User IDs to add

    @validator('name')
    def validate_group_name(cls, v, values):
        if values.get('type') == ConversationType.GROUP and not v:
            raise ValueError('Group name is required for group conversations')
        return v


class ConversationMemberResponse(BaseModel):
    """Conversation member info"""
    user_id: int
    user_name: str
    user_role: str
    joined_at: datetime
    is_active: bool
    last_read_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    """Conversation details"""
    id: int
    type: ConversationType
    name: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    members: List[ConversationMemberResponse] = []
    unread_count: int = 0
    last_message: Optional['MessageResponse'] = None

    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    """List of conversations with pagination"""
    conversations: List[ConversationResponse]
    total: int


# ============ MESSAGE SCHEMAS ============

class MessageCreate(BaseModel):
    """Create new message"""
    conversation_id: int
    content: Optional[str] = None
    message_type: MessageType = MessageType.TEXT

    @validator('content')
    def validate_content(cls, v, values):
        if values.get('message_type') == MessageType.TEXT and not v:
            raise ValueError('Content is required for text messages')
        return v


class MessageFileUpload(BaseModel):
    """Message with file upload"""
    conversation_id: int
    message_type: MessageType
    content: Optional[str] = None  # Caption for file


class ReadReceiptResponse(BaseModel):
    """Read receipt info"""
    user_id: int
    user_name: str
    read_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    """Message details"""
    id: int
    conversation_id: int
    sender_id: Optional[int]
    sender_name: Optional[str]
    message_type: MessageType
    content: Optional[str]
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    read_receipts: List[ReadReceiptResponse] = []

    class Config:
        from_attributes = True


class MessageListResponse(BaseModel):
    """List of messages with pagination"""
    messages: List[MessageResponse]
    total: int
    has_more: bool


# ============ WEBSOCKET SCHEMAS ============

class WSMessageBase(BaseModel):
    """Base WebSocket message"""
    type: str


class WSJoinMessage(WSMessageBase):
    """User joining chat"""
    type: str = "join"
    user_id: int
    token: str  # JWT token for authentication


class WSTypingMessage(WSMessageBase):
    """User typing indicator"""
    type: str = "typing"
    conversation_id: int
    is_typing: bool


class WSMessageSent(WSMessageBase):
    """New message sent"""
    type: str = "message"
    message: MessageResponse


class WSMessageRead(WSMessageBase):
    """Message read receipt"""
    type: str = "message_read"
    message_id: int
    conversation_id: int


class WSUserOnline(WSMessageBase):
    """User online status"""
    type: str = "user_online"
    user_id: int
    is_online: bool


class WSUserTyping(WSMessageBase):
    """User typing status broadcast"""
    type: str = "user_typing"
    conversation_id: int
    user_id: int
    user_name: str
    is_typing: bool


# ============ UTILITY SCHEMAS ============

class MessageReadUpdate(BaseModel):
    """Mark messages as read"""
    conversation_id: int
    message_ids: List[int] = []  # Empty means mark all in conversation


class ConversationMemberAdd(BaseModel):
    """Add members to group"""
    user_ids: List[int] = Field(..., min_length=1)


class ConversationMemberRemove(BaseModel):
    """Remove member from group"""
    user_id: int


class OnlineStatusResponse(BaseModel):
    """Online users status"""
    online_users: List[int]  # List of online user IDs


# Forward reference update
ConversationResponse.model_rebuild()
