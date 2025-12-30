import asyncio
import logging
from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.utils.s3_utils import S3Manager

router = APIRouter()

# Initialize S3 manager if using S3
s3_manager = None
if settings.USE_S3:
    try:
        s3_manager = S3Manager(bucket_name=settings.S3_BUCKET_NAME)
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.warning(f"Failed to initialize S3Manager: {str(e)}")


def get_public_url(file_url: str) -> str:
    """
    Convert S3 URL to public HTTPS URL via Nginx proxy (permanent access, no expiration)

    Args:
        file_url: S3 URL (s3://bucket/key) or local path

    Returns:
        Public HTTPS URL through Nginx proxy that never expires until file is deleted
    """
    try:
        if settings.USE_S3 and file_url and file_url.startswith("s3://"):
            s3_key = file_url.replace(f"s3://{settings.S3_BUCKET_NAME}/", "")
            public_url = s3_manager.get_public_url(s3_key)
            return public_url
        else:
            return file_url
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Error generating public URL: {str(e)}")
        return file_url


# Set up logging
logger = logging.getLogger(__name__)

# WebSocket configuration
HEARTBEAT_INTERVAL = 30  # Send ping every 30 seconds
HEARTBEAT_TIMEOUT = 60  # Close connection if no pong received within 60 seconds
MAX_RECONNECT_ATTEMPTS = 3  # Max reconnection attempts tracked


# Connection info structure
class ConnectionInfo:
    """Track WebSocket connection state"""

    def __init__(self, websocket: WebSocket, role: str, session_id: str):
        self.websocket = websocket
        self.role = role
        self.session_id = session_id
        self.last_heartbeat = datetime.utcnow()
        self.is_alive = True
        self.heartbeat_task: Optional[asyncio.Task] = None

    async def close(self):
        """Safely close WebSocket connection"""
        self.is_alive = False
        if self.heartbeat_task and not self.heartbeat_task.done():
            self.heartbeat_task.cancel()
            try:
                await self.heartbeat_task
            except asyncio.CancelledError:
                pass
        try:
            await self.websocket.close()
        except Exception as e:
            logger.error(f"Error closing websocket: {e}")


# Store active connections with metadata
rtc_connections: Dict[str, Dict[str, ConnectionInfo]] = {}
whiteboard_connections: Dict[str, Dict[str, ConnectionInfo]] = {}

# Store media state per session to enable synchronization
# Structure: {session_id: {mediaId, mediaType, mediaUrl, status, currentTime, currentPage, activeTrainerId, timestamp}}
media_states: Dict[str, Optional[Dict]] = {}

# Track which trainer is controlling media in each session (prevent multiple trainer control)
media_control_locks: Dict[str, Optional[str]] = {}


async def send_heartbeat(conn_info: ConnectionInfo):
    """Send periodic ping messages to keep connection alive"""
    try:
        while conn_info.is_alive:
            await asyncio.sleep(HEARTBEAT_INTERVAL)
            if not conn_info.is_alive:
                break

            try:
                # Send ping message
                await conn_info.websocket.send_json(
                    {"type": "ping", "timestamp": datetime.utcnow().isoformat()}
                )
                logger.debug(f"Sent ping to {conn_info.role} in session {conn_info.session_id}")

                # Check if last heartbeat is too old
                elapsed = (datetime.utcnow() - conn_info.last_heartbeat).total_seconds()
                if elapsed > HEARTBEAT_TIMEOUT:
                    logger.warning(
                        f"Connection timeout for {conn_info.role} in session {conn_info.session_id}"
                    )
                    conn_info.is_alive = False
                    break
            except Exception as e:
                logger.error(f"Error sending heartbeat: {e}")
                conn_info.is_alive = False
                break
    except asyncio.CancelledError:
        logger.info(
            f"Heartbeat task cancelled for {conn_info.role} in session {conn_info.session_id}"
        )
    except Exception as e:
        logger.error(f"Heartbeat task error: {e}")


async def cleanup_connection(connections: Dict, session_id: str, role: Optional[str]):
    """Safely cleanup WebSocket connection and associated resources"""
    try:
        if session_id in connections and role and role in connections[session_id]:
            conn_info = connections[session_id][role]
            await conn_info.close()
            del connections[session_id][role]

            # Clean up empty session
            if not connections[session_id]:
                del connections[session_id]
                logger.info(f"All connections cleared for session {session_id}")

                # Clean up media state
                if session_id in media_states:
                    media_states[session_id] = None
                if session_id in media_control_locks:
                    media_control_locks[session_id] = None
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")


