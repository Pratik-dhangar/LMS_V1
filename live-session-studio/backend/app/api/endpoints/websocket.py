"""
WebSocket relay for Live Session Studio.
Adapted from hurshbintech-backend/app/api/endpoints/websocket.py.
Removes coach/client/guest/observer branches; adds demo token auth and
paired-room membership admission gate.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import jwt, JWTError
from sqlalchemy import select, and_

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.crud import whiteboard_crud
from app.models.rooms import Room
from app.models.memberships import RoomMembership

router = APIRouter()
logger = logging.getLogger(__name__)

# Heartbeat config
HEARTBEAT_INTERVAL = 20
HEARTBEAT_TIMEOUT = 300


class ConnectionInfo:
    def __init__(self, websocket: WebSocket, role: str, session_id: str):
        self.websocket = websocket
        self.role = role
        self.session_id = session_id
        self.last_heartbeat = datetime.utcnow()
        self.is_alive = True
        self.heartbeat_task: Optional[asyncio.Task] = None

    async def close(self):
        self.is_alive = False
        if self.heartbeat_task and not self.heartbeat_task.done():
            self.heartbeat_task.cancel()
            try:
                await self.heartbeat_task
            except asyncio.CancelledError:
                pass
        try:
            await self.websocket.close()
        except Exception:
            pass


# In-memory connection registries
rtc_connections: Dict[str, Dict[str, ConnectionInfo]] = {}
whiteboard_connections: Dict[str, Dict[str, ConnectionInfo]] = {}

# Media state per session
media_states: Dict[str, Optional[Dict]] = {}
media_control_locks: Dict[str, Optional[str]] = {}


async def send_heartbeat(conn: ConnectionInfo):
    try:
        while conn.is_alive:
            await asyncio.sleep(HEARTBEAT_INTERVAL)
            if not conn.is_alive:
                break
            elapsed = (datetime.utcnow() - conn.last_heartbeat).total_seconds()
            if elapsed > HEARTBEAT_TIMEOUT * 3:
                conn.is_alive = False
                break
            try:
                await conn.websocket.send_json({"type": "ping", "timestamp": datetime.utcnow().isoformat()})
            except Exception:
                conn.is_alive = False
                break
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.error(f"Heartbeat error: {e}")


async def cleanup_connection(connections: Dict, session_id: str, role: Optional[str]):
    try:
        if session_id in connections and role and role in connections[session_id]:
            conn = connections[session_id][role]
            # Only delete if same socket instance (prevents new connection from being removed)
            await conn.close()
            if connections[session_id].get(role) is conn:
                del connections[session_id][role]
            if not connections[session_id]:
                del connections[session_id]
    except Exception as e:
        logger.error(f"Cleanup error: {e}")


async def _validate_token(token: str) -> Optional[dict]:
    """Validate demo JWT and return payload or None."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


async def _get_room_and_validate(session_id: str, user_id: int, claimed_role: str) -> Optional[Room]:
    """Validate that user is a paired participant with the claimed role."""
    async with AsyncSessionLocal() as db:
        r = await db.execute(select(Room).where(Room.session_id == session_id))
        room = r.scalar_one_or_none()
        if not room or room.status == "ended":
            return None
        if claimed_role == "trainer" and room.trainer_id == user_id:
            return room
        if claimed_role == "learner" and room.learner_id == user_id:
            return room
        return None


async def _get_membership_state(session_id: str, learner_id: int) -> Optional[str]:
    async with AsyncSessionLocal() as db:
        r = await db.execute(select(Room).where(Room.session_id == session_id))
        room = r.scalar_one_or_none()
        if not room:
            return None
        mr = await db.execute(
            select(RoomMembership).where(
                and_(RoomMembership.room_id == room.id, RoomMembership.learner_id == learner_id)
            )
        )
        mem = mr.scalar_one_or_none()
        return mem.state if mem else None


# ---- RTC endpoint ----

