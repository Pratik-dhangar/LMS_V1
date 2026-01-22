"""
CRUD Operations for Chat System
Database operations for conversations, messages, and read receipts
"""

from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy import and_, or_, desc, func, select
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession

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

async def create_conversation(
    db: AsyncSession,
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
    await db.flush()  # Get conversation ID

    # Add members
    for user_id in member_ids:
        member = ConversationMember(
            conversation_id=conversation.id,
            user_id=user_id
        )
        db.add(member)

    await db.commit()
    await db.refresh(conversation)
    return conversation


async def get_or_create_direct_conversation(
    db: AsyncSession,
    user1_id: int,
    user2_id: int
) -> Conversation:
    """Get existing direct conversation or create new one"""
    # Find existing direct conversation between two users
    result = await db.execute(
        select(Conversation)
        .where(Conversation.type == ConversationType.DIRECT)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .where(ConversationMember.user_id.in_([user1_id, user2_id]))
        .options(joinedload(Conversation.members))
    )
    conversations = result.scalars().unique().all()

    for conv in conversations:
        member_ids = {m.user_id for m in conv.members}
        if user1_id in member_ids and user2_id in member_ids:
            return conv

    # Create new direct conversation
    return await create_conversation(
        db=db,
        conversation_type=ConversationType.DIRECT,
        member_ids=[user1_id, user2_id],
        created_by=user1_id
    )


async def get_user_conversations(
    db: AsyncSession,
    user_id: int,
    skip: int = 0,
    limit: int = 50
) -> Tuple[List[Conversation], int]:
    """Get all conversations for a user with pagination"""
    # Get total count
    count_result = await db.execute(
        select(func.count(Conversation.id))
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .where(
            and_(
                ConversationMember.user_id == user_id,
                ConversationMember.is_active == True
            )
        )
    )
    total = count_result.scalar()

    # Get conversations
    result = await db.execute(
        select(Conversation)
        .join(ConversationMember, ConversationMember.conversation_id == Conversation.id)
        .where(
            and_(
                ConversationMember.user_id == user_id,
                ConversationMember.is_active == True
            )
        )
        .options(
            joinedload(Conversation.members).joinedload(ConversationMember.user),
            joinedload(Conversation.messages).joinedload(Message.sender),
            joinedload(Conversation.messages).joinedload(Message.read_receipts).joinedload(ReadReceipt.user)
        )
        .order_by(desc(Conversation.updated_at))
        .offset(skip)
        .limit(limit)
    )
    conversations = result.scalars().unique().all()

    return conversations, total


async def get_conversation_by_id(db: AsyncSession, conversation_id: int) -> Optional[Conversation]:
    """Get conversation by ID with members and messages"""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(
            joinedload(Conversation.members).joinedload(ConversationMember.user),
            joinedload(Conversation.messages).joinedload(Message.sender),
            joinedload(Conversation.messages).joinedload(Message.read_receipts).joinedload(ReadReceipt.user)
        )
    )
    return result.unique().scalar_one_or_none()


async def is_user_in_conversation(db: AsyncSession, conversation_id: int, user_id: int) -> bool:
    """Check if user is a member of conversation"""
    result = await db.execute(
        select(ConversationMember)
        .where(
            and_(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id,
                ConversationMember.is_active == True
            )
        )
    )
    member = result.scalar_one_or_none()
    return member is not None


async def add_conversation_members(
    db: AsyncSession,
    conversation_id: int,
    user_ids: List[int]
) -> List[ConversationMember]:
    """Add members to a conversation (group chat)"""
    members = []
    for user_id in user_ids:
        # Check if already a member
        result = await db.execute(
            select(ConversationMember)
            .where(
                and_(
                    ConversationMember.conversation_id == conversation_id,
                    ConversationMember.user_id == user_id
                )
            )
        )
        existing = result.scalar_one_or_none()

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

    await db.commit()
    return members


async def remove_conversation_member(
    db: AsyncSession,
    conversation_id: int,
    user_id: int
) -> bool:
    """Remove member from conversation (soft delete)"""
    result = await db.execute(
        select(ConversationMember)
        .where(
            and_(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id
            )
        )
    )
    member = result.scalar_one_or_none()

    if member:
        member.is_active = False
        await db.commit()
        return True
    return False


# ============ MESSAGE OPERATIONS ============

