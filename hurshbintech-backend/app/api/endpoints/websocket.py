import asyncio
import logging
from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.utils.s3_utils import S3Manager, convert_s3_url_to_proxy
from app.db.session import AsyncSessionLocal
from app.crud import whiteboard_crud

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
    """Convert S3 URL to permanent backend proxy URL (no expiration)."""
    try:
        if settings.USE_S3 and file_url and file_url.startswith("s3://"):
            return convert_s3_url_to_proxy(file_url)
        return file_url
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"Error generating public URL: {str(e)}")
        return file_url


# Set up logging
logger = logging.getLogger(__name__)

# WebSocket configuration
HEARTBEAT_INTERVAL = 20  # Send ping every 20 seconds
HEARTBEAT_TIMEOUT = 300  # Allow up to 5 minutes before considering a connection stale
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
            await asyncio.sleep(HEARTBEAT_INTERVAL)
            if not conn_info.is_alive:
                break

            # Avoid aggressive disconnects on transient packet loss.
            # Keep the socket alive unless it has been stale for a long period.
            elapsed = (datetime.utcnow() - conn_info.last_heartbeat).total_seconds()
            if elapsed > HEARTBEAT_TIMEOUT:
                logger.warning(
                    f"Stale heartbeat for {conn_info.role} in session {conn_info.session_id} "
                    f"(last activity {elapsed:.1f}s ago)"
                )
                if elapsed > HEARTBEAT_TIMEOUT * 3:
                    logger.error(
                        f"Forcing disconnect for {conn_info.role} in session {conn_info.session_id} "
                        f"after prolonged inactivity ({elapsed:.1f}s)"
                    )
                    conn_info.is_alive = False
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

        # Trigger offer creation when both peers are present.
        # Fires for initial join AND when initiator reconnects while other party is already present.
        session_roles = set(rtc_connections[session_id].keys())
        if "trainer" in session_roles and "learner" in session_roles and role != "observer":
            logger.info(f"Trainer + learner both present — signaling trainer to create offer")
            await rtc_connections[session_id]["trainer"].websocket.send_json(
                {"type": "peer_ready", "role": "both_connected"}
            )
        elif "coach" in session_roles and "client" in session_roles:
            logger.info(f"Coach + client both present — signaling coach to create offer")
            await rtc_connections[session_id]["coach"].websocket.send_json(
                {"type": "peer_ready", "role": "both_connected"}
            )

        try:
            while conn_info.is_alive:
                message = await websocket.receive_json()
                conn_info.last_heartbeat = datetime.utcnow()

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

                # Coach signaling messages go to client only
                elif role == "coach" and message_type in ["offer", "answer", "ice-candidate"]:
                    if "client" in rtc_connections[session_id]:
                        other_conn = rtc_connections[session_id]["client"]
                        if other_conn.is_alive:
                            logger.info(f"Forwarding {message_type} from coach to client")
                            await other_conn.websocket.send_json(message)
                    continue

                # Client signaling messages go to coach only
                elif role == "client" and message_type in ["offer", "answer", "ice-candidate"]:
                    if "coach" in rtc_connections[session_id]:
                        other_conn = rtc_connections[session_id]["coach"]
                        if other_conn.is_alive:
                            logger.info(f"Forwarding {message_type} from client to coach")
                            await other_conn.websocket.send_json(message)
                    continue
                
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


