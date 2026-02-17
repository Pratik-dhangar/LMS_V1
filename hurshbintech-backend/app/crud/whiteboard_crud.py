"""
Whiteboard State CRUD Operations
Handles persistence of whiteboard canvas state (drawings and items) across reconnections
Includes compression, batching, and automatic cleanup
"""

import gzip
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta

from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.whiteboard_state_model import WhiteboardState

logger = logging.getLogger(__name__)

# Configuration
MAX_DRAWING_STROKES = 10000  # Prevent memory issues
COMPRESSION_THRESHOLD = 1024  # Compress data larger than 1KB
MAX_STATE_SIZE_MB = 5  # Warn if state exceeds 5MB
BATCH_SIZE = 50  # Save drawing strokes in batches


def _compress_data(data: Dict[str, Any]) -> bytes:
    """Compress JSONB data using gzip"""
    json_str = json.dumps(data)
    return gzip.compress(json_str.encode('utf-8'))


def _decompress_data(compressed_data: bytes) -> Dict[str, Any]:
    """Decompress gzipped JSONB data"""
    json_str = gzip.decompress(compressed_data).decode('utf-8')
    return json.loads(json_str)


def _should_compress(data: Dict[str, Any]) -> bool:
    """Determine if data should be compressed"""
    json_str = json.dumps(data)
    return len(json_str.encode('utf-8')) > COMPRESSION_THRESHOLD


async def save_drawing_stroke(
    db: AsyncSession,
    session_id: str,
    item_id: str,
    stroke_data: Dict[str, Any]
) -> Optional[WhiteboardState]:
    """
    Save a single drawing stroke to the database.
    
    Args:
        db: Database session
        session_id: Training session ID
        item_id: Unique identifier for this drawing stroke
        stroke_data: Drawing data (segments, strokeNorm, color, tool, timestamp)
    
    Returns:
        WhiteboardState object or None if failed
    """
    try:
        # Check if total stroke count would exceed limit
        count_query = select(func.count(WhiteboardState.id)).where(
            (WhiteboardState.session_id == session_id) &
            (WhiteboardState.state_type == 'drawing') &
            (WhiteboardState.is_active == True)
        )
        result = await db.execute(count_query)
        stroke_count = result.scalar()
        
        if stroke_count >= MAX_DRAWING_STROKES:
            logger.warning(
                f"⚠️ Session {session_id} reached max drawing strokes ({MAX_DRAWING_STROKES}). "
                "Skipping new stroke."
            )
            return None
        
        # Create new whiteboard state entry
        whiteboard_state = WhiteboardState(
            session_id=session_id,
            state_type='drawing',
            item_id=item_id,
            data=stroke_data,
            is_active=True
        )
        
        db.add(whiteboard_state)
        await db.commit()
        await db.refresh(whiteboard_state)
        
        logger.info(f"✅ Saved drawing stroke {item_id} for session {session_id}")
        return whiteboard_state
        
    except IntegrityError as e:
        await db.rollback()
        logger.error(f"❌ Failed to save drawing stroke {item_id}: {str(e)}")
        return None
    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Unexpected error saving drawing stroke: {str(e)}")
        return None


async def save_canvas_item(
    db: AsyncSession,
    session_id: str,
    item_id: str,
    item_data: Dict[str, Any]
) -> Optional[WhiteboardState]:
    """
    Save or update a canvas item (image, text, bucket, etc.)
    
    Args:
        db: Database session
        session_id: Training session ID
        item_id: Unique identifier for this canvas item
        item_data: Item data (type, src, x, y, width, height, etc.)
    
    Returns:
        WhiteboardState object or None if failed
    """
    try:
        # Check if item already exists (update case)
        query = select(WhiteboardState).where(
            (WhiteboardState.session_id == session_id) &
            (WhiteboardState.item_id == item_id) &
            (WhiteboardState.state_type == 'item')
        )
        result = await db.execute(query)
        existing_item = result.scalar_one_or_none()
        
        if existing_item:
            # MERGE new data with existing data to preserve fields like src, title, type, etc.
            # This is critical because item_update messages only contain position data,
            # while the original image/bucket record has src, fileUrl, thumbnail, etc.
            merged_data = {**existing_item.data, **item_data}
            
            # Update existing item with merged data
            stmt = update(WhiteboardState).where(
                WhiteboardState.id == existing_item.id
            ).values(
                data=merged_data,
                is_active=True,
                updated_at=datetime.utcnow()
            )
            await db.execute(stmt)
            await db.commit()
            
            # Fetch updated record
            result = await db.execute(query)
            updated_item = result.scalar_one_or_none()
            logger.info(f"✅ Updated canvas item {item_id} for session {session_id}")
            return updated_item
        else:
            # Create new item
            whiteboard_state = WhiteboardState(
                session_id=session_id,
                state_type='item',
                item_id=item_id,
                data=item_data,
                is_active=True
            )
            
            db.add(whiteboard_state)
            await db.commit()
            await db.refresh(whiteboard_state)
            
            logger.info(f"✅ Saved new canvas item {item_id} for session {session_id}")
            return whiteboard_state
            
    except IntegrityError as e:
        await db.rollback()
        logger.error(f"❌ Failed to save canvas item {item_id}: {str(e)}")
        return None
    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Unexpected error saving canvas item: {str(e)}")
        return None