@router.websocket("/ws/rtc/{session_id}")
async def websocket_rtc_endpoint(websocket: WebSocket, session_id: str):
    logger.info(f"[WebSocket] RTC connection attempt for session: {session_id}")
    logger.info(f"[WebSocket] RTC connection from: {websocket.client}")
    await websocket.accept()
    logger.info(f"WebRTC WebSocket connection accepted for session: {session_id}")

    role = None
    conn_info = None
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

        # Create connection info and start heartbeat
        conn_info = ConnectionInfo(websocket, role, session_id)
        rtc_connections[session_id][role] = conn_info
        conn_info.heartbeat_task = asyncio.create_task(send_heartbeat(conn_info))

        logger.info(
            f"{role} connected to WebRTC session {session_id}. Active connections: {list(rtc_connections[session_id].keys())}"
        )

        # Send connection confirmation
        await websocket.send_json(
            {
                "type": "connected",
                "role": role,
                "session_id": session_id,
                "heartbeat_interval": HEARTBEAT_INTERVAL,
            }
        )

        # Notify trainer to initiate offer when both participants are connected
        if len(rtc_connections[session_id]) == 2:
            # Both trainer and learner are now connected - signal trainer to start WebRTC handshake
            logger.info(
                f"Both participants connected to session {session_id} - signaling trainer to initiate offer"
            )
            try:
                await rtc_connections[session_id]["trainer"].websocket.send_json(
                    {"type": "peer_ready", "role": "both_connected"}
                )
            except Exception as e:
                logger.error(f"Failed to send peer_ready to trainer: {e}")

        try:
            while conn_info.is_alive:
                message = await websocket.receive_json()

                # Handle pong response
                if message.get("type") == "pong":
                    conn_info.last_heartbeat = datetime.utcnow()
                    logger.debug(f"Received pong from {role} in session {session_id}")
                    continue

                logger.info(f"Received WebRTC message from {role}: {message.get('type')}")

                # Forward messages to the other participant
                if role == "trainer" and "learner" in rtc_connections[session_id]:
                    other_conn = rtc_connections[session_id]["learner"]
                    if other_conn.is_alive:
                        logger.info(
                            f"Forwarding message from trainer to learner: {message.get('type')}"
                        )
                        await other_conn.websocket.send_json(message)
                elif role == "learner" and "trainer" in rtc_connections[session_id]:
                    other_conn = rtc_connections[session_id]["trainer"]
                    if other_conn.is_alive:
                        logger.info(
                            f"Forwarding message from learner to trainer: {message.get('type')}"
                        )
                        await other_conn.websocket.send_json(message)
                else:
                    logger.warning(
                        f"No recipient found for message from {role} in session {session_id}"
                    )
        except WebSocketDisconnect:
            logger.info(f"WebRTC WebSocket disconnected: session={session_id}, role={role}")
        except Exception as e:
            logger.error(f"Error in WebRTC message loop: {e}")

    except WebSocketDisconnect:
        logger.info(
            f"WebRTC WebSocket disconnected during setup: session={session_id}, role={role}"
        )
    except Exception as e:
        logger.error(f"WebRTC WebSocket error for session {session_id}: {str(e)}")
    finally:
        # Cleanup connection
        await cleanup_connection(rtc_connections, session_id, role)

        # Notify other participant about disconnection
        if session_id in rtc_connections:
            try:
                other_role = "learner" if role == "trainer" else "trainer"
                if other_role in rtc_connections[session_id]:
                    await rtc_connections[session_id][other_role].websocket.send_json(
                        {"type": "peer_disconnected", "role": role}
                    )
            except Exception as e:
                logger.error(f"Error notifying peer about disconnection: {e}")


