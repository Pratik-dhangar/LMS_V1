from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List, Optional
import json
import logging
from datetime import datetime
from app.core.config import settings
from app.utils.s3_utils import S3Manager

router = APIRouter()

# Initialize S3 manager if using S3
s3_manager = None
if settings.USE_S3:
    try:
        s3_manager = S3Manager()
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.warning(f"Failed to initialize S3Manager: {str(e)}")


def get_presigned_url(file_url: str) -> str:
    """Convert S3 URL to presigned HTTPS URL or return local path"""
    try:
        if settings.USE_S3 and file_url and file_url.startswith("s3://"):
            s3_key = file_url.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
            presigned_url = s3_manager.get_presigned_url(s3_key, expiration=3600)
            return presigned_url
        else:
            return file_url
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Error generating presigned URL: {str(e)}")
        return file_url

# Set up logging
logger = logging.getLogger(__name__)

# Store active connections
rtc_connections: Dict[str, Dict[str, WebSocket]] = {}
whiteboard_connections: Dict[str, Dict[str, WebSocket]] = {}

# Store media state per session to enable synchronization
# Structure: {session_id: {mediaId, mediaType, mediaUrl, status, currentTime, currentPage, activeTrainerId, timestamp}}
media_states: Dict[str, Optional[Dict]] = {}

# Track which trainer is controlling media in each session (prevent multiple trainer control)
media_control_locks: Dict[str, Optional[str]] = {}

@router.websocket("/ws/rtc/{session_id}")
async def websocket_rtc_endpoint(websocket: WebSocket, session_id: str):
    logger.info(f"[WebSocket] RTC connection attempt for session: {session_id}")
    logger.info(f"[WebSocket] RTC connection from: {websocket.client}")
    await websocket.accept()
    logger.info(f"WebRTC WebSocket connection accepted for session: {session_id}")

    role = None
    try:
        # Wait for initial join message with role
        join_msg = await websocket.receive_json()
        logger.info(f"Received join message: {join_msg}")

        if join_msg.get("type") != "join":
            logger.error(f"Invalid join message type: {join_msg.get('type')}")
            await websocket.close()
            return

        role = join_msg.get("role")
        if role not in ["trainer", "learner"]:
            logger.error(f"Invalid role: {role}")
            await websocket.close()
            return

        # Initialize session connections if needed
        if session_id not in rtc_connections:
            rtc_connections[session_id] = {}
        rtc_connections[session_id][role] = websocket
        logger.info(f"{role} connected to WebRTC session {session_id}. Active connections: {list(rtc_connections[session_id].keys())}")

        # Notify trainer to initiate offer when both participants are connected
        if len(rtc_connections[session_id]) == 2:
            # Both trainer and learner are now connected - signal trainer to start WebRTC handshake
            logger.info(f"Both participants connected to session {session_id} - signaling trainer to initiate offer")
            try:
                await rtc_connections[session_id]["trainer"].send_json({
                    "type": "peer_ready",
                    "role": "both_connected"
                })
            except Exception as e:
                logger.error(f"Failed to send peer_ready to trainer: {e}")

        try:
            while True:
                message = await websocket.receive_json()
                logger.info(f"Received WebRTC message from {role}: {message.get('type')}")

                # Forward messages to the other participant
                if role == "trainer" and "learner" in rtc_connections[session_id]:
                    logger.info(f"Forwarding message from trainer to learner: {message.get('type')}")
                    await rtc_connections[session_id]["learner"].send_json(message)
                elif role == "learner" and "trainer" in rtc_connections[session_id]:
                    logger.info(f"Forwarding message from learner to trainer: {message.get('type')}")
                    await rtc_connections[session_id]["trainer"].send_json(message)
                else:
                    logger.warning(f"No recipient found for message from {role} in session {session_id}")
        except WebSocketDisconnect:
            logger.info(f"WebRTC WebSocket disconnected: session={session_id}, role={role}")
            if session_id in rtc_connections and role in rtc_connections[session_id]:
                del rtc_connections[session_id][role]
                if not rtc_connections[session_id]:
                    del rtc_connections[session_id]
                    logger.info(f"All WebRTC connections cleared for session {session_id}")
    except Exception as e:
        logger.error(f"WebRTC WebSocket error for session {session_id}: {str(e)}")
        if session_id in rtc_connections and role in rtc_connections[session_id]:
            del rtc_connections[session_id][role]
            if not rtc_connections[session_id]:
                del rtc_connections[session_id]

