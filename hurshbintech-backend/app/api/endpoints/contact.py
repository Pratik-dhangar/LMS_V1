"""
Contact Us API endpoints - Public submission and Admin management
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_admin, get_db, get_current_user
from app.crud.contact_crud import contact_crud
from app.models.user_model import User, UserRole
from app.schemas.contact import (
    ContactCreate,
    ContactResponse,
    ContactUpdate,
    ContactListResponse,
    ContactStatsResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== PUBLIC ROUTES ==============

@router.post("/contacts", response_model=ContactResponse, status_code=status.HTTP_201_CREATED, tags=["Contact Us"])
async def submit_contact(
    contact_data: ContactCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint to submit a contact form
    
    **Parameters:**
    - parent_name: Name of the person submitting the form
    - email: Email address (will be validated)
    - phone: Optional phone number
    - message: The contact message (min 5 chars, max 5000)
    
    **Returns:**
    - ContactResponse with submission details
    """
    try:
        # Create the contact submission
        new_contact = await contact_crud.create_contact(db, contact_data)
        
        logger.info(f"New contact submission from {contact_data.parent_name} ({contact_data.email})")
        
        return new_contact
    
    except Exception as e:
        logger.error(f"Error submitting contact: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit contact form"
        )


# ============== ADMIN ROUTES ==============

@router.get("/admin/contacts", response_model=ContactListResponse, tags=["Admin - Contact Management"])
async def get_admin_contacts(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by status: new, read, replied, archived"),
    search: Optional[str] = Query(None, description="Search by name, email, or message"),
    unresolved_only: bool = Query(False, description="Show only unresolved contacts"),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Get all contact submissions with pagination and filtering (Admin only)
    
    **Filters:**
    - status: Filter by submission status
    - search: Search by parent name, email, or message content
    - unresolved_only: Show only contacts that haven't been resolved
    
    **Returns:**
    - Paginated list of contacts with total count
    """
    try:
        contacts, total = await contact_crud.get_contacts(
            db,
            skip=skip,
            limit=limit,
            status_filter=status,
            search=search,
            unresolved_only=unresolved_only
        )
        
        return ContactListResponse(
            data=contacts,
            total=total,
            skip=skip,
            limit=limit
        )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid filter value: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error fetching contacts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch contacts"
        )


@router.get("/admin/contacts/stats", response_model=ContactStatsResponse, tags=["Admin - Contact Management"])
async def get_contact_stats(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Get contact submission statistics (Admin only)
    
    **Returns:**
    - Statistics including total, new, read, replied, archived, and unresolved counts
    """
    try:
        stats = await contact_crud.get_stats(db)
        return ContactStatsResponse(**stats)
    
    except Exception as e:
        logger.error(f"Error fetching contact stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch contact statistics"
        )


@router.get("/admin/contacts/{contact_id}", response_model=ContactResponse, tags=["Admin - Contact Management"])
async def get_contact_detail(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Get a specific contact submission (Admin only)
    
    **Parameters:**
    - contact_id: The ID of the contact to retrieve
    
    **Returns:**
    - ContactResponse with full details
    """
    try:
        contact = await contact_crud.get_contact(db, contact_id)
        
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Contact with ID {contact_id} not found"
            )
        
        # Mark as read if it was new
        if contact.status.value == "new":
            contact = await contact_crud.mark_as_read(db, contact_id)
        
        return contact
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching contact detail: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch contact details"
        )


@router.patch("/admin/contacts/{contact_id}", response_model=ContactResponse, tags=["Admin - Contact Management"])
async def update_contact(
    contact_id: int,
    contact_update: ContactUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Update a contact submission with admin notes and status (Admin only)
    
    **Parameters:**
    - contact_id: The ID of the contact to update
    - status: New status (new, read, replied, archived)
    - admin_notes: Notes from admin
    - is_resolved: Whether the contact has been resolved
    
    **Returns:**
    - Updated ContactResponse
    """
    try:
        contact = await contact_crud.get_contact(db, contact_id)
        
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Contact with ID {contact_id} not found"
            )
        
        # Validate status if provided
        if contact_update.status:
            valid_statuses = ["new", "read", "replied", "archived"]
            if contact_update.status not in valid_statuses:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
                )
        
        updated_contact = await contact_crud.update_contact(
            db, contact_id, contact_update
        )
        
        logger.info(f"Contact {contact_id} updated by admin {current_admin.id}")
        
        return updated_contact
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating contact: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update contact"
        )


@router.delete("/admin/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Admin - Contact Management"])
async def delete_contact(
    contact_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """
    Delete a contact submission (Admin only)
    
    **Parameters:**
    - contact_id: The ID of the contact to delete
    
    **Returns:**
    - 204 No Content on success
    """
    try:
        contact = await contact_crud.get_contact(db, contact_id)
        
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Contact with ID {contact_id} not found"
            )
        
        deleted = await contact_crud.delete_contact(db, contact_id)
        
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete contact"
            )
        
        logger.info(f"Contact {contact_id} deleted by admin {current_admin.id}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting contact: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete contact"
        )
