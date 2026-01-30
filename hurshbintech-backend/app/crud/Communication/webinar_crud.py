"""
CRUD operations for Webinars
"""

import logging
from typing import List, Optional
from datetime import datetime

from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.Communication.webinar_model import Webinar, WebinarParticipant
from app.models.user_model import User
from app.schemas.Communication.webinar import WebinarCreate, WebinarUpdate

logger = logging.getLogger(__name__)


# ============ WEBINAR CRUD OPERATIONS ============

async def create_webinar(
    db: AsyncSession,
    webinar_data: WebinarCreate,
    created_by_user_id: int
) -> Webinar:
    """Create a new webinar with participants"""
    logger.debug(f"Creating new webinar: {webinar_data.title}")
    
    # Create webinar
    new_webinar = Webinar(
        title=webinar_data.title,
        description=webinar_data.description,
        meeting_link=webinar_data.meeting_link,
        scheduled_date=webinar_data.scheduled_date,
        scheduled_time=webinar_data.scheduled_time,
        created_by_user_id=created_by_user_id
    )
    
    db.add(new_webinar)
    await db.flush()  # Get the webinar ID
    
    # Add registered user participants
    if webinar_data.participant_user_ids:
        for user_id in webinar_data.participant_user_ids:
            participant = WebinarParticipant(
                webinar_id=new_webinar.id,
                user_id=user_id,
                unregistered_email=None
            )
            db.add(participant)
    
    # Add unregistered email participants
    if webinar_data.unregistered_emails:
        for email in webinar_data.unregistered_emails:
            participant = WebinarParticipant(
                webinar_id=new_webinar.id,
                user_id=None,
                unregistered_email=email
            )
            db.add(participant)
    
    await db.commit()
    await db.refresh(new_webinar)
    
    logger.info(f"Created webinar ID: {new_webinar.id} with {len(webinar_data.participant_user_ids or [])} registered and {len(webinar_data.unregistered_emails or [])} unregistered participants")
    
    return new_webinar


async def get_webinar_by_id(db: AsyncSession, webinar_id: int) -> Optional[Webinar]:
    """Get webinar by ID with all relationships loaded"""
    result = await db.execute(
        select(Webinar)
        .options(
            joinedload(Webinar.created_by_user),
            joinedload(Webinar.participants).joinedload(WebinarParticipant.user)
        )
        .where(Webinar.id == webinar_id)
    )
    return result.unique().scalar_one_or_none()