@router.websocket("/ws/whiteboard/{session_id}")
async def websocket_whiteboard_endpoint(websocket: WebSocket, session_id: str):
    print(f"[WHITEBOARD] New connection attempt for session: {session_id}")
    await websocket.accept()
    print(f"[WHITEBOARD] WebSocket accepted for session: {session_id}")

    role = None
    try:
        # Wait for initial join message with role
        print(f"[WHITEBOARD] Waiting for join message from session: {session_id}")
        join_msg = await websocket.receive_json()
        print(f"[WHITEBOARD] Received join message: {join_msg}")

        if join_msg.get("type") != "join":
            print(f"[WHITEBOARD] Invalid message type: {join_msg.get('type')}, closing connection")
            await websocket.close()
            return

        role = join_msg.get("role")
        print(f"[WHITEBOARD] Role: {role} for session: {session_id}")

        if role not in ["trainer", "learner"]:
            print(f"[WHITEBOARD] Invalid role: {role}, closing connection")
            await websocket.close()
            return

        # Initialize session connections if needed
        if session_id not in whiteboard_connections:
            whiteboard_connections[session_id] = {}
        whiteboard_connections[session_id][role] = websocket
        print(f"[WHITEBOARD] {role} connected to session: {session_id}")
        print(f"[WHITEBOARD] Active connections in session {session_id}: {list(whiteboard_connections[session_id].keys())}")

        # If new learner joins and media is currently playing, send current state
        if role == "learner" and session_id in media_states and media_states[session_id]:
            print(f"[WHITEBOARD] Sending current media state to new learner: {media_states[session_id]}")
            try:
                await websocket.send_json({
                    "type": "media_control",
                    "data": media_states[session_id]
                })
            except Exception as e:
                print(f"[WHITEBOARD] Error sending media state to learner: {e}")

        try:
            while True:
                message = await websocket.receive_json()
                logger.debug(f"[WHITEBOARD] Received message from {role} in session {session_id}: {message.get('type')}")

                if message.get("type") == "media_control":
                    # Handle media control events
                    await handle_media_control(message, session_id, role, websocket)
                else:
                    # Forward draw/clear messages to the other participant
                    if role == "trainer" and "learner" in whiteboard_connections[session_id]:
                        logger.debug(f"[WHITEBOARD] Forwarding {message.get('type')} from trainer to learner")
                        await whiteboard_connections[session_id]["learner"].send_json(message)
                    elif role == "learner" and "trainer" in whiteboard_connections[session_id]:
                        print(f"[WHITEBOARD] Forwarding {message.get('type')} from learner to trainer")
                        await whiteboard_connections[session_id]["trainer"].send_json(message)
                    else:
                        print(f"[WHITEBOARD] No recipient for message from {role} in session {session_id}")
        except WebSocketDisconnect:
            print(f"[WHITEBOARD] {role} disconnected from session: {session_id}")
            if session_id in whiteboard_connections and role in whiteboard_connections[session_id]:
                del whiteboard_connections[session_id][role]
                if not whiteboard_connections[session_id]:
                    del whiteboard_connections[session_id]
                    
            # Clear media control lock if trainer disconnects
            if role == "trainer" and session_id in media_control_locks:
                media_control_locks[session_id] = None
    except Exception as e:
        print(f"[WHITEBOARD] Error in session {session_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        if session_id in whiteboard_connections and role and role in whiteboard_connections[session_id]:
            del whiteboard_connections[session_id][role]
            if not whiteboard_connections[session_id]:
                del whiteboard_connections[session_id]


async def handle_media_control(message: Dict, session_id: str, role: str, websocket: WebSocket):
    """
    Handle media control events (open, play, pause, seek, page_change, close, request_snapshot)
    """
    data = message.get("data", {})
    action = data.get("action")
    
    print(f"[WHITEBOARD] Media control action: {action} from {role} in session {session_id}")

    # Only trainer can control media
    if action != "request_snapshot" and role != "trainer":
        print(f"[WHITEBOARD] Non-trainer attempting media control: {role}")
        return

    if action == "request_snapshot":
        # Learner requesting current media snapshot
        print(f"[WHITEBOARD] Learner requesting media snapshot for session: {session_id}")
        if session_id in media_states and media_states[session_id]:
            try:
                await websocket.send_json({
                    "type": "media_control",
                    "data": media_states[session_id]
                })
            except Exception as e:
                print(f"[WHITEBOARD] Error sending media snapshot: {e}")
        return

    if action == "open":
        # Trainer opening media - acquire lock
        media_control_locks[session_id] = role  # Store trainer identifier (could be user_id or socket id)
        
        # Store media state with presigned URL
        media_state = {
            "action": "open",
            "mediaId": data.get("mediaId"),
            "mediaType": data.get("mediaType"),
            "mediaUrl": get_presigned_url(data.get("mediaUrl")),
            "status": "paused",
            "currentTime": data.get("currentTime", 0),
            "currentPage": data.get("currentPage", 1),
            "activeTrainerId": role,
            "timestamp": datetime.utcnow().isoformat(),
            "serverTs": int(datetime.utcnow().timestamp() * 1000)
        }
        media_states[session_id] = media_state
        print(f"[WHITEBOARD] Media opened in session {session_id}: {media_state}")

    elif action == "close":
        # Trainer closing media - release lock
        media_control_locks[session_id] = None
        media_states[session_id] = None
        print(f"[WHITEBOARD] Media closed in session {session_id}")

    elif action == "play":
        if session_id in media_states and media_states[session_id]:
            media_states[session_id]["action"] = "play"
            media_states[session_id]["status"] = "playing"
            media_states[session_id]["timestamp"] = datetime.utcnow().isoformat()
            media_states[session_id]["serverTs"] = int(datetime.utcnow().timestamp() * 1000)
            print(f"[WHITEBOARD] Media playing in session {session_id}")

    elif action == "pause":
        if session_id in media_states and media_states[session_id]:
            media_states[session_id]["action"] = "pause"
            media_states[session_id]["status"] = "paused"
            media_states[session_id]["timestamp"] = datetime.utcnow().isoformat()
            media_states[session_id]["serverTs"] = int(datetime.utcnow().timestamp() * 1000)
            print(f"[WHITEBOARD] Media paused in session {session_id}")

    elif action == "seek":
        if session_id in media_states and media_states[session_id]:
            media_states[session_id]["action"] = "seek"
            media_states[session_id]["currentTime"] = data.get("currentTime", 0)
            media_states[session_id]["timestamp"] = datetime.utcnow().isoformat()
            media_states[session_id]["serverTs"] = int(datetime.utcnow().timestamp() * 1000)
            print(f"[WHITEBOARD] Media seeked to {data.get('currentTime')} in session {session_id}")

    elif action == "page_change":
        if session_id in media_states and media_states[session_id]:
            media_states[session_id]["action"] = "page_change"
            media_states[session_id]["currentPage"] = data.get("currentPage", 1)
            media_states[session_id]["timestamp"] = datetime.utcnow().isoformat()
            media_states[session_id]["serverTs"] = int(datetime.utcnow().timestamp() * 1000)
            print(f"[WHITEBOARD] PDF page changed to {data.get('currentPage')} in session {session_id}")

    # Broadcast media control event to learners
    if session_id in whiteboard_connections:
        learner_ws = whiteboard_connections[session_id].get("learner")
        if learner_ws:
            try:
                # Include server timestamp in the broadcast
                broadcast_data = {
                    **data,
                    "timestamp": datetime.utcnow().isoformat(),
                    "serverTs": int(datetime.utcnow().timestamp() * 1000),
                    "activeTrainerId": role
                }
                
                # If closing or snapshot, send the current media state
                if action in ["close", "request_snapshot"]:
                    broadcast_data = media_states.get(session_id) or broadcast_data

                await learner_ws.send_json({
                    "type": "media_control",
                    "data": broadcast_data
                })
                print(f"[WHITEBOARD] Broadcasted media control '{action}' to learner in session {session_id}")
            except Exception as e:
                print(f"[WHITEBOARD] Error broadcasting media control to learner: {e}")