@router.websocket("/ws/whiteboard/{session_id}")
async def websocket_whiteboard_endpoint(websocket: WebSocket, session_id: str):
    print(f"[WHITEBOARD] New connection attempt for session: {session_id}")
    await websocket.accept()
    print(f"[WHITEBOARD] WebSocket accepted for session: {session_id}")

    role = None
    conn_info = None
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

        # Create connection info and start heartbeat
        conn_info = ConnectionInfo(websocket, role, session_id)
        whiteboard_connections[session_id][role] = conn_info
        conn_info.heartbeat_task = asyncio.create_task(send_heartbeat(conn_info))

        print(f"[WHITEBOARD] {role} connected to session: {session_id}")
        print(
            f"[WHITEBOARD] Active connections in session {session_id}: {list(whiteboard_connections[session_id].keys())}"
        )

        # Send connection confirmation
        await websocket.send_json(
            {
                "type": "connected",
                "role": role,
                "session_id": session_id,
                "heartbeat_interval": HEARTBEAT_INTERVAL,
            }
        )

        # If new learner joins and media is currently playing, send current state
        if role == "learner" and session_id in media_states and media_states[session_id]:
            print(
                f"[WHITEBOARD] Sending current media state to new learner: {media_states[session_id]}"
            )
            try:
                await websocket.send_json(
                    {"type": "media_control", "data": media_states[session_id]}
                )
            except Exception as e:
                print(f"[WHITEBOARD] Error sending media state to learner: {e}")

        try:
            while conn_info.is_alive:
                message = await websocket.receive_json()

                # Handle pong response
                if message.get("type") == "pong":
                    conn_info.last_heartbeat = datetime.utcnow()
                    logger.debug(f"[WHITEBOARD] Received pong from {role} in session {session_id}")
                    continue

                logger.debug(
                    f"[WHITEBOARD] Received message from {role} in session {session_id}: {message.get('type')}"
                )

                if message.get("type") == "media_control":
                    # Handle media control events
                    await handle_media_control(message, session_id, role, websocket)
                else:
                    # Forward draw/clear/item_update messages to the other participant
                    if role == "trainer" and "learner" in whiteboard_connections[session_id]:
                        other_conn = whiteboard_connections[session_id]["learner"]
                        if other_conn.is_alive:
                            # Add special logging for exercise (item_update) messages
                            # Forward draw/clear/item_update messages to learner (no special-case logging)
                            logger.debug(
                                f"[WHITEBOARD] Forwarding {message.get('type')} from trainer to learner"
                            )
                            await other_conn.websocket.send_json(message)
                    elif role == "learner" and "trainer" in whiteboard_connections[session_id]:
                        other_conn = whiteboard_connections[session_id]["trainer"]
                        if other_conn.is_alive:
                            print(
                                f"[WHITEBOARD] Forwarding {message.get('type')} from learner to trainer"
                            )
                            await other_conn.websocket.send_json(message)
                    else:
                        print(
                            f"[WHITEBOARD] No recipient for message from {role} in session {session_id}"
                        )
        except WebSocketDisconnect:
            print(f"[WHITEBOARD] {role} disconnected from session: {session_id}")
        except Exception as e:
            print(f"[WHITEBOARD] Error in message loop: {e}")

    except WebSocketDisconnect:
        print(f"[WHITEBOARD] {role} disconnected during setup: {session_id}")
    except Exception as e:
        print(f"[WHITEBOARD] Error in session {session_id}: {str(e)}")
        import traceback

        traceback.print_exc()
    finally:
        # Cleanup connection
        await cleanup_connection(whiteboard_connections, session_id, role)

        # Clear media control lock if trainer disconnects
        if role == "trainer" and session_id in media_control_locks:
            media_control_locks[session_id] = None

        # Notify other participant about disconnection
        if session_id in whiteboard_connections:
            try:
                other_role = "learner" if role == "trainer" else "trainer"
                if other_role in whiteboard_connections[session_id]:
                    await whiteboard_connections[session_id][other_role].websocket.send_json(
                        {"type": "peer_disconnected", "role": role}
                    )
            except Exception as e:
                print(f"[WHITEBOARD] Error notifying peer about disconnection: {e}")


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
                await websocket.send_json(
                    {"type": "media_control", "data": media_states[session_id]}
                )
            except Exception as e:
                print(f"[WHITEBOARD] Error sending media snapshot: {e}")
        return

    if action == "open":
        # Trainer opening media - acquire lock
        media_control_locks[session_id] = (
            role  # Store trainer identifier (could be user_id or socket id)
        )

        # Store media state with public URL (permanent access, no expiration)
        media_state = {
            "action": "open",
            "mediaId": data.get("mediaId"),
            "mediaType": data.get("mediaType"),
            "mediaUrl": get_public_url(data.get("mediaUrl")),
            "status": "paused",
            "currentTime": data.get("currentTime", 0),
            "currentPage": data.get("currentPage", 1),
            "activeTrainerId": role,
            "timestamp": datetime.utcnow().isoformat(),
            "serverTs": int(datetime.utcnow().timestamp() * 1000),
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
            print(
                f"[WHITEBOARD] PDF page changed to {data.get('currentPage')} in session {session_id}"
            )

    # Broadcast media control event to learners
    if session_id in whiteboard_connections:
        learner_conn = whiteboard_connections[session_id].get("learner")
        if learner_conn and learner_conn.is_alive:
            try:
                # Include server timestamp in the broadcast
                broadcast_data = {
                    **data,
                    "timestamp": datetime.utcnow().isoformat(),
                    "serverTs": int(datetime.utcnow().timestamp() * 1000),
                    "activeTrainerId": role,
                }

                # If closing or snapshot, send the current media state
                if action in ["close", "request_snapshot"]:
                    broadcast_data = media_states.get(session_id) or broadcast_data

                await learner_conn.websocket.send_json(
                    {"type": "media_control", "data": broadcast_data}
                )
                print(
                    f"[WHITEBOARD] Broadcasted media control '{action}' to learner in session {session_id}"
                )
            except Exception as e:
                print(f"[WHITEBOARD] Error broadcasting media control to learner: {e}")