@router.websocket("/ws/rtc/{session_id}")
async def websocket_rtc_endpoint(websocket: WebSocket, session_id: str):
    logger.info(f"[RTC] Connection for session: {session_id}")
    await websocket.accept()

    role = None
    conn_info = None
    user_id = None

    try:
        join_msg = await websocket.receive_json()
        if join_msg.get("type") != "join":
            await websocket.close()
            return

        role = join_msg.get("role")
        token = join_msg.get("token") or websocket.query_params.get("token")

        if role not in ("trainer", "learner"):
            await websocket.send_json({"type": "error", "message": "Invalid role"})
            await websocket.close()
            return

        # Validate token
        payload = await _validate_token(token) if token else None
        if not payload:
            await websocket.send_json({"type": "error", "message": "Authentication required"})
            await websocket.close()
            return

        user_id = int(payload.get("sub", 0))
        token_role = payload.get("role")
        if token_role != role:
            await websocket.send_json({"type": "error", "message": "Role mismatch"})
            await websocket.close()
            return

        # Validate room membership
        room = await _get_room_and_validate(session_id, user_id, role)
        if not room:
            await websocket.send_json({"type": "error", "message": "Not authorized for this room"})
            await websocket.close()
            return

        # Learner must have an active invitation (not rejected or closed)
        if role == "learner":
            mem_state = await _get_membership_state(session_id, user_id)
            if mem_state not in ("invited", "join_requested", "admitted", "left"):
                await websocket.send_json({"type": "error", "message": "Access revoked"})
                await websocket.close()
                return

        # Register connection
        if session_id not in rtc_connections:
            rtc_connections[session_id] = {}

        conn_info = ConnectionInfo(websocket, role, session_id)
        rtc_connections[session_id][role] = conn_info
        conn_info.heartbeat_task = asyncio.create_task(send_heartbeat(conn_info))

        # Update trainer presence
        if role == "trainer":
            from app.api.endpoints.rooms import trainer_presence
            trainer_presence[session_id] = True

        await websocket.send_json({
            "type": "connected",
            "role": role,
            "session_id": session_id,
            "heartbeat_interval": HEARTBEAT_INTERVAL,
            "ice_servers": settings.ICE_SERVERS,
        })

        # Signal peer_ready when both trainer + learner connected
        session_roles = set(rtc_connections.get(session_id, {}).keys())
        if "trainer" in session_roles and "learner" in session_roles:
            logger.info(f"[RTC] Both peers present - signaling trainer for session {session_id}")
            trainer_conn = rtc_connections[session_id].get("trainer")
            if trainer_conn and trainer_conn.is_alive:
                await trainer_conn.websocket.send_json({"type": "peer_ready", "role": "both_connected"})

        # Message loop
        try:
            while conn_info.is_alive:
                message = await websocket.receive_json()
                conn_info.last_heartbeat = datetime.utcnow()

                msg_type = message.get("type")

                if msg_type == "ping":
                    await websocket.send_json({"type": "pong", "timestamp": datetime.utcnow().isoformat()})
                    continue
                if msg_type == "pong":
                    continue

                # Validate learner is admitted before forwarding SDP/ICE
                if role == "learner" and msg_type in ("offer", "answer", "ice-candidate"):
                    mem_state = await _get_membership_state(session_id, user_id)
                    if mem_state != "admitted":
                        logger.warning(f"[RTC] Unadmitted learner trying to send {msg_type}")
                        continue

                # Route messages
                target_role = message.get("target")
                if target_role and target_role in rtc_connections.get(session_id, {}):
                    other = rtc_connections[session_id][target_role]
                    if other.is_alive:
                        await other.websocket.send_json(message)
                    continue

                # Default routing: trainer <-> learner
                if role == "trainer" and msg_type in ("offer", "answer", "ice-candidate"):
                    other = rtc_connections.get(session_id, {}).get("learner")
                    if other and other.is_alive:
                        await other.websocket.send_json(message)
                    continue
                if role == "learner" and msg_type in ("offer", "answer", "ice-candidate"):
                    other = rtc_connections.get(session_id, {}).get("trainer")
                    if other and other.is_alive:
                        await other.websocket.send_json(message)
                    continue

                # Generic broadcast to paired peer
                peer_role = "learner" if role == "trainer" else "trainer"
                peer = rtc_connections.get(session_id, {}).get(peer_role)
                if peer and peer.is_alive:
                    await peer.websocket.send_json(message)

        except WebSocketDisconnect:
            logger.info(f"[RTC] Disconnected: session={session_id}, role={role}")
        except Exception as e:
            logger.error(f"[RTC] Message loop error: {e}")

    except WebSocketDisconnect:
        logger.info(f"[RTC] Setup disconnect: session={session_id}, role={role}")
    except Exception as e:
        logger.error(f"[RTC] Error: {e}")
    finally:
        await cleanup_connection(rtc_connections, session_id, role)
        # Clear trainer presence
        if role == "trainer":
            try:
                from app.api.endpoints.rooms import trainer_presence
                trainer_presence.pop(session_id, None)
            except Exception:
                pass
        # Notify peer
        peer_role = "learner" if role == "trainer" else "trainer"
        peer = rtc_connections.get(session_id, {}).get(peer_role)
        if peer and peer.is_alive:
            try:
                await peer.websocket.send_json({"type": "peer_disconnected", "role": role})
            except Exception:
                pass


