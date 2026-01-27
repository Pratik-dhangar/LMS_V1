"""
Chat API Endpoints
REST and WebSocket endpoints for chat system
"""

import logging
from typing import List, Optional
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
    status
)
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user
from app.crud.Chat import chat_crud
from app.db.session import get_db
from app.models.Chat.chat_model import ConversationType, MessageType
from app.models.user_model import User, UserRole
from app.schemas.Chat.chat_schema import (
    ConversationCreate,
    ConversationListResponse,
    ConversationMemberAdd,
    ConversationMemberRemove,
    ConversationResponse,
    MessageCreate,
    MessageListResponse,
    MessageReadUpdate,
    OnlineStatusResponse,
    ChatUserResponse,
    WSJoinMessage,
    WSTypingMessage,
    WSMessageRead
)
from app.services.Chat.chat_connection_manager import chat_manager
from app.services.Chat.chat_service import (
    ChatFileService,
    ChatPermissionService,
    build_conversation_response,
    build_message_response
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])


# ============ REST ENDPOINTS ============

@router.get("/users", response_model=List[ChatUserResponse])
async def get_all_chat_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all active users in the system for chat (excluding current user)
    All users are visible to all users
    """
    users = await chat_crud.get_all_active_users(db)
    online_user_ids = chat_manager.get_online_users()
    
    user_responses = []
    for user in users:
        # Exclude current user from the list
        if user.id == current_user.id:
            continue
            
        user_responses.append({
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role.value,
            "is_online": user.id in online_user_ids,
            "last_seen": None  # Can be enhanced with last_activity tracking
        })
    
    return user_responses


@router.get("/conversations", response_model=ConversationListResponse)
async def get_conversations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all conversations for the current user
    Performance optimized: fetches latest messages efficiently
    """
    conversations, total = await chat_crud.get_user_conversations(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit
    )
    
    # Optimize: Fetch latest messages in ONE query instead of N queries
    latest_msgs_map = await chat_crud.populate_latest_messages(db, conversations)
    
    conversation_responses = []
    for conv in conversations:
        # Pass the pre-fetched last message to avoid lazy loading
        last_message_obj = latest_msgs_map.get(conv.id)
        conversation_responses.append(
            await build_conversation_response(
                conv, 
                current_user.id, 
                db,
                prefetched_last_message=last_message_obj
            )
        )
    
    return {
        "conversations": conversation_responses,
        "total": total
    }


