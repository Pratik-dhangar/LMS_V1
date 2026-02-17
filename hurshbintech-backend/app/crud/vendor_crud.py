"""
CRUD operations for Vendor Management
"""

import logging
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vendor_model import Vendor
from app.schemas.vendor import VendorCreate, VendorUpdate

logger = logging.getLogger(__name__)


# ============ CREATE VENDOR ============
async def create_vendor(
    db: AsyncSession,
    admin_id: int,
    vendor_data: VendorCreate
) -> Vendor:
    """Create a new vendor"""
    
    # Check if email already exists
    existing_vendor = await db.execute(
        select(Vendor).where(Vendor.email == vendor_data.email)
    )
    if existing_vendor.scalar_one_or_none():
        raise ValueError(f"Vendor with email {vendor_data.email} already exists")
    
    # Check if contact number already exists
    existing_vendor = await db.execute(
        select(Vendor).where(Vendor.contact_number == vendor_data.contact_number)
    )
    if existing_vendor.scalar_one_or_none():
        raise ValueError(f"Vendor with contact number {vendor_data.contact_number} already exists")
    
    vendor = Vendor(
        admin_id=admin_id,
        name=vendor_data.name,
        email=vendor_data.email,
        contact_number=vendor_data.contact_number,
        address=vendor_data.address,
        city=vendor_data.city,
        state=vendor_data.state,
        country=vendor_data.country,
        postal_code=vendor_data.postal_code,
        company_name=vendor_data.company_name,
        website=vendor_data.website,
        tax_id=vendor_data.tax_id,
        is_active=True
    )
    
    db.add(vendor)
    await db.commit()
    await db.refresh(vendor)
    
    logger.info(f"Vendor created: {vendor.id} by admin {admin_id}")
    return vendor


# ============ GET VENDOR ============
async def get_vendor(
    db: AsyncSession,
    vendor_id: int
) -> Optional[Vendor]:
    """Get a vendor by ID"""
    
    result = await db.execute(
        select(Vendor).where(Vendor.id == vendor_id)
    )
    return result.scalar_one_or_none()


async def get_vendor_by_email(
    db: AsyncSession,
    email: str
) -> Optional[Vendor]:
    """Get a vendor by email"""
    
    result = await db.execute(
        select(Vendor).where(Vendor.email == email)
    )
    return result.scalar_one_or_none()


async def get_vendor_by_contact(
    db: AsyncSession,
    contact_number: str
) -> Optional[Vendor]:
    """Get a vendor by contact number"""
    
    result = await db.execute(
        select(Vendor).where(Vendor.contact_number == contact_number)
    )
    return result.scalar_one_or_none()


# ============ LIST VENDORS ============
async def get_vendors_by_admin(
    db: AsyncSession,
    admin_id: int,
    skip: int = 0,
    limit: int = 100,
    active_only: bool = False
) -> List[Vendor]:
    """Get all vendors for a specific admin"""
    
    query = select(Vendor).where(Vendor.admin_id == admin_id)
    
    if active_only:
        query = query.where(Vendor.is_active == True)
    
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()


async def get_vendors_count(
    db: AsyncSession,
    admin_id: int,
    active_only: bool = False
) -> int:
    """Get total count of vendors for a specific admin"""
    
    query = select(Vendor).where(Vendor.admin_id == admin_id)
    
    if active_only:
        query = query.where(Vendor.is_active == True)
    
    result = await db.execute(query)
    return len(result.scalars().all())


# ============ UPDATE VENDOR ============
async def update_vendor(
    db: AsyncSession,
    vendor_id: int,
    vendor_data: VendorUpdate
) -> Optional[Vendor]:
    """Update a vendor"""
    
    vendor = await get_vendor(db, vendor_id)
    if not vendor:
        return None
    
    # Check if new email already exists (if being changed)
    if vendor_data.email and vendor_data.email != vendor.email:
        existing = await get_vendor_by_email(db, vendor_data.email)
        if existing:
            raise ValueError(f"Vendor with email {vendor_data.email} already exists")
    
    # Check if new contact number already exists (if being changed)
    if vendor_data.contact_number and vendor_data.contact_number != vendor.contact_number:
        existing = await get_vendor_by_contact(db, vendor_data.contact_number)
        if existing:
            raise ValueError(f"Vendor with contact number {vendor_data.contact_number} already exists")
    
    # Update fields
    update_data = vendor_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(vendor, field, value)
    
    await db.commit()
    await db.refresh(vendor)
    
    logger.info(f"Vendor updated: {vendor.id}")
    return vendor


# ============ DELETE VENDOR ============
async def delete_vendor(
    db: AsyncSession,
    vendor_id: int
) -> bool:
    """Delete a vendor (soft delete - mark as inactive)"""
    
    vendor = await get_vendor(db, vendor_id)
    if not vendor:
        return False
    
    vendor.is_active = False
    await db.commit()
    
    logger.info(f"Vendor deleted (marked inactive): {vendor.id}")
    return True


async def hard_delete_vendor(
    db: AsyncSession,
    vendor_id: int
) -> bool:
    """Permanently delete a vendor"""
    
    vendor = await get_vendor(db, vendor_id)
    if not vendor:
        return False
    
    await db.delete(vendor)
    await db.commit()
    
    logger.info(f"Vendor permanently deleted: {vendor_id}")
    return True


# ============ TOGGLE VENDOR STATUS ============
async def toggle_vendor_status(
    db: AsyncSession,
    vendor_id: int
) -> Optional[Vendor]:
    """Toggle vendor active/inactive status"""
    
    vendor = await get_vendor(db, vendor_id)
    if not vendor:
        return None
    
    vendor.is_active = not vendor.is_active
    await db.commit()
    await db.refresh(vendor)
    
    status_str = "activated" if vendor.is_active else "deactivated"
    logger.info(f"Vendor {status_str}: {vendor.id}")
    return vendor