# ---- Whiteboard endpoint ----

@router.websocket("/ws/whiteboard/{session_id}")
async def websocket_whiteboard_endpoint(websocket: WebSocket, session_id: str):
    logger.info(f"[WB] Connection for session: {session_id}")
    await websocket.accept()

    role = None
    conn_info = None
    user_id = None

    try:
        join_msg = await websocket.receive_json()
        if join_msg.get("type") != "join":
            await websocket.close()
            return

        role = join_msg.get("role")
        token = join_msg.get("token") or websocket.query_params.get("token")

        if role not in ("trainer", "learner"):
            await websocket.send_json({"type": "error", "message": "Invalid role"})
            await websocket.close()
            return

        payload = await _validate_token(token) if token else None
        if not payload:
            await websocket.send_json({"type": "error", "message": "Authentication required"})
            await websocket.close()
            return

        user_id = int(payload.get("sub", 0))
        if payload.get("role") != role:
            await websocket.send_json({"type": "error", "message": "Role mismatch"})
            await websocket.close()
            return

        room = await _get_room_and_validate(session_id, user_id, role)
        if not room:
            await websocket.send_json({"type": "error", "message": "Not authorized"})
            await websocket.close()
            return

        # Learner may connect for admission control, but cannot receive board data until admitted
        learner_admitted = False
        if role == "learner":
            mem_state = await _get_membership_state(session_id, user_id)
            if mem_state not in ("invited", "join_requested", "admitted", "left"):
                await websocket.send_json({"type": "error", "message": "Access revoked"})
                await websocket.close()
                return
            learner_admitted = (mem_state == "admitted")

        if session_id not in whiteboard_connections:
            whiteboard_connections[session_id] = {}

        conn_info = ConnectionInfo(websocket, role, session_id)
        whiteboard_connections[session_id][role] = conn_info
        conn_info.heartbeat_task = asyncio.create_task(send_heartbeat(conn_info))

        await websocket.send_json({
            "type": "connected",
            "role": role,
            "session_id": session_id,
            "heartbeat_interval": HEARTBEAT_INTERVAL,
        })

        # Notify trainer when learner connects
        if role == "learner":
            trainer_conn = whiteboard_connections.get(session_id, {}).get("trainer")
            if trainer_conn and trainer_conn.is_alive:
                try:
                    await trainer_conn.websocket.send_json({
                        "type": "participant_joined",
                        "data": {"role": role, "session_id": session_id},
                    })
                except Exception:
                    pass

        # Restore board state - only for admitted learner or trainer
        if role == "trainer" or learner_admitted:
            try:
                async with AsyncSessionLocal() as db:
                    state = await whiteboard_crud.get_session_state(db, session_id)
                    if state and (state.get("drawings") or state.get("items") or state.get("pdfAnnotations")):
                        await websocket.send_json({"type": "whiteboard_restore", "data": state})
            except Exception as e:
                logger.error(f"[WB] Restore error: {e}")

        # Send media state if admitted
        if role == "learner" and learner_admitted:
            if session_id in media_states and media_states[session_id]:
                try:
                    await websocket.send_json({"type": "media_control", "data": media_states[session_id]})
                except Exception:
                    pass

        # Message loop
        try:
            while conn_info.is_alive:
                message = await websocket.receive_json()
                conn_info.last_heartbeat = datetime.utcnow()

                msg_type = message.get("type")

                if msg_type == "pong":
                    continue
                if msg_type == "ping":
                    await websocket.send_json({"type": "pong", "timestamp": datetime.utcnow().isoformat()})
                    continue

                # Re-check admission for learner writes
                if role == "learner":
                    mem_state = await _get_membership_state(session_id, user_id)
                    learner_admitted = (mem_state == "admitted")

                # Admission grant: board restore on first admit
                if msg_type == "admission_granted" and role == "trainer":
                    # Trainer signals that learner was admitted - restore board to learner
                    learner_conn = whiteboard_connections.get(session_id, {}).get("learner")
                    if learner_conn and learner_conn.is_alive:
                        try:
                            async with AsyncSessionLocal() as db:
                                state = await whiteboard_crud.get_session_state(db, session_id)
                                if state:
                                    await learner_conn.websocket.send_json({"type": "whiteboard_restore", "data": state})
                            if session_id in media_states and media_states[session_id]:
                                await learner_conn.websocket.send_json({"type": "media_control", "data": media_states[session_id]})
                        except Exception as e:
                            logger.error(f"[WB] Post-admit restore error: {e}")
                    continue

                # Waiting messages (rejection/removal signals)
                if msg_type == "waiting_message":
                    # Only trainer can send waiting_message
                    if role == "trainer":
                        learner_conn = whiteboard_connections.get(session_id, {}).get("learner")
                        if learner_conn and learner_conn.is_alive:
                            await learner_conn.websocket.send_json(message)
                    continue

                # Session ended broadcast
                if msg_type == "session_ended":
                    if role == "trainer":
                        learner_conn = whiteboard_connections.get(session_id, {}).get("learner")
                        if learner_conn and learner_conn.is_alive:
                            await learner_conn.websocket.send_json(message)
                    continue

                # Media control
                if msg_type == "media_control":
                    await _handle_media_control(message, session_id, role, websocket)
                    continue

                # Calculator, stopwatch, reactions, background_music - broadcast to peer
                broadcast_types = {
                    "calculator_operation", "calculator_result", "calculator_clear",
                    "calculator_permission", "calculator_sync",
                    "background_music", "background_music_volume",
                    "reaction", "feedback",
                    "stopwatch_control",
                    "exercise_data", "exercise_response", "exercise_permission",
                    "learner_permission", "tool_permission",
                    "youtube_control", "youtube_state",
                    "comment_added", "comment_updated", "comment_deleted",
                }
                if msg_type in broadcast_types:
                    peer_role = "learner" if role == "trainer" else "trainer"
                    peer = whiteboard_connections.get(session_id, {}).get(peer_role)
                    if peer and peer.is_alive:
                        await peer.websocket.send_json(message)
                    continue

                # Whiteboard events - persist and forward
                await _persist_whiteboard_event(message, session_id, role)
                if msg_type == "clear_canvas":
                    media_states[session_id] = None
                    media_control_locks[session_id] = None

                peer_role = "learner" if role == "trainer" else "trainer"
                peer = whiteboard_connections.get(session_id, {}).get(peer_role)
                if peer and peer.is_alive:
                    await peer.websocket.send_json(message)

        except WebSocketDisconnect:
            logger.info(f"[WB] Disconnected: session={session_id}, role={role}")
        except Exception as e:
            logger.error(f"[WB] Message loop error: {e}")

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"[WB] Setup error: {e}")
    finally:
        await cleanup_connection(whiteboard_connections, session_id, role)
        if role == "trainer":
            media_control_locks.pop(session_id, None)
        peer_role = "learner" if role == "trainer" else "trainer"
        peer = whiteboard_connections.get(session_id, {}).get(peer_role)
        if peer and peer.is_alive:
            try:
                await peer.websocket.send_json({"type": "peer_disconnected", "role": role})
            except Exception:
                pass


