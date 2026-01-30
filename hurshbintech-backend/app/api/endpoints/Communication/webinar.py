"""
Webinar endpoints for Admin, Coach, and Head users
Manage webinars and send invitations to participants
"""

import logging
from typing import List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.crud.Communication import webinar_crud
from app.models.user_model import User, UserRole
from app.schemas.Communication.webinar import (
    WebinarCreate,
    WebinarUpdate,
    WebinarResponse,
    WebinarListResponse,
    ParticipantResponse,
    AddParticipantsRequest
)
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)

router = APIRouter()


# ============ HELPER FUNCTIONS ============

def check_webinar_access(user: User):
    """Check if user has access to webinar features (Admin, Coach, Head only)"""
    allowed_roles = [UserRole.ADMIN, UserRole.HEAD, UserRole.COACH]
    if user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Admin, Coach, and Head users can access webinar features"
        )


def check_webinar_ownership(webinar, user_id: int):
    """Check if user owns the webinar"""
    if webinar.created_by_user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only modify your own webinars"
        )


async def send_invitations_to_participants(db: AsyncSession, webinar, participants):
    """Helper to send invitation emails to all participants"""
    sent_count = 0
    
    for participant in participants:
        try:
            # Determine recipient email and name
            if participant.user_id:
                # Registered user
                recipient_email = participant.user.email if participant.user.email else None
                recipient_name = participant.user.name
            else:
                # Unregistered email
                recipient_email = participant.unregistered_email
                recipient_name = participant.unregistered_email.split('@')[0]
            
            if not recipient_email:
                logger.warning(f"No email for participant ID: {participant.id}")
                continue
            
            # Send invitation email
            success = await EmailService.send_webinar_invitation(
                recipient_email=recipient_email,
                recipient_name=recipient_name,
                webinar_title=webinar.title,
                webinar_description=webinar.description or "",
                scheduled_date=str(webinar.scheduled_date),
                scheduled_time=str(webinar.scheduled_time),
                meeting_link=webinar.meeting_link,
                host_name=webinar.created_by_user.name if webinar.created_by_user else "Unknown",
                host_role=webinar.created_by_user.role.value if webinar.created_by_user else "Unknown"
            )
            
            if success:
                # Mark invitation as sent
                await webinar_crud.mark_invitation_sent(db, participant.id)
                sent_count += 1
                logger.info(f"Sent webinar invitation to {recipient_email}")
            
        except Exception as e:
            logger.error(f"Failed to send invitation to participant {participant.id}: {str(e)}")
    
    return sent_count


# ============ WEBINAR ENDPOINTS ============

