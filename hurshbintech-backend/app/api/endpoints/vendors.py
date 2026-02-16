"""
Vendor Management endpoints - Admin operations for managing vendors
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.core.deps import get_current_admin
from app.crud import vendor_crud
from app.db.session import get_db
from app.models.user_model import User
from app.schemas.vendor import (
    VendorCreate,
    VendorUpdate,
    VendorResponse,
    VendorListResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/vendors", tags=["Vendor Management"])


# ============ CREATE VENDOR ============
@router.post("", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    vendor_data: VendorCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Create a new vendor"""
    
    try:
        vendor = await vendor_crud.create_vendor(
            db=db,
            admin_id=current_admin.id,
            vendor_data=vendor_data
        )
        return vendor
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating vendor: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create vendor"
        )


# ============ GET VENDOR BY ID ============
@router.get("/{vendor_id}", response_model=VendorResponse)
async def get_vendor(
    vendor_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get vendor details by ID"""
    
    vendor = await vendor_crud.get_vendor(db, vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    # Verify vendor belongs to current admin
    if vendor.admin_id != current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this vendor"
        )
    
    return vendor


# ============ LIST ALL VENDORS FOR ADMIN ============
@router.get("", response_model=List[VendorListResponse])
async def list_vendors(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get all vendors for the current admin"""
    
    try:
        vendors = await vendor_crud.get_vendors_by_admin(
            db=db,
            admin_id=current_admin.id,
            skip=skip,
            limit=limit,
            active_only=active_only
        )
        return vendors
    except Exception as e:
        logger.error(f"Error listing vendors: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve vendors"
        )


# ============ UPDATE VENDOR ============
@router.put("/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: int,
    vendor_data: VendorUpdate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Update vendor information"""
    
    # Verify vendor belongs to current admin
    vendor = await vendor_crud.get_vendor(db, vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    if vendor.admin_id != current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this vendor"
        )
    
    try:
        updated_vendor = await vendor_crud.update_vendor(
            db=db,
            vendor_id=vendor_id,
            vendor_data=vendor_data
        )
        return updated_vendor
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error updating vendor: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update vendor"
        )


# ============ DELETE VENDOR ============
@router.delete("/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vendor(
    vendor_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Delete (deactivate) a vendor"""
    
    # Verify vendor belongs to current admin
    vendor = await vendor_crud.get_vendor(db, vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    if vendor.admin_id != current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this vendor"
        )
    
    try:
        success = await vendor_crud.delete_vendor(db, vendor_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vendor not found"
            )
    except Exception as e:
        logger.error(f"Error deleting vendor: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete vendor"
        )


# ============ TOGGLE VENDOR STATUS ============
@router.patch("/{vendor_id}/toggle-status", response_model=VendorResponse)
async def toggle_vendor_status(
    vendor_id: int,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Toggle vendor active/inactive status"""
    
    # Verify vendor belongs to current admin
    vendor = await vendor_crud.get_vendor(db, vendor_id)
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found"
        )
    
    if vendor.admin_id != current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this vendor"
        )
    
    try:
        updated_vendor = await vendor_crud.toggle_vendor_status(db, vendor_id)
        return updated_vendor
    except Exception as e:
        logger.error(f"Error toggling vendor status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to toggle vendor status"
        )


# ============ GET VENDOR COUNT ============
@router.get("/count/total", response_model=dict)
async def get_vendor_count(
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Get total count of vendors for the current admin"""
    
    try:
        count = await vendor_crud.get_vendors_count(
            db=db,
            admin_id=current_admin.id,
            active_only=active_only
        )
        return {"count": count}
    except Exception as e:
        logger.error(f"Error getting vendor count: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve vendor count"
        )