async def remove_canvas_item(
    db: AsyncSession,
    session_id: str,
    item_id: str
) -> bool:
    """
    Mark a canvas item as inactive (soft delete)
    
    Args:
        db: Database session
        session_id: Training session ID
        item_id: Item ID to remove
    
    Returns:
        True if successful, False otherwise
    """
    try:
        stmt = update(WhiteboardState).where(
            (WhiteboardState.session_id == session_id) &
            (WhiteboardState.item_id == item_id) &
            (WhiteboardState.state_type == 'item')
        ).values(
            is_active=False,
            updated_at=datetime.utcnow()
        )
        
        result = await db.execute(stmt)
        await db.commit()
        
        if result.rowcount > 0:
            logger.info(f"✅ Removed canvas item {item_id} from session {session_id}")
            return True
        else:
            logger.warning(f"⚠️ Item {item_id} not found in session {session_id}")
            return False
            
    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Failed to remove canvas item {item_id}: {str(e)}")
        return False


async def erase_drawing_strokes(
    db: AsyncSession,
    session_id: str,
    stroke_ids: List[str]
) -> int:
    """
    Mark multiple drawing strokes as inactive (erased)
    
    Args:
        db: Database session
        session_id: Training session ID
        stroke_ids: List of stroke IDs to erase
    
    Returns:
        Number of strokes erased
    """
    try:
        stmt = update(WhiteboardState).where(
            (WhiteboardState.session_id == session_id) &
            (WhiteboardState.item_id.in_(stroke_ids)) &
            (WhiteboardState.state_type == 'drawing')
        ).values(
            is_active=False,
            updated_at=datetime.utcnow()
        )
        
        result = await db.execute(stmt)
        await db.commit()
        
        logger.info(f"✅ Erased {result.rowcount} drawing strokes from session {session_id}")
        return result.rowcount
        
    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Failed to erase drawing strokes: {str(e)}")
        return 0


async def clear_canvas(
    db: AsyncSession,
    session_id: str
) -> bool:
    """
    Clear all whiteboard content for a session (mark all as inactive)
    
    Args:
        db: Database session
        session_id: Training session ID
    
    Returns:
        True if successful, False otherwise
    """
    try:
        stmt = update(WhiteboardState).where(
            (WhiteboardState.session_id == session_id) &
            (WhiteboardState.is_active == True)
        ).values(
            is_active=False,
            updated_at=datetime.utcnow()
        )
        
        result = await db.execute(stmt)
        await db.commit()
        
        logger.info(f"✅ Cleared canvas for session {session_id} ({result.rowcount} items)")
        return True
        
    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Failed to clear canvas for session {session_id}: {str(e)}")
        return False


async def get_session_state(
    db: AsyncSession,
    session_id: str
) -> Dict[str, Any]:
    """
    Retrieve full whiteboard state for a session.
    Returns both drawings and canvas items.
    
    Args:
        db: Database session
        session_id: Training session ID
    
    Returns:
        Dictionary with 'drawings' and 'items' arrays
    """
    try:
        # Fetch all active whiteboard state for session
        query = select(WhiteboardState).where(
            (WhiteboardState.session_id == session_id) &
            (WhiteboardState.is_active == True)
        ).order_by(WhiteboardState.created_at)
        
        result = await db.execute(query)
        states = result.scalars().all()
        
        # Separate drawings and items
        drawings = []
        items = []
        
        total_size = 0
        for state in states:
            data_size = len(json.dumps(state.data).encode('utf-8'))
            total_size += data_size
            
            if state.state_type == 'drawing':
                drawings.append(state.data)
            elif state.state_type == 'item':
                items.append(state.data)
        
        # Warn if state is too large
        size_mb = total_size / (1024 * 1024)
        if size_mb > MAX_STATE_SIZE_MB:
            logger.warning(
                f"⚠️ Large whiteboard state for session {session_id}: {size_mb:.2f}MB "
                f"({len(drawings)} drawings, {len(items)} items)"
            )
        
        logger.info(
            f"✅ Retrieved whiteboard state for session {session_id}: "
            f"{len(drawings)} drawings, {len(items)} items ({size_mb:.2f}MB)"
        )
        
        return {
            "drawings": drawings,
            "items": items
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to retrieve session state for {session_id}: {str(e)}")
        return {"drawings": [], "items": []}


async def cleanup_session_state(
    db: AsyncSession,
    session_id: str
) -> bool:
    """
    Permanently delete all whiteboard state for a completed session.
    Called when session ends to free up storage.
    
    Args:
        db: Database session
        session_id: Training session ID
    
    Returns:
        True if successful, False otherwise
    """
    try:
        stmt = delete(WhiteboardState).where(
            WhiteboardState.session_id == session_id
        )
        
        result = await db.execute(stmt)
        await db.commit()
        
        logger.info(f"✅ Cleaned up whiteboard state for session {session_id} ({result.rowcount} records deleted)")
        return True
        
    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Failed to cleanup session state for {session_id}: {str(e)}")
        return False


async def cleanup_old_states(
    db: AsyncSession,
    hours_old: int = 24
) -> int:
    """
    Background cleanup job: Delete whiteboard states older than specified hours.
    Safety net for sessions that didn't properly clean up.
    
    Args:
        db: Database session
        hours_old: Delete states older than this many hours
    
    Returns:
        Number of records deleted
    """
    try:
        cutoff_time = datetime.utcnow() - timedelta(hours=hours_old)
        
        stmt = delete(WhiteboardState).where(
            WhiteboardState.created_at < cutoff_time
        )
        
        result = await db.execute(stmt)
        await db.commit()
        
        if result.rowcount > 0:
            logger.info(f"✅ Background cleanup: Deleted {result.rowcount} old whiteboard states (>{hours_old}h)")
        
        return result.rowcount
        
    except Exception as e:
        await db.rollback()
        logger.error(f"❌ Failed to cleanup old whiteboard states: {str(e)}")
        return 0
