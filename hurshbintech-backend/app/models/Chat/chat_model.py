"""
SQLAlchemy ORM Models for Chat System
Supports 1-on-1 conversations and group chats
"""

import enum
from sqlalchemy import Boolean, Column, DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.session import Base


class ConversationType(enum.Enum):
    """Type of conversation"""
    DIRECT = "DIRECT"  # 1-on-1 chat
    GROUP = "GROUP"    # Group chat


class MessageType(enum.Enum):
    """Type of message content"""
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    AUDIO = "AUDIO"
    FILE = "FILE"


class Conversation(Base):
    """
    Represents a conversation (either direct 1-on-1 or group chat)
    """
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(SAEnum(ConversationType), nullable=False, default=ConversationType.DIRECT)
    name = Column(String(255), nullable=True)  # Group name (only for group chats)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # Group creator
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    members = relationship(
        "ConversationMember",
        back_populates="conversation",
        cascade="all, delete-orphan",
        passive_deletes=True
    )
    messages = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Message.created_at"
    )
    creator = relationship("User", foreign_keys=[created_by])


class ConversationMember(Base):
    """
    Represents membership in a conversation
    Tracks which users are part of which conversations
    """
    __tablename__ = "conversation_members"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    joined_at = Column(DateTime, default=func.now(), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)  # For soft delete / leaving group
    last_read_at = Column(DateTime, nullable=True)  # Track when user last read messages

    # Relationships
    conversation = relationship("Conversation", back_populates="members")
    user = relationship("User")


class Message(Base):
    """
    Represents a chat message in a conversation
    """
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    message_type = Column(SAEnum(MessageType), nullable=False, default=MessageType.TEXT)
    content = Column(Text, nullable=True)  # Text content or file caption
    file_url = Column(String(500), nullable=True)  # S3 or local file path
    file_name = Column(String(255), nullable=True)  # Original filename
    file_size = Column(BigInteger, nullable=True)  # File size in bytes
    mime_type = Column(String(100), nullable=True)  # MIME type of file
    created_at = Column(DateTime, default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)  # Soft delete

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])
    read_receipts = relationship(
        "ReadReceipt",
        back_populates="message",
        cascade="all, delete-orphan",
        passive_deletes=True
    )


class ReadReceipt(Base):
    """
    Tracks when users read messages
    """
    __tablename__ = "read_receipts"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    read_at = Column(DateTime, default=func.now(), nullable=False)

    # Relationships
    message = relationship("Message", back_populates="read_receipts")
    user = relationship("User")