async def _handle_media_control(message: dict, session_id: str, role: str, websocket: WebSocket):
    """Handle media_control events. Only trainer can control media."""
    data = message.get("data", {})
    action = data.get("action")

    if action == "request_snapshot" and role == "learner":
        if session_id in media_states and media_states[session_id]:
            try:
                await websocket.send_json({"type": "media_control", "data": media_states[session_id]})
            except Exception:
                pass
        return

    if role != "trainer":
        return

    ts_now = int(datetime.utcnow().timestamp() * 1000)

    if action == "open":
        media_control_locks[session_id] = role
        media_states[session_id] = {
            "action": "open",
            "mediaId": data.get("mediaId"),
            "mediaType": data.get("mediaType"),
            "mediaUrl": data.get("mediaUrl"),
            "status": "paused",
            "currentTime": data.get("currentTime", 0),
            "currentPage": data.get("currentPage", 1),
            "activeTrainerId": role,
            "timestamp": datetime.utcnow().isoformat(),
            "serverTs": ts_now,
        }
    elif action == "close":
        media_control_locks.pop(session_id, None)
        media_states[session_id] = None
    elif action in ("play", "pause", "seek", "page_change"):
        if session_id in media_states and media_states[session_id]:
            media_states[session_id].update({
                "action": action,
                "timestamp": datetime.utcnow().isoformat(),
                "serverTs": ts_now,
            })
            if action == "seek":
                media_states[session_id]["currentTime"] = data.get("currentTime", 0)
            if action == "page_change":
                media_states[session_id]["currentPage"] = data.get("currentPage", 1)
            if action == "play":
                media_states[session_id]["status"] = "playing"
            if action == "pause":
                media_states[session_id]["status"] = "paused"

    # Broadcast to learner
    learner_conn = whiteboard_connections.get(session_id, {}).get("learner")
    if learner_conn and learner_conn.is_alive:
        try:
            broadcast = {**data, "timestamp": datetime.utcnow().isoformat(), "serverTs": ts_now}
            await learner_conn.websocket.send_json({"type": "media_control", "data": broadcast})
        except Exception:
            pass


