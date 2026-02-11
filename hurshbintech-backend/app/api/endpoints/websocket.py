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
HEARTBEAT_TIMEOUT = 90  # Close connection if no pong received within 90 seconds (increased for reliability)
MAX_RECONNECT_ATTEMPTS = 3  # Max reconnection attempts tracked


# Connection info structure
class ConnectionInfo:
    """Track WebSocket connection state"""

    def __init__(self, websocket: WebSocket, role: str, session_id: str, user_data: Optional[dict] = None):
        self.websocket = websocket
        self.role = role
        self.session_id = session_id
        self.user_data = user_data  # Store user data (for observer)
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
            # Check if last heartbeat is too old BEFORE sending next ping
            elapsed = (datetime.utcnow() - conn_info.last_heartbeat).total_seconds()
            if elapsed > HEARTBEAT_TIMEOUT:
                logger.warning(
                    f"Connection timeout for {conn_info.role} in session {conn_info.session_id} "
                    f"(no pong for {elapsed:.1f}s)"
                )
                conn_info.is_alive = False
                break

            await asyncio.sleep(HEARTBEAT_INTERVAL)
            if not conn_info.is_alive:
                break

            try:
                # Send ping message
                await conn_info.websocket.send_json(
                    {"type": "ping", "timestamp": datetime.utcnow().isoformat()}
                )
                logger.debug(f"Sent ping to {conn_info.role} in session {conn_info.session_id}")
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
    """
    WebRTC signaling endpoint for both training sessions and coach sessions
    Supports session_id formats:
    - session_XXXX (training sessions - trainer/learner)
    - coach_session_XXXX (coach appointment sessions - coach/client)
    """
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
        user_data = join_msg.get("user_data")  # Extract user data (for observer)
        
        # Support both training session roles (trainer/learner), coach session roles (coach/client/guest), and observer role (head)
        valid_roles = ["trainer", "learner", "coach", "client", "guest", "observer"]
        if role not in valid_roles:
            logger.error(f"Invalid role: {role}")
            await websocket.close()
            return

        # Initialize session connections if needed
        if session_id not in rtc_connections:
            rtc_connections[session_id] = {}

        # Create connection info and start heartbeat
        conn_info = ConnectionInfo(websocket, role, session_id, user_data)
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

        # SIMPLE: If observer joins, notify trainer with observer user data
        if role == "observer" and "trainer" in rtc_connections[session_id]:
            logger.info(f"Observer joined session {session_id}, notifying trainer")
            observer_message = {"type": "observer_joined"}
            if user_data:
                observer_message["observer_data"] = user_data
            await rtc_connections[session_id]["trainer"].websocket.send_json(observer_message)

        # Normal peer connection setup for trainer/learner or coach/client
        if len(rtc_connections[session_id]) == 2 and role != "observer":
            initiator_role = "trainer" if "trainer" in rtc_connections[session_id] else "coach"
            logger.info(f"Both participants connected - signaling {initiator_role} to initiate offer")
            if initiator_role in rtc_connections[session_id]:
                await rtc_connections[session_id][initiator_role].websocket.send_json(
                    {"type": "peer_ready", "role": "both_connected"}
                )

        try:
            while conn_info.is_alive:
                message = await websocket.receive_json()

                # --- FIX 1: Handle Client Pings to prevent Disconnect Loop ---
                if message.get("type") == "ping":
                    # Reply to the client's ping so it doesn't timeout
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                    # Update heartbeat since we heard from them
                    conn_info.last_heartbeat = datetime.utcnow()
                    continue
                # -----------------------------------------------------------

                # Handle pong response
                if message.get("type") == "pong":
                    conn_info.last_heartbeat = datetime.utcnow()
                    logger.debug(f"Received pong from {role} in session {session_id}")
                    continue

                logger.info(f"Received WebRTC message from {role}: {message.get('type')}")

                # --- FIX 2: Targeted Signaling to prevent Delay ---
                # Check if the message has a specific target (e.g., trainer -> observer)
                target_role = message.get("target")
                
                if target_role:
                    # Send ONLY to the specific target
                    if target_role in rtc_connections[session_id]:
                        target_conn = rtc_connections[session_id][target_role]
                        if target_conn.is_alive:
                            await target_conn.websocket.send_json(message)
                            logger.info(f"Direct message from {role} to {target_role}: {message.get('type')}")
                    else:
                        logger.warning(f"Target {target_role} not found in session {session_id}")
                    continue  # Skip the broadcast logic below
                # --------------------------------------------------

                # Forward messages to the other participant(s)
                # Map roles to their counterparts (coach can have both client and guest, trainer can have learner and observer)
                # IMPORTANT: WebRTC signaling messages (offer, answer, ice-candidate) should be targeted
                # to avoid mixing up connections between trainer-learner and trainer-observer
                message_type = message.get('type')
                
                # For WebRTC signaling messages, we need to be smart about routing
                # If trainer is sending to both learner AND observer, use simple heuristic:
                # - offer/answer/ice-candidate without explicit target go to learner (primary connection)
                # - observer connection must explicitly set target="observer"
                if role == "trainer" and message_type in ["offer", "answer", "ice-candidate"]:
                    # Default to learner for backward compatibility
                    # Observer connection will use target="observer"
                    default_role = "learner"
                    if default_role in rtc_connections[session_id]:
                        other_conn = rtc_connections[session_id][default_role]
                        if other_conn.is_alive:
                            logger.info(f"Forwarding {message_type} from {role} to {default_role} (default)")
                            await other_conn.websocket.send_json(message)
                    continue  # Skip the generic broadcast below
                
                # Learner signaling messages always go to trainer (not observer)
                elif role == "learner" and message_type in ["offer", "answer", "ice-candidate"]:
                    if "trainer" in rtc_connections[session_id]:
                        other_conn = rtc_connections[session_id]["trainer"]
                        if other_conn.is_alive:
                            logger.info(f"Forwarding {message_type} from learner to trainer")
                            await other_conn.websocket.send_json(message)
                    continue  # Skip the generic broadcast below
                
                # For all other messages, use role mapping
                role_mapping = {
                    "trainer": ["learner", "observer"],
                    "learner": ["trainer"],
                    "coach": ["client", "guest"],
                    "client": ["coach"],
                    "guest": ["coach"],
                    "observer": ["trainer"]  # Observer only communicates with trainer
                }
                
                other_roles = role_mapping.get(role, [])
                recipients_found = False
                for other_role in other_roles:
                    if other_role in rtc_connections[session_id]:
                        other_conn = rtc_connections[session_id][other_role]
                        if other_conn.is_alive:
                            logger.info(
                                f"Forwarding message from {role} to {other_role}: {message.get('type')}"
                            )
                            await other_conn.websocket.send_json(message)
                            recipients_found = True
                
                if not recipients_found:
                    logger.debug(
                        f"No active recipients for message from {role} in session {session_id}"
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
        
        # Notify other participant(s) about disconnection
        if session_id in rtc_connections:
            try:
                # Notify trainer if observer leaves
                if role == "observer" and "trainer" in rtc_connections[session_id]:
                    await rtc_connections[session_id]["trainer"].websocket.send_json(
                        {"type": "observer_left"}
                    )
                # Notify observer if trainer leaves (observer should disconnect)
                elif role == "trainer" and "observer" in rtc_connections[session_id]:
                    logger.info(f"Trainer left, notifying observer to disconnect")
                    await rtc_connections[session_id]["observer"].websocket.send_json(
                        {"type": "trainer_disconnected"}
                    )
                    # Also notify learner about trainer disconnection
                    if "learner" in rtc_connections[session_id]:
                        await rtc_connections[session_id]["learner"].websocket.send_json(
                            {"type": "peer_disconnected", "role": role}
                        )
                # Normal peer disconnection (but DON'T notify observers about learner/trainer disconnections)
                else:
                    role_mapping = {
                        "trainer": ["learner"],  # Only notify learner, not observer
                        "learner": ["trainer"],  # Only notify trainer, not observer
                        "coach": ["client", "guest"],
                        "client": ["coach"],
                        "guest": ["coach"]
                    }
                    other_roles = role_mapping.get(role, [])
                    for other_role in other_roles:
                        if other_role in rtc_connections[session_id]:
                            await rtc_connections[session_id][other_role].websocket.send_json(
                                {"type": "peer_disconnected", "role": role}
                            )
            except Exception as e:
                logger.error(f"Error notifying peer about disconnection: {e}")


@router.websocket("/ws/whiteboard/{session_id}")
async def websocket_whiteboard_endpoint(websocket: WebSocket, session_id: str):
    """
    Whiteboard and media sharing endpoint for both training sessions and coach sessions
    Supports session_id formats:
    - session_XXXX (training sessions - trainer/learner)
    - coach_session_XXXX (coach appointment sessions - coach/client)
    """
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

        # Support both training session roles (trainer/learner), coach session roles (coach/client/guest), and observer role (head)
        valid_roles = ["trainer", "learner", "coach", "client", "guest", "observer"]
        if role not in valid_roles:
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

        # Determine participant role (learner for training sessions, client/guest for coach sessions)
        participant_roles = ["learner", "client", "guest"]
        
        # If new participant joins and media is currently playing, send current state
        if role in participant_roles and session_id in media_states and media_states[session_id]:
            print(
                f"[WHITEBOARD] Sending current media state to new {role}: {media_states[session_id]}"
            )
            try:
                await websocket.send_json(
                    {"type": "media_control", "data": media_states[session_id]}
                )
            except Exception as e:
                print(f"[WHITEBOARD] Error sending media state to {role}: {e}")

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
                elif message.get("type") == "background_music":
                    # Handle background music events (play, stop, volume)
                    logger.info(f"[WHITEBOARD] Background music event from {role}: {message}")
                    # Broadcast to all connected participants except the sender
                    if session_id in whiteboard_connections:
                        for other_role, other_conn in whiteboard_connections[session_id].items():
                            if other_role != role and other_conn.is_alive:
                                try:
                                    logger.debug(f"[WHITEBOARD] Forwarding background_music to {other_role}")
                                    await other_conn.websocket.send_json(message)
                                except Exception as e:
                                    logger.error(f"[WHITEBOARD] Error sending background_music to {other_role}: {e}")
                elif message.get("type") == "background_music_volume":
                    # Handle background music volume changes
                    logger.info(f"[WHITEBOARD] Background music volume change from {role}: {message}")
                    # Broadcast to all connected participants except the sender
                    if session_id in whiteboard_connections:
                        for other_role, other_conn in whiteboard_connections[session_id].items():
                            if other_role != role and other_conn.is_alive:
                                try:
                                    logger.debug(f"[WHITEBOARD] Forwarding background_music_volume to {other_role}")
                                    await other_conn.websocket.send_json(message)
                                except Exception as e:
                                    logger.error(f"[WHITEBOARD] Error sending background_music_volume to {other_role}: {e}")
                else:
                    # Forward draw/clear/item_update messages to the other participant(s)
                    # Map roles to their counterparts (coach can have both client and guest, trainer broadcasts to learner and observer)
                    role_mapping = {
                        "trainer": ["learner", "observer"],
                        "learner": ["trainer"],
                        "coach": ["client", "guest"],
                        "client": ["coach"],
                        "guest": ["coach"],
                        "observer": []  # Observer is read-only, doesn't send whiteboard updates
                    }
                    
                    other_roles = role_mapping.get(role, [])
                    recipients_found = False
                    if message.get('type') == 'erase_pen':
                        print(f"[WHITEBOARD] 🗑️ Erase pen message received from {role}, forwarding to: {other_roles}")
                    for other_role in other_roles:
                        if other_role in whiteboard_connections[session_id]:
                            other_conn = whiteboard_connections[session_id][other_role]
                            if other_conn.is_alive:
                                logger.debug(
                                    f"[WHITEBOARD] Forwarding {message.get('type')} from {role} to {other_role}"
                                )
                                if message.get('type') == 'erase_pen':
                                    print(f"[WHITEBOARD] ✅ Forwarding erase_pen to {other_role}")
                                await other_conn.websocket.send_json(message)
                                recipients_found = True
                    
                    if not recipients_found:
                        logger.debug(
                            f"[WHITEBOARD] No active recipients for message from {role} in session {session_id}"
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

        # Clear media control lock if controller disconnects (trainer or coach)
        controller_roles = ["trainer", "coach"]
        if role in controller_roles and session_id in media_control_locks:
            media_control_locks[session_id] = None

        # Notify other participant(s) about disconnection
        if session_id in whiteboard_connections:
            try:
                role_mapping = {
                    "trainer": ["learner"],
                    "learner": ["trainer"],
                    "coach": ["client", "guest"],
                    "client": ["coach"],
                    "guest": ["coach"]
                }
                other_roles = role_mapping.get(role, [])
                for other_role in other_roles:
                    if other_role in whiteboard_connections[session_id]:
                        try:
                            await whiteboard_connections[session_id][other_role].websocket.send_json(
                                {"type": "peer_disconnected", "role": role}
                            )
                        except Exception as e:
                            logger.error(f"Error notifying {other_role} about {role} disconnect: {e}")
            except Exception as e:
                print(f"[WHITEBOARD] Error notifying peer about disconnection: {e}")


async def handle_media_control(message: Dict, session_id: str, role: str, websocket: WebSocket):
    """
    Handle media control events (open, play, pause, seek, page_change, close, request_snapshot)
    """
    data = message.get("data", {})
    action = data.get("action")

    print(f"[WHITEBOARD] Media control action: {action} from {role} in session {session_id}")

    # Only trainer/coach can control media (not learner/client/guest)
    controller_roles = ["trainer", "coach"]
    participant_roles = ["learner", "client", "guest"]
    
    if action != "request_snapshot" and role not in controller_roles:
        print(f"[WHITEBOARD] Non-controller attempting media control: {role}")
        return

    if action == "request_snapshot":
        # Participant (learner/client) requesting current media snapshot
        print(f"[WHITEBOARD] {role} requesting media snapshot for session: {session_id}")
        if session_id in media_states and media_states[session_id]:
            try:
                await websocket.send_json(
                    {"type": "media_control", "data": media_states[session_id]}
                )
            except Exception as e:
                print(f"[WHITEBOARD] Error sending media snapshot: {e}")
        return

    if action == "open":
        # Controller (trainer/coach) opening media - acquire lock
        media_control_locks[session_id] = (
            role  # Store controller identifier
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
        # Controller (trainer/coach) closing media - release lock
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

    # Broadcast media control event to participants (learner/client/guest)
    if session_id in whiteboard_connections:
        # Broadcast to all participants (learner, client, and guest)
        for participant_role in ["learner", "client", "guest"]:
            if participant_role in whiteboard_connections[session_id]:
                participant_conn = whiteboard_connections[session_id][participant_role]
        
                if participant_conn and participant_conn.is_alive:
                    try:
                        # Include server timestamp in the broadcast
                        broadcast_data = {
                            **data,
                            "timestamp": datetime.utcnow().isoformat(),
                            "serverTs": int(datetime.utcnow().timestamp() * 1000),
                            "activeControllerId": role,
                        }

                        # If closing or snapshot, send the current media state
                        if action in ["close", "request_snapshot"]:
                            broadcast_data = media_states.get(session_id) or broadcast_data

                        await participant_conn.websocket.send_json(
                            {"type": "media_control", "data": broadcast_data}
                        )
                        print(
                            f"[WHITEBOARD] Broadcasted media control '{action}' to {participant_role} in session {session_id}"
                        )
                    except Exception as e:
                        print(f"[WHITEBOARD] Error broadcasting media control to {participant_role}: {e}")
