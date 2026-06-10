"""
CRUD Operations for Device Sessions
Manages single-device active session constraint
"""

import hashlib
import logging
from datetime import datetime
from sqlalchemy import select, update, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device_session_model import DeviceSession

logger = logging.getLogger(__name__)


def hash_token(token: str) -> str:
    """Hash a JWT token to store securely"""
    return hashlib.sha256(token.encode()).hexdigest()


async def create_device_session(
    db: AsyncSession,
    user_id: int,
    device_id: str,
    access_token: str,
    device_name: str = None,
    device_type: str = None,
    browser_info: str = None,
    ip_address: str = None,
    role: str = None,
) -> DeviceSession:
    """
    Create a new device session for a user.
    This will deactivate any previously active session for this user.
    """
    logger.info(f"[DEVICE_SESSION] Creating new session for user_id={user_id}, device_id={device_id}")
    
    # Deactivate any active session for this user, unless they are an admin
    if role != "admin":
        await deactivate_all_active_sessions(db, user_id)
    
    # Create new device session
    token_hash = hash_token(access_token)
    new_session = DeviceSession(
        user_id=user_id,
        device_id=device_id,
        access_token_hash=token_hash,
        device_name=device_name,
        device_type=device_type,
        browser_info=browser_info,
        ip_address=ip_address,
        is_active=True,
    )
    
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    
    logger.info(f"[DEVICE_SESSION] New session created with ID={new_session.id}")
    return new_session


async def deactivate_all_active_sessions(db: AsyncSession, user_id: int) -> int:
    """
    Deactivate all active sessions for a user.
    Used when user logs in on a new device to enforce single-device rule.
    Returns count of deactivated sessions.
    """
    logger.info(f"[DEVICE_SESSION] Deactivating all active sessions for user_id={user_id}")
    
    result = await db.execute(
        update(DeviceSession)
        .where(
            and_(
                DeviceSession.user_id == user_id,
                DeviceSession.is_active == True
            )
        )
        .values(
            is_active=False,
            deactivated_at=datetime.utcnow()
        )
    )
    await db.commit()
    
    deactivated_count = result.rowcount
    logger.info(f"[DEVICE_SESSION] Deactivated {deactivated_count} active sessions for user_id={user_id}")
    return deactivated_count


async def get_active_session(db: AsyncSession, user_id: int) -> DeviceSession | None:
    """
    Get the currently active session for a user.
    Should only return zero or one result.
    """
    result = await db.execute(
        select(DeviceSession)
        .where(
            and_(
                DeviceSession.user_id == user_id,
                DeviceSession.is_active == True
            )
        )
        .order_by(desc(DeviceSession.created_at))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_session_by_device_id(db: AsyncSession, user_id: int, device_id: str) -> DeviceSession | None:
    """Get device session for specific user and device"""
    result = await db.execute(
        select(DeviceSession)
        .where(
            and_(
                DeviceSession.user_id == user_id,
                DeviceSession.device_id == device_id
            )
        )
        .order_by(desc(DeviceSession.created_at))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_session_by_token(db: AsyncSession, user_id: int, access_token: str) -> DeviceSession | None:
    """Get device session by token hash"""
    token_hash = hash_token(access_token)
    result = await db.execute(
        select(DeviceSession)
        .where(
            and_(
                DeviceSession.user_id == user_id,
                DeviceSession.access_token_hash == token_hash
            )
        )
    )
    return result.scalar_one_or_none()


async def validate_session_active(db: AsyncSession, user_id: int, access_token: str) -> bool:
    """
    Validate if the provided token corresponds to an active session.
    Returns True only if session is active and token matches.
    """
    session = await get_session_by_token(db, user_id, access_token)
    return session is not None and session.is_active


async def get_all_user_sessions(db: AsyncSession, user_id: int, active_only: bool = False) -> list[DeviceSession]:
    """Get all sessions for a user"""
    query = select(DeviceSession).where(DeviceSession.user_id == user_id)
    
    if active_only:
        query = query.where(DeviceSession.is_active == True)
    
    query = query.order_by(desc(DeviceSession.created_at))
    
    result = await db.execute(query)
    return result.scalars().all()


async def deactivate_session(db: AsyncSession, session_id: int) -> DeviceSession:
    """Deactivate a specific device session"""
    logger.info(f"[DEVICE_SESSION] Deactivating session_id={session_id}")
    
    result = await db.execute(
        update(DeviceSession)
        .where(DeviceSession.id == session_id)
        .values(
            is_active=False,
            deactivated_at=datetime.utcnow()
        )
        .returning(DeviceSession)
    )
    await db.commit()
    
    return result.scalar_one_or_none()


async def update_last_activity(db: AsyncSession, session_id: int) -> DeviceSession:
    """Update last activity timestamp for a session"""
    result = await db.execute(
        update(DeviceSession)
        .where(DeviceSession.id == session_id)
        .values(last_activity_at=datetime.utcnow())
        .returning(DeviceSession)
    )
    await db.commit()
    return result.scalar_one_or_none()


async def delete_inactive_sessions(db: AsyncSession, user_id: int = None) -> int:
    """
    Delete old inactive sessions (cleanup task).
    Can be called periodically to clean up the database.
    """
    if user_id:
        result = await db.execute(
            select(DeviceSession)
            .where(
                and_(
                    DeviceSession.user_id == user_id,
                    DeviceSession.is_active == False
                )
            )
        )
    else:
        result = await db.execute(
            select(DeviceSession).where(DeviceSession.is_active == False)
        )
    
    sessions = result.scalars().all()
    for session in sessions:
        await db.delete(session)
    
    await db.commit()
    return len(sessions)