async def _persist_whiteboard_event(message: dict, session_id: str, role: str):
    """Persist whiteboard draw/item events to PostgreSQL. Only from trainer."""
    if role != "trainer":
        return
    try:
        msg_type = message.get("type")
        data = message.get("data", {})
        async with AsyncSessionLocal() as db:
            ts = int(datetime.utcnow().timestamp() * 1000)
            if msg_type == "draw":
                stroke = {
                    "segments": [{"prev": {"x": data.get("prevX"), "y": data.get("prevY")},
                                   "curr": {"x": data.get("currX"), "y": data.get("currY")}}],
                    "strokeNorm": data.get("strokeNorm", 0.005),
                    "color": data.get("color", "#000000"),
                    "tool": data.get("tool", "pen"),
                    "timestamp": ts,
                }
                await whiteboard_crud.save_drawing_stroke(db, session_id, f"stroke_{ts}", stroke)
            elif msg_type == "pdf_draw":
                stroke = {
                    "segments": [{"prev": {"x": data.get("prevX"), "y": data.get("prevY")},
                                   "curr": {"x": data.get("currX"), "y": data.get("currY")}}],
                    "strokeNorm": data.get("strokeNorm", 0.005),
                    "color": data.get("color", "#000000"),
                    "tool": data.get("tool", "pen"),
                    "pdfId": data.get("pdfId"),
                    "pageNumber": data.get("pageNumber"),
                    "timestamp": ts,
                }
                await whiteboard_crud.save_pdf_annotation(db, session_id, f"pdf_stroke_{ts}", stroke)
            elif msg_type in ("image", "text_added", "text_box_added", "bucket_added", "bucket_update", "item_update"):
                item_id = str(data.get("id", f"item_{ts}"))
                data["id"] = item_id
                if msg_type in ("bucket_added", "bucket_update"):
                    data["type"] = "bucket"
                await whiteboard_crud.save_canvas_item(db, session_id, item_id, data)
            elif msg_type == "item_remove":
                item_id = str(data.get("id", ""))
                if item_id:
                    await whiteboard_crud.remove_canvas_item(db, session_id, item_id)
            elif msg_type == "erase_pen":
                ids = [f"stroke_{sid}" if not str(sid).startswith("stroke_") else str(sid)
                       for sid in data.get("eraseIds", [])]
                if ids:
                    await whiteboard_crud.erase_drawing_strokes(db, session_id, ids)
            elif msg_type == "clear_canvas":
                await whiteboard_crud.clear_canvas(db, session_id)
            elif msg_type == "pdf_clear_annotations":
                await whiteboard_crud.clear_pdf_annotations(db, session_id, data.get("pdfId"), data.get("pageNumber"))
    except Exception as e:
        logger.error(f"[WB] Persist error: {e}")
