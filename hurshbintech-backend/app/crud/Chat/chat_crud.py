"""
CRUD Operations for Chat System
Database operations for conversations, messages, and read receipts
"""

from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy import and_, or_, desc, func
from sqlalchemy.orm import Session, joinedload

from app.models.Chat.chat_model import (
    Conversation,
    ConversationMember,
    ConversationType,
    Message,
    MessageType,
    ReadReceipt
)
from app.models.user_model import User


# ============ CONVERSATION OPERATIONS ============

def create_conversation(
    db: Session,
    conversation_type: ConversationType,
    member_ids: List[int],
    created_by: int,
    name: Optional[str] = None
) -> Conversation:
    """Create new conversation and add members"""
    conversation = Conversation(
        type=conversation_type,
        name=name,
        created_by=created_by
    )
    db.add(conversation)
    db.flush()  # Get conversation ID

    # Add members
    for user_id in member_ids:
        member = ConversationMember(
            conversation_id=conversation.id,
            user_id=user_id
        )
        db.add(member)

    db.commit()
    db.refresh(conversation)
    return conversation


def get_or_create_direct_conversation(
    db: Session,
    user1_id: int,
    user2_id: int
) -> Conversation:
    """Get existing direct conversation or create new one"""
    # Find existing direct conversation between two users
    existing = (
        db.query(Conversation)
        .filter(Conversation.type == ConversationType.DIRECT)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .filter(ConversationMember.user_id.in_([user1_id, user2_id]))
        .group_by(Conversation.id)
        .having(func.count(ConversationMember.id) == 2)
        .first()
    )

    if existing:
        # Verify both users are members
        member_ids = {m.user_id for m in existing.members}
        if user1_id in member_ids and user2_id in member_ids:
            return existing

    # Create new direct conversation
    return create_conversation(
        db=db,
        conversation_type=ConversationType.DIRECT,
        member_ids=[user1_id, user2_id],
        created_by=user1_id
    )


def get_user_conversations(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 50
) -> Tuple[List[Conversation], int]:
    """Get all conversations for a user with pagination"""
    query = (
        db.query(Conversation)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .filter(
            and_(
                ConversationMember.user_id == user_id,
                ConversationMember.is_active == True
            )
        )
        .options(
            joinedload(Conversation.members).joinedload(ConversationMember.user),
            joinedload(Conversation.messages).joinedload(Message.sender)
        )
        .order_by(desc(Conversation.updated_at))
    )

    total = query.count()
    conversations = query.offset(skip).limit(limit).all()

    return conversations, total


def get_conversation_by_id(db: Session, conversation_id: int) -> Optional[Conversation]:
    """Get conversation by ID with members and messages"""
    return (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id)
        .options(
            joinedload(Conversation.members).joinedload(ConversationMember.user),
            joinedload(Conversation.messages).joinedload(Message.sender)
        )
        .first()
    )


def is_user_in_conversation(db: Session, conversation_id: int, user_id: int) -> bool:
    """Check if user is a member of conversation"""
    member = (
        db.query(ConversationMember)
        .filter(
            and_(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id,
                ConversationMember.is_active == True
            )
        )
        .first()
    )
    return member is not None


def add_conversation_members(
    db: Session,
    conversation_id: int,
    user_ids: List[int]
) -> List[ConversationMember]:
    """Add members to a conversation (group chat)"""
    members = []
    for user_id in user_ids:
        # Check if already a member
        existing = (
            db.query(ConversationMember)
            .filter(
                and_(
                    ConversationMember.conversation_id == conversation_id,
                    ConversationMember.user_id == user_id
                )
            )
            .first()
        )

        if existing:
            if not existing.is_active:
                existing.is_active = True
                members.append(existing)
        else:
            member = ConversationMember(
                conversation_id=conversation_id,
                user_id=user_id
            )
            db.add(member)
            members.append(member)

    db.commit()
    return members


def remove_conversation_member(
    db: Session,
    conversation_id: int,
    user_id: int
) -> bool:
    """Remove member from conversation (soft delete)"""
    member = (
        db.query(ConversationMember)
        .filter(
            and_(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id
            )
        )
        .first()
    )

    if member:
        member.is_active = False
        db.commit()
        return True
    return False


# ============ MESSAGE OPERATIONS ============

def create_message(
    db: Session,
    conversation_id: int,
    sender_id: int,
    message_type: MessageType,
    content: Optional[str] = None,
    file_url: Optional[str] = None,
    file_name: Optional[str] = None,
    file_size: Optional[int] = None,
    mime_type: Optional[str] = None
) -> Message:
    """Create new message in conversation"""
    message = Message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        message_type=message_type,
        content=content,
        file_url=file_url,
        file_name=file_name,
        file_size=file_size,
        mime_type=mime_type
    )
    db.add(message)

    # Update conversation timestamp
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conversation:
        conversation.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(message)
    return message