async def create_message(
    db: AsyncSession,
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
    result = await db.execute(
        select(Conversation).where(Conversation.id == conversation_id)
    )
    conversation = result.scalar_one_or_none()
    if conversation:
        conversation.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(message)
    
    # Eagerly load relationships to avoid lazy loading issues
    result = await db.execute(
        select(Message)
        .options(
            joinedload(Message.sender),
            joinedload(Message.read_receipts).joinedload(ReadReceipt.user)
        )
        .where(Message.id == message.id)
    )
    message = result.unique().scalar_one()
    
    return message


async def get_conversation_messages(
    db: AsyncSession,
    conversation_id: int,
    skip: int = 0,
    limit: int = 50,
    before_message_id: Optional[int] = None
) -> Tuple[List[Message], int, bool]:
    """Get messages for a conversation with pagination"""
    query = (
        select(Message)
        .where(
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
        # Get message to check its timestamp
        before_result = await db.execute(
            select(Message).where(Message.id == before_message_id)
        )
        before_message = before_result.scalar_one_or_none()
        if before_message:
            query = query.where(Message.created_at < before_message.created_at)

    # Get total count
    count_result = await db.execute(
        select(func.count(Message.id)).where(
            and_(
                Message.conversation_id == conversation_id,
                Message.is_deleted == False
            )
        )
    )
    total = count_result.scalar()

    # Get messages
    result = await db.execute(query.offset(skip).limit(limit))
    messages = result.scalars().unique().all()
    has_more = total > (skip + len(messages))

    # Reverse to get chronological order
    messages.reverse()

    return messages, total, has_more


async def get_message_by_id(db: AsyncSession, message_id: int) -> Optional[Message]:
    """Get message by ID"""
    result = await db.execute(
        select(Message)
        .where(Message.id == message_id)
        .options(
            joinedload(Message.sender),
            joinedload(Message.read_receipts).joinedload(ReadReceipt.user)
        )
    )
    return result.scalar_one_or_none()


async def delete_message(db: AsyncSession, message_id: int, user_id: int) -> bool:
    """Soft delete message (only sender can delete)"""
    result = await db.execute(
        select(Message).where(Message.id == message_id)
    )
    message = result.scalar_one_or_none()
    if message and message.sender_id == user_id:
        message.is_deleted = True
        await db.commit()
        return True
    return False


# ============ READ RECEIPT OPERATIONS ============

async def mark_message_as_read(
    db: AsyncSession,
    message_id: int,
    user_id: int
) -> ReadReceipt:
    """Mark a message as read by user"""
    # Check if already read
    result = await db.execute(
        select(ReadReceipt)
        .where(
            and_(
                ReadReceipt.message_id == message_id,
                ReadReceipt.user_id == user_id
            )
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        return existing

    receipt = ReadReceipt(
        message_id=message_id,
        user_id=user_id
    )
    db.add(receipt)
    await db.commit()
    await db.refresh(receipt)
    return receipt


async def mark_conversation_as_read(
    db: AsyncSession,
    conversation_id: int,
    user_id: int,
    message_ids: Optional[List[int]] = None
) -> int:
    """Mark messages in conversation as read"""
    # Update last_read_at for user in conversation
    result = await db.execute(
        select(ConversationMember)
        .where(
            and_(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id
            )
        )
    )
    member = result.scalar_one_or_none()

    if member:
        member.last_read_at = datetime.utcnow()

    # Get messages to mark as read
    query = select(Message).where(
        and_(
            Message.conversation_id == conversation_id,
            Message.sender_id != user_id,  # Don't mark own messages
            Message.is_deleted == False
        )
    )

    if message_ids:
        query = query.where(Message.id.in_(message_ids))

    msg_result = await db.execute(query)
    messages = msg_result.scalars().all()

    # Create read receipts
    count = 0
    for message in messages:
        result = await db.execute(
            select(ReadReceipt)
            .where(
                and_(
                    ReadReceipt.message_id == message.id,
                    ReadReceipt.user_id == user_id
                )
            )
        )
        existing = result.scalar_one_or_none()

        if not existing:
            receipt = ReadReceipt(
                message_id=message.id,
                user_id=user_id
            )
            db.add(receipt)
            count += 1

    await db.commit()
    return count


async def get_unread_count(db: AsyncSession, conversation_id: int, user_id: int) -> int:
    """Get unread message count for user in conversation"""
    result = await db.execute(
        select(ConversationMember)
        .where(
            and_(
                ConversationMember.conversation_id == conversation_id,
                ConversationMember.user_id == user_id
            )
        )
    )
    member = result.scalar_one_or_none()

    if not member:
        return 0

    query = select(Message).where(
        and_(
            Message.conversation_id == conversation_id,
            Message.sender_id != user_id,
            Message.is_deleted == False
        )
    )

    # Messages after last read
    if member.last_read_at:
        query = query.where(Message.created_at > member.last_read_at)

    # Exclude messages with read receipts from this user
    query = query.outerjoin(
        ReadReceipt,
        and_(
            ReadReceipt.message_id == Message.id,
            ReadReceipt.user_id == user_id
        )
    ).where(ReadReceipt.id == None)

    count_result = await db.execute(select(func.count(Message.id)).select_from(query.subquery()))
    return count_result.scalar() or 0


# ============ USER OPERATIONS ============

async def get_all_active_users(db: AsyncSession) -> List[User]:
    """Get all active users for chat user list"""
    result = await db.execute(
        select(User).where(User.is_active == True)
    )
    return result.scalars().all()


async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    """Get user by ID"""
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    return result.scalar_one_or_none()