@router.post("/webinars", response_model=WebinarResponse, status_code=status.HTTP_201_CREATED)
async def create_webinar(
    webinar_data: WebinarCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new webinar (Admin, Coach, Head only)"""
    check_webinar_access(current_user)
    
    # Create webinar
    webinar = await webinar_crud.create_webinar(db, webinar_data, current_user.id)
    
    # Reload with all relationships
    webinar = await webinar_crud.get_webinar_by_id(db, webinar.id)
    
    # Send invitation emails
    if webinar.participants:
        sent_count = await send_invitations_to_participants(db, webinar, webinar.participants)
        logger.info(f"Sent {sent_count} invitation emails for webinar ID: {webinar.id}")
    
    # Build response
    return WebinarResponse(
        id=webinar.id,
        title=webinar.title,
        description=webinar.description,
        meeting_link=webinar.meeting_link,
        scheduled_date=webinar.scheduled_date,
        scheduled_time=webinar.scheduled_time,
        created_by_user_id=webinar.created_by_user_id,
        created_by_name=webinar.created_by_user.name if webinar.created_by_user else None,
        created_by_role=webinar.created_by_user.role.value if webinar.created_by_user else None,
        created_at=webinar.created_at,
        updated_at=webinar.updated_at,
        participants=[
            ParticipantResponse(
                id=p.id,
                user_id=p.user_id,
                user_name=p.user.name if p.user else None,
                user_email=p.user.email if p.user else None,
                unregistered_email=p.unregistered_email,
                invitation_sent=p.invitation_sent,
                invitation_sent_at=p.invitation_sent_at,
                invited_at=p.invited_at
            )
            for p in webinar.participants
        ],
        participant_count=len(webinar.participants)
    )


@router.get("/webinars", response_model=List[WebinarListResponse])
async def get_all_webinars(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all webinars (accessible to all authenticated users)"""
    webinars = await webinar_crud.get_all_webinars(db, skip, limit)
    
    return [
        WebinarListResponse(
            id=w.id,
            title=w.title,
            description=w.description,
            meeting_link=w.meeting_link,
            scheduled_date=w.scheduled_date,
            scheduled_time=w.scheduled_time,
            created_by_user_id=w.created_by_user_id,
            created_by_name=w.created_by_user.name if w.created_by_user else None,
            created_by_role=w.created_by_user.role.value if w.created_by_user else None,
            created_at=w.created_at,
            participant_count=len(w.participants)
        )
        for w in webinars
    ]


@router.get("/webinars/my-webinars", response_model=List[WebinarListResponse])
async def get_my_webinars(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get webinars created by current user"""
    check_webinar_access(current_user)
    
    webinars = await webinar_crud.get_webinars_by_creator(db, current_user.id, skip, limit)
    
    return [
        WebinarListResponse(
            id=w.id,
            title=w.title,
            description=w.description,
            meeting_link=w.meeting_link,
            scheduled_date=w.scheduled_date,
            scheduled_time=w.scheduled_time,
            created_by_user_id=w.created_by_user_id,
            created_by_name=w.created_by_user.name if w.created_by_user else None,
            created_by_role=w.created_by_user.role.value if w.created_by_user else None,
            created_at=w.created_at,
            participant_count=len(w.participants)
        )
        for w in webinars
    ]


@router.get("/webinars/{webinar_id}", response_model=WebinarResponse)
async def get_webinar(
    webinar_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get webinar details by ID"""
    webinar = await webinar_crud.get_webinar_by_id(db, webinar_id)
    
    if not webinar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webinar not found"
        )
    
    return WebinarResponse(
        id=webinar.id,
        title=webinar.title,
        description=webinar.description,
        meeting_link=webinar.meeting_link,
        scheduled_date=webinar.scheduled_date,
        scheduled_time=webinar.scheduled_time,
        created_by_user_id=webinar.created_by_user_id,
        created_by_name=webinar.created_by_user.name if webinar.created_by_user else None,
        created_by_role=webinar.created_by_user.role.value if webinar.created_by_user else None,
        created_at=webinar.created_at,
        updated_at=webinar.updated_at,
        participants=[
            ParticipantResponse(
                id=p.id,
                user_id=p.user_id,
                user_name=p.user.name if p.user else None,
                user_email=p.user.email if p.user else None,
                unregistered_email=p.unregistered_email,
                invitation_sent=p.invitation_sent,
                invitation_sent_at=p.invitation_sent_at,
                invited_at=p.invited_at
            )
            for p in webinar.participants
        ],
        participant_count=len(webinar.participants)
    )


@router.patch("/webinars/{webinar_id}", response_model=WebinarResponse)
async def update_webinar(
    webinar_id: int,
    webinar_data: WebinarUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update webinar details (only owner can update)"""
    check_webinar_access(current_user)
    
    # Check if webinar exists
    webinar = await webinar_crud.get_webinar_by_id(db, webinar_id)
    if not webinar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webinar not found"
        )
    
    # Check ownership
    check_webinar_ownership(webinar, current_user.id)
    
    # Update webinar
    updated_webinar = await webinar_crud.update_webinar(db, webinar_id, webinar_data)
    
    return WebinarResponse(
        id=updated_webinar.id,
        title=updated_webinar.title,
        description=updated_webinar.description,
        meeting_link=updated_webinar.meeting_link,
        scheduled_date=updated_webinar.scheduled_date,
        scheduled_time=updated_webinar.scheduled_time,
        created_by_user_id=updated_webinar.created_by_user_id,
        created_by_name=updated_webinar.created_by_user.name if updated_webinar.created_by_user else None,
        created_by_role=updated_webinar.created_by_user.role.value if updated_webinar.created_by_user else None,
        created_at=updated_webinar.created_at,
        updated_at=updated_webinar.updated_at,
        participants=[
            ParticipantResponse(
                id=p.id,
                user_id=p.user_id,
                user_name=p.user.name if p.user else None,
                user_email=p.user.email if p.user else None,
                unregistered_email=p.unregistered_email,
                invitation_sent=p.invitation_sent,
                invitation_sent_at=p.invitation_sent_at,
                invited_at=p.invited_at
            )
            for p in updated_webinar.participants
        ],
        participant_count=len(updated_webinar.participants)
    )


@router.delete("/webinars/{webinar_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_webinar(
    webinar_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a webinar (only owner can delete)"""
    check_webinar_access(current_user)
    
    # Check if webinar exists
    webinar = await webinar_crud.get_webinar_by_id(db, webinar_id)
    if not webinar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webinar not found"
        )
    
    # Check ownership
    check_webinar_ownership(webinar, current_user.id)
    
    # Delete webinar
    await webinar_crud.delete_webinar(db, webinar_id)


@router.post("/webinars/{webinar_id}/resend-invitations", status_code=status.HTTP_200_OK)
async def resend_invitations(
    webinar_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Resend invitation emails to all participants"""
    check_webinar_access(current_user)
    
    # Get webinar
    webinar = await webinar_crud.get_webinar_by_id(db, webinar_id)
    if not webinar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Webinar not found"
        )
    
    # Check ownership
    check_webinar_ownership(webinar, current_user.id)
    
    # Send invitations
    sent_count = await send_invitations_to_participants(db, webinar, webinar.participants)
    
    return {
        "message": f"Resent invitations to {sent_count} participants",
        "sent_count": sent_count,
        "total_participants": len(webinar.participants)
    }


@router.get("/webinars/users/registered", status_code=status.HTTP_200_OK)
async def get_registered_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all registered users for participant selection"""
    check_webinar_access(current_user)
    
    users = await webinar_crud.get_all_registered_users(db)
    
    return [
        {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role.value
        }
        for user in users
    ]