async def get_all_webinars(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100
) -> List[Webinar]:
    """Get all webinars with pagination"""
    result = await db.execute(
        select(Webinar)
        .options(
            joinedload(Webinar.created_by_user),
            joinedload(Webinar.participants).joinedload(WebinarParticipant.user)
        )
        .order_by(Webinar.scheduled_date.desc(), Webinar.scheduled_time.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.unique().scalars().all()


async def get_webinars_by_creator(
    db: AsyncSession,
    creator_user_id: int,
    skip: int = 0,
    limit: int = 100
) -> List[Webinar]:
    """Get all webinars created by a specific user"""
    result = await db.execute(
        select(Webinar)
        .options(
            joinedload(Webinar.created_by_user),
            joinedload(Webinar.participants).joinedload(WebinarParticipant.user)
        )
        .where(Webinar.created_by_user_id == creator_user_id)
        .order_by(Webinar.scheduled_date.desc(), Webinar.scheduled_time.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.unique().scalars().all()


async def get_webinars_for_participant(
    db: AsyncSession,
    user_id: int,
    skip: int = 0,
    limit: int = 100
) -> List[Webinar]:
    """Get all webinars where user is a participant"""
    result = await db.execute(
        select(Webinar)
        .join(WebinarParticipant)
        .options(
            joinedload(Webinar.created_by_user),
            joinedload(Webinar.participants).joinedload(WebinarParticipant.user)
        )
        .where(WebinarParticipant.user_id == user_id)
        .order_by(Webinar.scheduled_date.desc(), Webinar.scheduled_time.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.unique().scalars().all()


async def update_webinar(
    db: AsyncSession,
    webinar_id: int,
    webinar_data: WebinarUpdate
) -> Optional[Webinar]:
    """Update webinar details"""
    webinar = await get_webinar_by_id(db, webinar_id)
    if not webinar:
        return None
    
    # Update fields if provided
    if webinar_data.title is not None:
        webinar.title = webinar_data.title
    if webinar_data.description is not None:
        webinar.description = webinar_data.description
    if webinar_data.meeting_link is not None:
        webinar.meeting_link = webinar_data.meeting_link
    if webinar_data.scheduled_date is not None:
        webinar.scheduled_date = webinar_data.scheduled_date
    if webinar_data.scheduled_time is not None:
        webinar.scheduled_time = webinar_data.scheduled_time
    
    webinar.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(webinar)
    
    logger.info(f"Updated webinar ID: {webinar_id}")
    return webinar


async def delete_webinar(db: AsyncSession, webinar_id: int) -> bool:
    """Delete a webinar (cascade deletes participants)"""
    webinar = await get_webinar_by_id(db, webinar_id)
    if not webinar:
        return False
    
    await db.delete(webinar)
    await db.commit()
    
    logger.info(f"Deleted webinar ID: {webinar_id}")
    return True


# ============ PARTICIPANT CRUD OPERATIONS ============

async def add_participants(
    db: AsyncSession,
    webinar_id: int,
    user_ids: Optional[List[int]] = None,
    unregistered_emails: Optional[List[str]] = None
) -> int:
    """Add participants to existing webinar"""
    count = 0
    
    # Add registered users
    if user_ids:
        for user_id in user_ids:
            # Check if already a participant
            result = await db.execute(
                select(WebinarParticipant)
                .where(
                    WebinarParticipant.webinar_id == webinar_id,
                    WebinarParticipant.user_id == user_id
                )
            )
            existing = result.scalar_one_or_none()
            
            if not existing:
                participant = WebinarParticipant(
                    webinar_id=webinar_id,
                    user_id=user_id
                )
                db.add(participant)
                count += 1
    
    # Add unregistered emails
    if unregistered_emails:
        for email in unregistered_emails:
            # Check if already a participant
            result = await db.execute(
                select(WebinarParticipant)
                .where(
                    WebinarParticipant.webinar_id == webinar_id,
                    WebinarParticipant.unregistered_email == email
                )
            )
            existing = result.scalar_one_or_none()
            
            if not existing:
                participant = WebinarParticipant(
                    webinar_id=webinar_id,
                    unregistered_email=email
                )
                db.add(participant)
                count += 1
    
    await db.commit()
    logger.info(f"Added {count} participants to webinar ID: {webinar_id}")
    
    return count


async def remove_participant(
    db: AsyncSession,
    webinar_id: int,
    participant_id: int
) -> bool:
    """Remove a participant from webinar"""
    result = await db.execute(
        select(WebinarParticipant)
        .where(
            WebinarParticipant.id == participant_id,
            WebinarParticipant.webinar_id == webinar_id
        )
    )
    participant = result.scalar_one_or_none()
    
    if not participant:
        return False
    
    await db.delete(participant)
    await db.commit()
    
    logger.info(f"Removed participant ID: {participant_id} from webinar ID: {webinar_id}")
    return True


async def mark_invitation_sent(
    db: AsyncSession,
    participant_id: int
) -> bool:
    """Mark participant invitation as sent"""
    result = await db.execute(
        select(WebinarParticipant)
        .where(WebinarParticipant.id == participant_id)
    )
    participant = result.scalar_one_or_none()
    
    if not participant:
        return False
    
    participant.invitation_sent = True
    participant.invitation_sent_at = datetime.utcnow()
    
    await db.commit()
    return True


async def get_all_registered_users(db: AsyncSession) -> List[User]:
    """Get all registered users for participant selection"""
    result = await db.execute(
        select(User)
        .where(User.is_active == True)
        .order_by(User.name)
    )
    return result.scalars().all()
