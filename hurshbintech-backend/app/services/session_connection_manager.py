"""
Session Connection Manager
Manages WebSocket connections for real-time session invalidation notifications
"""

import asyncio
import logging
from typing import Dict, Set
from datetime import datetime
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class SessionConnectionManager:
    """
    Manages WebSocket connections for session invalidation notifications.
    Tracks which devices are connected for each user and sends invalidation messages.
    
    Structure: {user_id: {device_id: websocket}}
    """

    def __init__(self):
        self.active_connections: Dict[int, Dict[str, WebSocket]] = {}
        self.lock = asyncio.Lock()

    async def connect(self, user_id: int, device_id: str, websocket: WebSocket):
        """Register a new device connection"""
        async with self.lock:
            await websocket.accept()
            
            if user_id not in self.active_connections:
                self.active_connections[user_id] = {}
            
            # Close any existing connection for this device and user
            if device_id in self.active_connections[user_id]:
                old_ws = self.active_connections[user_id][device_id]
                try:
                    await old_ws.close(code=1000, reason="New connection from another device")
                except Exception as e:
                    logger.warning(f"Error closing old WebSocket: {e}")
            
            self.active_connections[user_id][device_id] = websocket
            logger.info(f"[SESSION_WS] Device {device_id} connected for user {user_id}")

    async def disconnect(self, user_id: int, device_id: str):
        """Unregister a device connection"""
        async with self.lock:
            if user_id in self.active_connections:
                if device_id in self.active_connections[user_id]:
                    del self.active_connections[user_id][device_id]
                    logger.info(f"[SESSION_WS] Device {device_id} disconnected for user {user_id}")
                
                # Clean up empty user dict
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]

    async def notify_session_invalidated(self, user_id: int, active_device_id: str = None):
        """
        Notify all devices of a user that their session has been invalidated.
        If active_device_id is provided, only notify other devices (not the active one).
        """
        async with self.lock:
            if user_id not in self.active_connections:
                logger.debug(f"[SESSION_WS] No active connections for user {user_id}")
                return
            
            disconnected_devices = []
            
            for device_id, websocket in self.active_connections[user_id].items():
                # Skip the device that just logged in (the new active device)
                if active_device_id and device_id == active_device_id:
                    continue
                
                try:
                    await websocket.send_json({
                        "type": "session_invalidated",
                        "message": "Your session has been logged out. Another device is now active.",
                        "timestamp": datetime.utcnow().isoformat(),
                    })
                    logger.info(f"[SESSION_WS] Sent invalidation notice to device {device_id} for user {user_id}")
                    
                    # Close the connection after sending invalidation message
                    await asyncio.sleep(0.1)  # Give time for client to receive message
                    await websocket.close(code=4000, reason="Session invalidated - another device is now active")
                    disconnected_devices.append(device_id)
                    
                except Exception as e:
                    logger.error(f"[SESSION_WS] Error notifying device {device_id}: {e}")
                    disconnected_devices.append(device_id)
            
            # Clean up disconnected devices
            for device_id in disconnected_devices:
                if device_id in self.active_connections[user_id]:
                    del self.active_connections[user_id][device_id]
            
            # Clean up empty user dict
            if user_id in self.active_connections and not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def get_user_devices(self, user_id: int) -> Dict[str, bool]:
        """Get list of connected devices for a user"""
        async with self.lock:
            if user_id not in self.active_connections:
                return {}
            return {device_id: True for device_id in self.active_connections[user_id].keys()}

    async def is_device_connected(self, user_id: int, device_id: str) -> bool:
        """Check if a device is currently connected for a user"""
        async with self.lock:
            return (
                user_id in self.active_connections
                and device_id in self.active_connections[user_id]
            )


# Global session connection manager instance
session_connection_manager = SessionConnectionManager()