@router.post("/conversations", response_model=ConversationResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    conversation_data: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create new conversation (direct or group)
    - Direct: 1-on-1 chat with another user
    - Group: Only ADMIN, HEAD, TRAINER, COACH can create groups
    """
    # Check permissions for group creation
    if conversation_data.type == ConversationType.GROUP:
        if not ChatPermissionService.can_create_group(current_user.role.value):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to create group chats"
            )
    
    # For direct conversations, ensure exactly 1 other user
    if conversation_data.type == ConversationType.DIRECT:
        if len(conversation_data.member_ids) != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Direct conversation must have exactly 1 other user"
            )
        
        # Check if conversation already exists
        other_user_id = conversation_data.member_ids[0]
        existing_conv = await chat_crud.get_or_create_direct_conversation(
            db=db,
            user1_id=current_user.id,
            user2_id=other_user_id
        )
        
        # Fetch last message efficiently
        latest_msgs_map = await chat_crud.populate_latest_messages(db, [existing_conv])
        last_message = latest_msgs_map.get(existing_conv.id)
        
        return await build_conversation_response(
            existing_conv, 
            current_user.id, 
            db,
            prefetched_last_message=last_message
        )
    
    # Validate all member IDs exist
    for user_id in conversation_data.member_ids:
        user = await chat_crud.get_user_by_id(db, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )
    
    # Add current user to members if not included
    if current_user.id not in conversation_data.member_ids:
        conversation_data.member_ids.append(current_user.id)
    
    # Create group conversation
    conversation = await chat_crud.create_conversation(
        db=db,
        conversation_type=conversation_data.type,
        member_ids=conversation_data.member_ids,
        created_by=current_user.id,
        name=conversation_data.name
    )
    
    # Notify all members via WebSocket
    # New conversation has no messages yet, so pass None for prefetched_last_message
    conv_response = await build_conversation_response(
        conversation, 
        current_user.id, 
        db,
        prefetched_last_message=None
    )
    await chat_manager.broadcast_conversation_update(
        conversation_id=conversation.id,
        member_ids=conversation_data.member_ids,
        update_type="conversation_created",
        data=conv_response
    )
    
    return conv_response


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get conversation details by ID
    """
    # Check if user is member of conversation
    if not await chat_crud.is_user_in_conversation(db, conversation_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this conversation"
        )
    
    conversation = await chat_crud.get_conversation_by_id(db, conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Fetch last message efficiently
    latest_msgs_map = await chat_crud.populate_latest_messages(db, [conversation])
    last_message = latest_msgs_map.get(conversation.id)
    
    return await build_conversation_response(
        conversation, 
        current_user.id, 
        db,
        prefetched_last_message=last_message
    )


@router.post("/conversations/{conversation_id}/members")
async def add_conversation_members(
    conversation_id: int,
    member_data: ConversationMemberAdd,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Add members to a group conversation
    Only group creator or ADMIN/HEAD/TRAINER/COACH can add members
    """
    conversation = await chat_crud.get_conversation_by_id(db, conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if conversation.type != ConversationType.GROUP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only add members to group conversations"
        )
    
    # Check permissions
    if not ChatPermissionService.can_add_members(
        current_user.role.value,
        conversation.created_by,
        current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to add members to this group"
        )
    
    # Add members
    new_members = await chat_crud.add_conversation_members(
        db=db,
        conversation_id=conversation_id,
        user_ids=member_data.user_ids
    )
    
    # Get updated member list
    updated_conversation = await chat_crud.get_conversation_by_id(db, conversation_id)
    all_member_ids = [m.user_id for m in updated_conversation.members if m.is_active]
    
    # Notify all members
    await chat_manager.broadcast_conversation_update(
        conversation_id=conversation_id,
        member_ids=all_member_ids,
        update_type="members_added",
        data={
            "added_by": current_user.id,
            "added_members": [m.user_id for m in new_members]
        }
    )
    
    return {"message": "Members added successfully", "count": len(new_members)}


@router.delete("/conversations/{conversation_id}/members")
async def remove_conversation_member(
    conversation_id: int,
    member_data: ConversationMemberRemove,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Remove member from group conversation
    Only group creator or ADMIN/HEAD/TRAINER/COACH can remove members
    Users can also leave the group themselves
    """
    conversation = await chat_crud.get_conversation_by_id(db, conversation_id)
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if conversation.type != ConversationType.GROUP:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only remove members from group conversations"
        )
    
    # Users can remove themselves (leave group)
    if member_data.user_id != current_user.id:
        # Check permissions to remove others
        if not ChatPermissionService.can_remove_members(
            current_user.role.value,
            conversation.created_by,
            current_user.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to remove members from this group"
            )
    
    # Remove member
    removed = await chat_crud.remove_conversation_member(
        db=db,
        conversation_id=conversation_id,
        user_id=member_data.user_id
    )
    
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in conversation"
        )
    
    # Get remaining members
    updated_conversation = await chat_crud.get_conversation_by_id(db, conversation_id)
    remaining_member_ids = [m.user_id for m in updated_conversation.members if m.is_active]
    
    # Notify remaining members
    await chat_manager.broadcast_conversation_update(
        conversation_id=conversation_id,
        member_ids=remaining_member_ids,
        update_type="member_removed",
        data={
            "removed_by": current_user.id,
            "removed_member": member_data.user_id
        }
    )
    
    return {"message": "Member removed successfully"}


@router.get("/conversations/{conversation_id}/messages", response_model=MessageListResponse)
async def get_conversation_messages(
    conversation_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    before_message_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get messages for a conversation with pagination
    """
    # Check if user is member of conversation
    if not await chat_crud.is_user_in_conversation(db, conversation_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this conversation"
        )
    
    messages, total, has_more = await chat_crud.get_conversation_messages(
        db=db,
        conversation_id=conversation_id,
        skip=skip,
        limit=limit,
        before_message_id=before_message_id
    )
    
    message_responses = [
        build_message_response(msg, current_user.id) for msg in messages
    ]
    
    return {
        "messages": message_responses,
        "total": total,
        "has_more": has_more
    }


@router.post("/messages")
async def send_message(
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Send text message to conversation
    """
    # Check if user is member of conversation
    if not await chat_crud.is_user_in_conversation(db, message_data.conversation_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this conversation"
        )
    
    # Create message
    message = await chat_crud.create_message(
        db=db,
        conversation_id=message_data.conversation_id,
        sender_id=current_user.id,
        message_type=message_data.message_type,
        content=message_data.content
    )
    
    # Build response
    message_response = build_message_response(message, current_user.id)
    
    # Get conversation members
    conversation = await chat_crud.get_conversation_by_id(db, message_data.conversation_id)
    member_ids = [m.user_id for m in conversation.members if m.is_active]
    
    # Broadcast to all members via WebSocket
    await chat_manager.broadcast_new_message(
        conversation_id=message_data.conversation_id,
        member_ids=member_ids,
        message_data=message_response,
        sender_id=current_user.id
    )
    
    return message_response


@router.post("/messages/upload")
async def send_message_with_file(
    conversation_id: int = Form(...),
    file: UploadFile = File(...),
    content: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Send message with file attachment (image, video, audio, document)
    Maximum file size: 60MB
    """
    # Check if user is member of conversation
    if not await chat_crud.is_user_in_conversation(db, conversation_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this conversation"
        )
    
    # Upload file
    file_url, file_name, file_size, message_type = await ChatFileService.validate_and_upload_file(
        file=file,
        user_id=current_user.id,
        conversation_id=conversation_id
    )
    
    # Create message
    message = await chat_crud.create_message(
        db=db,
        conversation_id=conversation_id,
        sender_id=current_user.id,
        message_type=message_type,
        content=content,  # Optional caption
        file_url=file_url,
        file_name=file_name,
        file_size=file_size,
        mime_type=file.content_type
    )
    
    # Build response
    message_response = build_message_response(message, current_user.id)
    
    # Get conversation members
    conversation = await chat_crud.get_conversation_by_id(db, conversation_id)
    member_ids = [m.user_id for m in conversation.members if m.is_active]
    
    # Broadcast to all members via WebSocket
    await chat_manager.broadcast_new_message(
        conversation_id=conversation_id,
        member_ids=member_ids,
        message_data=message_response,
        sender_id=current_user.id
    )
    
    return message_response


@router.post("/messages/read")
async def mark_messages_as_read(
    read_data: MessageReadUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Mark messages as read in a conversation
    """
    # Check if user is member of conversation
    if not await chat_crud.is_user_in_conversation(db, read_data.conversation_id, current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this conversation"
        )
    
    # Mark as read
    count = await chat_crud.mark_conversation_as_read(
        db=db,
        conversation_id=read_data.conversation_id,
        user_id=current_user.id,
        message_ids=read_data.message_ids if read_data.message_ids else None
    )
    
    # Get conversation members
    conversation = await chat_crud.get_conversation_by_id(db, read_data.conversation_id)
    member_ids = [m.user_id for m in conversation.members if m.is_active]
    
    # Broadcast read receipts for each message
    if read_data.message_ids:
        for message_id in read_data.message_ids:
            await chat_manager.broadcast_message_read(
                conversation_id=read_data.conversation_id,
                message_id=message_id,
                user_id=current_user.id,
                user_name=current_user.name,
                member_ids=member_ids
            )
    
    return {"message": "Messages marked as read", "count": count}


@router.get("/online-users", response_model=OnlineStatusResponse)
async def get_online_users(
    current_user: User = Depends(get_current_user)
):
    """
    Get list of currently online users
    """
    online_users = chat_manager.get_online_users()
    return {"online_users": online_users}


# ============ WEBSOCKET ENDPOINT ============

@router.websocket("/ws")
async def chat_websocket_endpoint(
    websocket: WebSocket,
    db: AsyncSession = Depends(get_db)
):
    """
    WebSocket endpoint for real-time chat
    Handles:
    - User connection/disconnection
    - Real-time message delivery
    - Typing indicators
    - Online status
    - Read receipts
    """
    user_id = None
    
    try:
        # Wait for join message with authentication
        await websocket.accept()
        
        try:
            join_data = await websocket.receive_json()
        except Exception as e:
            logger.error(f"Error receiving join message: {e}")
            await websocket.close(code=1008)
            return
        
        if join_data.get("type") != "join":
            logger.error(f"Invalid message type: {join_data.get('type')}")
            await websocket.close(code=1008)
            return
        
        # Extract user info (you can validate JWT token here)
        user_id = join_data.get("user_id")
        
        if not user_id:
            logger.error("No user_id provided in join message")
            await websocket.close(code=1008)
            return
        
        # Verify user exists
        user = await chat_crud.get_user_by_id(db, user_id)
        if not user:
            logger.error(f"User {user_id} not found")
            await websocket.close(code=1008)
            return
        
        # Connect user - pass the specific websocket instance
        await chat_manager.connect(user_id, websocket)
        
        logger.info(f"User {user_id} ({user.name}) connected to chat WebSocket")
        
        # Get list of online users
        online_users = chat_manager.get_online_users()
        
        # Send connection confirmation with online users list
        await websocket.send_json({
            "type": "connected",
            "user_id": user_id,
            "message": "Connected to chat successfully",
            "online_users": online_users
        })
        
        # Message loop
        while True:
            try:
                data = await websocket.receive_json()
                message_type = data.get("type")
                
                if message_type == "pong":
                    # Handle heartbeat response
                    await chat_manager.handle_pong(user_id)
                
                elif message_type == "typing":
                    # Handle typing indicator
                    conversation_id = data.get("conversation_id")
                    is_typing = data.get("is_typing", False)
                    
                    if conversation_id:
                        # Verify user is in conversation
                        if await chat_crud.is_user_in_conversation(db, conversation_id, user_id):
                            conversation = await chat_crud.get_conversation_by_id(db, conversation_id)
                            member_ids = [m.user_id for m in conversation.members if m.is_active]
                            
                            await chat_manager.broadcast_typing_status(
                                conversation_id=conversation_id,
                                user_id=user_id,
                                user_name=user.name,
                                is_typing=is_typing,
                                member_ids=member_ids
                            )
                
                else:
                    logger.warning(f"Unknown message type: {message_type}")
                    
            except WebSocketDisconnect:
                logger.info(f"User {user_id} WebSocket disconnected")
                break
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}")
                break
    
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    
    finally:
        # Disconnect user - CRITICAL: pass the specific websocket instance
        if user_id:
            await chat_manager.disconnect(user_id, websocket)
            logger.info(f"User {user_id} disconnected from chat")
