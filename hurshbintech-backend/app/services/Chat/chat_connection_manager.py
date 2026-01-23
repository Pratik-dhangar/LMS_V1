"""
WebSocket Connection Manager for Chat System
Handles real-time messaging, online status, typing indicators, and message delivery
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, Set, Optional, List
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ChatConnectionManager:
    """
    Manages WebSocket connections for chat system
    Tracks online users, handles message routing, and manages typing indicators
    """

    def __init__(self):
        # Active WebSocket connections: {user_id: WebSocket}
        self.active_connections: Dict[int, WebSocket] = {}
        
        # Track last activity for heartbeat: {user_id: datetime}
        self.last_activity: Dict[int, datetime] = {}
        
        # Track typing status: {conversation_id: {user_id: is_typing}}
        self.typing_status: Dict[int, Dict[int, bool]] = {}
        
        # Heartbeat tasks: {user_id: asyncio.Task}
        self.heartbeat_tasks: Dict[int, asyncio.Task] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        """
        Connect a user to the chat system
        """
        await websocket.accept()
        
        # If user already connected, disconnect old connection
        if user_id in self.active_connections:
            try:
                old_ws = self.active_connections[user_id]
                await old_ws.close()
            except Exception as e:
                logger.warning(f"Error closing old connection for user {user_id}: {e}")
        
        self.active_connections[user_id] = websocket
        self.last_activity[user_id] = datetime.utcnow()
        
        # Start heartbeat
        self.heartbeat_tasks[user_id] = asyncio.create_task(
            self._heartbeat(user_id)
        )
        
        logger.info(f"User {user_id} connected to chat. Total online: {len(self.active_connections)}")
        
        # Broadcast user online status to all connected users
        await self.broadcast_user_status(user_id, is_online=True)

    async def disconnect(self, user_id: int):
        """
        Disconnect a user from the chat system
        """
        if user_id in self.active_connections:
            # Cancel heartbeat task
            if user_id in self.heartbeat_tasks:
                self.heartbeat_tasks[user_id].cancel()
                try:
                    await self.heartbeat_tasks[user_id]
                except asyncio.CancelledError:
                    pass
                del self.heartbeat_tasks[user_id]
            
            # Close WebSocket
            try:
                await self.active_connections[user_id].close()
            except Exception as e:
                logger.warning(f"Error closing WebSocket for user {user_id}: {e}")
            
            del self.active_connections[user_id]
            
            if user_id in self.last_activity:
                del self.last_activity[user_id]
            
            # Clear typing status
            for conversation_id in list(self.typing_status.keys()):
                if user_id in self.typing_status[conversation_id]:
                    del self.typing_status[conversation_id][user_id]
                if not self.typing_status[conversation_id]:
                    del self.typing_status[conversation_id]
            
            logger.info(f"User {user_id} disconnected from chat. Total online: {len(self.active_connections)}")
            
            # Broadcast user offline status
            await self.broadcast_user_status(user_id, is_online=False)

    def is_user_online(self, user_id: int) -> bool:
        """Check if user is currently online"""
        return user_id in self.active_connections

    def get_online_users(self) -> List[int]:
        """Get list of all online user IDs"""
        return list(self.active_connections.keys())

    async def send_personal_message(self, user_id: int, message: dict):
        """
        Send a message to a specific user
        """
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
                self.last_activity[user_id] = datetime.utcnow()
                return True
            except Exception as e:
                logger.error(f"Error sending message to user {user_id}: {e}")
                # Connection might be broken, disconnect user
                await self.disconnect(user_id)
                return False
        return False

    async def send_to_conversation(
        self,
        conversation_id: int,
        member_ids: List[int],
        message: dict,
        exclude_user_id: Optional[int] = None
    ):
        """
        Send a message to all members of a conversation (except excluded user)
        """
        sent_count = 0
        for user_id in member_ids:
            if exclude_user_id and user_id == exclude_user_id:
                continue
            
            if await self.send_personal_message(user_id, message):
                sent_count += 1
        
        logger.debug(
            f"Sent message to {sent_count}/{len(member_ids)} members in conversation {conversation_id}"
        )

    async def broadcast_user_status(self, user_id: int, is_online: bool):
        """
        Broadcast user online/offline status to all connected users
        """
        message = {
            "type": "user_online",
            "user_id": user_id,
            "is_online": is_online,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send to all connected users except the user themselves
        for uid in list(self.active_connections.keys()):
            if uid != user_id:
                await self.send_personal_message(uid, message)

    async def broadcast_typing_status(
        self,
        conversation_id: int,
        user_id: int,
        user_name: str,
        is_typing: bool,
        member_ids: List[int]
    ):
        """
        Broadcast typing indicator to conversation members
        """
        # Update typing status
        if conversation_id not in self.typing_status:
            self.typing_status[conversation_id] = {}
        
        if is_typing:
            self.typing_status[conversation_id][user_id] = True
        else:
            if user_id in self.typing_status[conversation_id]:
                del self.typing_status[conversation_id][user_id]
        
        message = {
            "type": "user_typing",
            "conversation_id": conversation_id,
            "user_id": user_id,
            "user_name": user_name,
            "is_typing": is_typing,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send to all conversation members except the typing user
        await self.send_to_conversation(
            conversation_id=conversation_id,
            member_ids=member_ids,
            message=message,
            exclude_user_id=user_id
        )

    async def broadcast_new_message(
        self,
        conversation_id: int,
        member_ids: List[int],
        message_data: dict,
        sender_id: int
    ):
        """
        Broadcast new message to all conversation members
        """
        message = {
            "type": "new_message",
            "conversation_id": conversation_id,
            "message": message_data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Send to all members
        await self.send_to_conversation(
            conversation_id=conversation_id,
            member_ids=member_ids,
            message=message,
            exclude_user_id=None  # Send to everyone including sender for confirmation
        )

    async def broadcast_message_read(
        self,
        conversation_id: int,
        message_id: int,
        user_id: int,
        user_name: str,
        member_ids: List[int]
    ):
        """
        Broadcast message read receipt to conversation members
        """
        message = {
            "type": "message_read",
            "conversation_id": conversation_id,
            "message_id": message_id,
            "user_id": user_id,
            "user_name": user_name,
            "read_at": datetime.utcnow().isoformat()
        }
        
        # Send to all members except the reader
        await self.send_to_conversation(
            conversation_id=conversation_id,
            member_ids=member_ids,
            message=message,
            exclude_user_id=user_id
        )

    async def broadcast_conversation_update(
        self,
        conversation_id: int,
        member_ids: List[int],
        update_type: str,
        data: dict
    ):
        """
        Broadcast conversation updates (new member, member removed, etc.)
        """
        message = {
            "type": "conversation_update",
            "conversation_id": conversation_id,
            "update_type": update_type,  # "member_added", "member_removed", etc.
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.send_to_conversation(
            conversation_id=conversation_id,
            member_ids=member_ids,
            message=message
        )

    async def _heartbeat(self, user_id: int):
        """
        Send periodic heartbeat to keep connection alive
        """
        try:
            while user_id in self.active_connections:
                await asyncio.sleep(30)  # Send ping every 30 seconds
                
                if user_id in self.active_connections:
                    try:
                        await self.active_connections[user_id].send_json({
                            "type": "ping",
                            "timestamp": datetime.utcnow().isoformat()
                        })
                    except Exception as e:
                        logger.error(f"Heartbeat failed for user {user_id}: {e}")
                        await self.disconnect(user_id)
                        break
        except asyncio.CancelledError:
            logger.debug(f"Heartbeat task cancelled for user {user_id}")
        except Exception as e:
            logger.error(f"Heartbeat error for user {user_id}: {e}")

    async def handle_pong(self, user_id: int):
        """
        Handle pong response from client
        """
        if user_id in self.last_activity:
            self.last_activity[user_id] = datetime.utcnow()

    def get_typing_users(self, conversation_id: int) -> List[int]:
        """
        Get list of users currently typing in a conversation
        """
        if conversation_id in self.typing_status:
            return [uid for uid, is_typing in self.typing_status[conversation_id].items() if is_typing]
        return []


# Global instance
chat_manager = ChatConnectionManager()