async def persist_whiteboard_event(message: Dict, session_id: str, role: str):
    """
    Persist whiteboard events to database for state recovery on reconnection.
    Handles: draw, image, text_added, bucket_added, item_update, item_remove, erase_pen, clear_canvas
    """
    try:
        msg_type = message.get("type")
        data = message.get("data", {})
        
        # Log all whiteboard events for debugging
        logger.info(f"[WHITEBOARD] persist_whiteboard_event - type: {msg_type}, role: {role}, session: {session_id}")
        
        # Only persist events from controllers (trainer/coach), not from participants
        # This prevents duplicate saves when both sides send the same event
        controller_roles = ["trainer", "coach"]
        if role not in controller_roles:
            logger.debug(f"[WHITEBOARD] Skipping persistence for non-controller role: {role}")
            return
        
        async with AsyncSessionLocal() as db:
            if msg_type == "draw":
                # Transform draw data from flat structure to normalized path structure
                # Input: {prevX, prevY, currX, currY, color, strokeNorm, tool}
                # Output: {segments: [{prev: {x, y}, curr: {x, y}}], strokeNorm, color, tool, timestamp}
                timestamp = int(datetime.utcnow().timestamp() * 1000)
                normalized_stroke = {
                    "segments": [{
                        "prev": {"x": data.get("prevX"), "y": data.get("prevY")},
                        "curr": {"x": data.get("currX"), "y": data.get("currY")}
                    }],
                    "strokeNorm": data.get("strokeNorm", data.get("lineWidth", 0.005)),
                    "color": data.get("color", "#000000"),
                    "tool": data.get("tool", "pen"),
                    "timestamp": timestamp
                }
                item_id = f"stroke_{timestamp}"
                logger.debug(f"[WHITEBOARD] Saving drawing stroke {item_id} for session {session_id}")
                await whiteboard_crud.save_drawing_stroke(db, session_id, item_id, normalized_stroke)
                
            elif msg_type == "image":
                # Save canvas item (image/video/PDF)
                # The 'image' type is used for all media items (images, videos, PDFs)
                item_id = data.get("id")
                if not item_id:
                    # Generate ID if not provided
                    item_id = f"img_{int(datetime.utcnow().timestamp() * 1000)}"
                else:
                    # Convert to string (frontend may send integer IDs)
                    item_id = str(item_id)
                
                data["id"] = item_id
                
                # Ensure type field is set (from frontend data or default to 'image')
                if "type" not in data:
                    data["type"] = "image"
                
                logger.info(f"[WHITEBOARD] 🔵 ABOUT TO SAVE image/media item {item_id} (type: {data.get('type')}) for session {session_id}")
                logger.debug(f"[WHITEBOARD] Image data keys: {list(data.keys())}")
                result = await whiteboard_crud.save_canvas_item(db, session_id, item_id, data)
                logger.info(f"[WHITEBOARD] 🔵 SAVE RESULT for image {item_id}: {'SUCCESS' if result else 'FAILED'}")
                
            elif msg_type in ["text_added", "text_box_added"]:
                # Save text item
                item_id = data.get("id", f"text_{int(datetime.utcnow().timestamp() * 1000)}")
                # Convert to string (frontend may send integer IDs)
                item_id = str(item_id)
                data["id"] = item_id
                logger.info(f"[WHITEBOARD] 🟢 ABOUT TO SAVE text item {item_id} for session {session_id}")
                result = await whiteboard_crud.save_canvas_item(db, session_id, item_id, data)
                logger.info(f"[WHITEBOARD] 🟢 SAVE RESULT for text {item_id}: {'SUCCESS' if result else 'FAILED'}")
                
            elif msg_type in ["bucket_added", "bucket_update"]:
                # Save bucket
                item_id = data.get("id")
                if not item_id:
                    item_id = f"bucket_{int(datetime.utcnow().timestamp() * 1000)}"
                else:
                    # Convert to string (frontend sends integer IDs for buckets)
                    item_id = str(item_id)
                
                data["id"] = item_id
                
                # Add type field to identify as bucket during restoration
                data["type"] = "bucket"
                    
                logger.info(f"[WHITEBOARD] 🟣 ABOUT TO SAVE bucket {item_id} for session {session_id}")
                logger.debug(f"[WHITEBOARD] Bucket data keys: {list(data.keys())}")
                result = await whiteboard_crud.save_canvas_item(db, session_id, item_id, data)
                logger.info(f"[WHITEBOARD] 🟣 SAVE RESULT for bucket {item_id}: {'SUCCESS' if result else 'FAILED'}")
                
            elif msg_type == "item_update":
                # Update existing canvas item
                item_id = data.get("id")
                if item_id:
                    # Convert to string (frontend may send integer IDs)
                    item_id = str(item_id)
                    data["id"] = item_id
                    logger.info(f"[WHITEBOARD] 🟡 ABOUT TO UPDATE item {item_id} for session {session_id}")
                    result = await whiteboard_crud.save_canvas_item(db, session_id, item_id, data)
                    logger.info(f"[WHITEBOARD] 🟡 UPDATE RESULT for item {item_id}: {'SUCCESS' if result else 'FAILED'}")
                    
            elif msg_type == "item_remove":
                # Remove canvas item (soft delete)
                item_id = data.get("id")
                if item_id:
                    # Convert to string (frontend may send integer IDs)
                    item_id = str(item_id)
                    await whiteboard_crud.remove_canvas_item(db, session_id, item_id)
                    
            elif msg_type == "erase_pen":
                # Erase drawing strokes
                stroke_ids = data.get("eraseIds", [])
                if stroke_ids:
                    # Convert stroke IDs to format used in database
                    db_stroke_ids = [f"stroke_{sid}" if not str(sid).startswith("stroke_") else str(sid) for sid in stroke_ids]
                    await whiteboard_crud.erase_drawing_strokes(db, session_id, db_stroke_ids)
                    
            elif msg_type == "clear_canvas":
                # Clear entire canvas
                await whiteboard_crud.clear_canvas(db, session_id)
                logger.info(f"[WHITEBOARD] Cleared canvas for session {session_id}")
                
    except Exception as e:
        logger.error(f"[WHITEBOARD] Error persisting whiteboard event: {e}")
        # Don't raise - continue with forwarding even if persistence fails


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

        # Restore whiteboard state for reconnecting users
        try:
            async with AsyncSessionLocal() as db:
                whiteboard_state = await whiteboard_crud.get_session_state(db, session_id)
                if whiteboard_state and (whiteboard_state["drawings"] or whiteboard_state["items"]):
                    logger.info(
                        f"[WHITEBOARD] Restoring state for {role} in session {session_id}: "
                        f"{len(whiteboard_state['drawings'])} drawings, {len(whiteboard_state['items'])} items"
                    )
                    await websocket.send_json({
                        "type": "whiteboard_restore",
                        "data": whiteboard_state
                    })
        except Exception as e:
            logger.error(f"[WHITEBOARD] Error restoring whiteboard state: {e}")

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
                conn_info.last_heartbeat = datetime.utcnow()

                # Handle pong response
                if message.get("type") == "pong":
                    conn_info.last_heartbeat = datetime.utcnow()
                    logger.debug(f"[WHITEBOARD] Received pong from {role} in session {session_id}")
                    continue

                msg_type = message.get('type')
                logger.info(
                    f"[WHITEBOARD] Message from {role}: type={msg_type}, session={session_id}"
                )
                # Log full message for image, bucket, and item events
                if msg_type in ['image', 'bucket_added', 'bucket_update', 'item_update', 'item_remove']:
                    logger.info(f"[WHITEBOARD] Full message for {msg_type}: {message}")

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
                elif message.get("type") in ["calculator_operation", "calculator_result", "calculator_clear", "calculator_permission", "calculator_sync"]:
                    # Handle calculator events (operations, results, permissions)
                    logger.info(f"[WHITEBOARD] Calculator event from {role}: {message.get('type')}")
                    # Forward to appropriate participants (not persisted to database)
                    role_mapping = {
                        "trainer": ["learner", "observer"],
                        "learner": ["trainer"],
                        "coach": ["client", "guest"],
                        "client": ["coach"],
                        "guest": ["coach"],
                        "observer": []  # Observer is read-only
                    }
                    
                    other_roles = role_mapping.get(role, [])
                    if session_id in whiteboard_connections:
                        for other_role in other_roles:
                            if other_role in whiteboard_connections[session_id]:
                                other_conn = whiteboard_connections[session_id][other_role]
                                if other_conn.is_alive:
                                    try:
                                        logger.debug(f"[WHITEBOARD] Forwarding {message.get('type')} to {other_role}")
                                        await other_conn.websocket.send_json(message)
                                    except Exception as e:
                                        logger.error(f"[WHITEBOARD] Error sending {message.get('type')} to {other_role}: {e}")
                else:
                    # Persist whiteboard events to database before forwarding
                    await persist_whiteboard_event(message, session_id, role)

                    # Clear canvas should also reset any active media session state.
                    # This prevents stale media snapshots/locks from affecting the next drop.
                    if message.get("type") == "clear_canvas":
                        media_states[session_id] = None
                        media_control_locks[session_id] = None
                    
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
