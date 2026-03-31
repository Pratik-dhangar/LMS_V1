"""
Session WebSocket Endpoints
Handles real-time session invalidation notifications
"""

import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from app.services.session_connection_manager import session_connection_manager
from app.core.security import decode_token

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/session/{token}")
async def websocket_session_endpoint(websocket: WebSocket, token: str, device_id: str = Query(...)):
    """
    WebSocket endpoint for session management.
    
    Flow:
    1. Client connects with JWT token and device_id
    2. Server verifies token and extracts user_id
    3. Server registers the device connection
    4. Server listens for messages (heartbeat)
    5. Other devices are notified when a new device becomes active
    
    Args:
        token: JWT access token
        device_id: Unique device identifier (UUID or fingerprint)
    """
    
    user_id = None
    device_id_safe = device_id[:100]  # Limit size to prevent abuse
    
    try:
        # Decode token to get user_id
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
        
        logger.info(f"[SESSION_WS] Connection attempt - user_id={user_id}, device_id={device_id_safe}")
        
        # Register the connection
        await session_connection_manager.connect(user_id, device_id_safe, websocket)
        
        # Send confirmation
        await websocket.send_json({
            "type": "connected",
            "message": "Session WebSocket connected",
            "user_id": user_id,
            "device_id": device_id_safe,
        })
        
        # Listen for messages and keep connection alive
        while True:
            try:
                data = await websocket.receive_json()
                
                if data.get("type") == "ping":
                    # Heartbeat response
                    await websocket.send_json({"type": "pong"})
                
                elif data.get("type") == "get_status":
                    # Client requesting status
                    await websocket.send_json({
                        "type": "status",
                        "is_active": True,
                        "user_id": user_id,
                    })
                
            except Exception as e:
                logger.error(f"[SESSION_WS] Error processing message: {e}")
                break
    
    except ValueError as e:
        logger.error(f"[SESSION_WS] Invalid token: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid token")
        return
    
    except WebSocketDisconnect:
        if user_id:
            await session_connection_manager.disconnect(user_id, device_id_safe)
            logger.info(f"[SESSION_WS] Client disconnected - user_id={user_id}, device_id={device_id_safe}")
    
    except Exception as e:
        logger.error(f"[SESSION_WS] Unexpected error: {e}")
        if user_id:
            await session_connection_manager.disconnect(user_id, device_id_safe)