def get_conversation_messages(
    db: Session,
    conversation_id: int,
    skip: int = 0,
    limit: int = 50,
    before_message_id: Optional[int] = None
) -> Tuple[List[Message], int, bool]:
    """Get messages for a conversation with pagination"""
    query = (
        db.query(Message)
        .filter(
            and_(
                Message.conversation_id == conversation_id,
                Message.is_deleted == False
            )
        )
        .options(
            joinedload(Message.sender),
            joinedload(Message.read_receipts).joinedload(ReadReceipt.user)
        )
        .order_by(desc(Message.created_at))
    )

    if before_message_id:
        # Get messages before a specific message (for pagination)
        before_message = db.query(Message).filter(Message.id == before_message_id).first()
        if before_message:
            query = query.filter(Message.created_at < before_message.created_at)

    total = query.count()
    messages = query.offset(skip).limit(limit).all()
    has_more = total > (skip + len(messages))

    # Reverse to get chronological order
    messages.reverse()

    return messages, total, has_more


def get_message_by_id(db: Session, message_id: int) -> Optional[Message]:
    """Get message by ID"""
    return (
        db.query(Message)
        .filter(Message.id == message_id)
        .options(
            joinedload(Message.sender),
            joinedload(Message.read_receipts).joinedload(ReadReceipt.user)
        )
        .first()
    )


def delete_message(db: Session, message_id: int, user_id: int) -> bool:
    """Soft delete message (only sender can delete)"""
    message = db.query(Message).filter(Message.id == message_id).first()
    if message and message.sender_id == user_id:
        message.is_deleted = True
        db.commit()
        return True
    return False


# ============ READ RECEIPT OPERATIONS ============

def mark_message_as_read(
    db: Session,
    message_id: int,
    user_id: int
) -> ReadReceipt:
    """Mark a message as read by user"""
    # Check if already read
    existing = (
        db.query(ReadReceipt)
        .filter(
            and_(
                ReadReceipt.message_id == message_id,
                ReadReceipt.user_id == user_id
            )
        )
        .first()
    )

    if existing:
        return existing

    receipt = ReadReceipt(
        message_id=message_id,
        user_id=user_id
    )
    db.add(receipt)
    db.commit()
    db.refresh(receipt)
    return receipt


def mark_conversation_as_read(
    db: Session,
    conversation_id: int,
    user_id: int,
    message_ids: Optional[List[int]] = None
) -> int:
    """Mark messages in conversation as read"""
    # Update last_read_at for user in conversation
    member = (
        db.query(ConversationMember)
        .filter(
            and_(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id
            )
        )
        .first()
    )

    if member:
        member.last_read_at = datetime.utcnow()

    # Get messages to mark as read
    query = (
        db.query(Message)
        .filter(
            and_(
                Message.conversation_id == conversation_id,
                Message.sender_id != user_id,  # Don't mark own messages
                Message.is_deleted == False
            )
        )
    )

    if message_ids:
        query = query.filter(Message.id.in_(message_ids))

    messages = query.all()

    # Create read receipts
    count = 0
    for message in messages:
        existing = (
            db.query(ReadReceipt)
            .filter(
                and_(
                    ReadReceipt.message_id == message.id,
                    ReadReceipt.user_id == user_id
                )
            )
            .first()
        )

        if not existing:
            receipt = ReadReceipt(
                message_id=message.id,
                user_id=user_id
            )
            db.add(receipt)
            count += 1

    db.commit()
    return count


def get_unread_count(db: Session, conversation_id: int, user_id: int) -> int:
    """Get unread message count for user in conversation"""
    member = (
        db.query(ConversationMember)
        .filter(
            and_(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id
            )
        )
        .first()
    )

    if not member:
        return 0

    query = (
        db.query(Message)
        .filter(
            and_(
                Message.conversation_id == conversation_id,
                Message.sender_id != user_id,
                Message.is_deleted == False
            )
        )
    )

    # Messages after last read
    if member.last_read_at:
        query = query.filter(Message.created_at > member.last_read_at)

    # Exclude messages with read receipts from this user
    query = query.outerjoin(
        ReadReceipt,
        and_(
            ReadReceipt.message_id == Message.id,
            ReadReceipt.user_id == user_id
        )
    ).filter(ReadReceipt.id == None)

    return query.count()


# ============ USER OPERATIONS ============

def get_all_active_users(db: Session) -> List[User]:
    """Get all active users for chat user list"""
    return db.query(User).filter(User.is_active == True).all()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Get user by ID"""
    return db.query(User).filter(User.id == user_id).first()
