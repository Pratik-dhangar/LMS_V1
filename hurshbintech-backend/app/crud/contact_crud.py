"""CRUD operations for Contact Us Submissions
"""
from typing import List, Optional
from sqlalchemy import select, func, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact_model import Contact, ContactStatus
from app.schemas.contact import ContactCreate, ContactUpdate


class ContactCRUD:
    async def create_contact(self, db: AsyncSession, contact: ContactCreate) -> Contact:
        """Create a new contact submission"""
        db_contact = Contact(
            parent_name=contact.parent_name,
            email=contact.email,
            phone=contact.phone,
            message=contact.message,
            status=ContactStatus.new,
        )
        db.add(db_contact)
        await db.commit()
        await db.refresh(db_contact)
        return db_contact

    async def get_contact(self, db: AsyncSession, contact_id: int) -> Optional[Contact]:
        """Get contact by ID"""
        result = await db.execute(
            select(Contact).filter(Contact.id == contact_id)
        )
        return result.scalar_one_or_none()

    async def get_contacts(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 10,
        status_filter: Optional[str] = None,
        search: Optional[str] = None,
        unresolved_only: bool = False
    ) -> tuple[List[Contact], int]:
        """Get contacts with pagination, filtering, and search"""
        query = select(Contact)
        
        # Apply status filter
        if status_filter:
            query = query.filter(Contact.status == ContactStatus(status_filter))
        
        # Filter unresolved contacts
        if unresolved_only:
            query = query.filter(Contact.is_resolved == False)
        
        # Apply search filter (search by name, email, message)
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Contact.parent_name.ilike(search_term),
                    Contact.email.ilike(search_term),
                    Contact.message.ilike(search_term)
                )
            )
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination and ordering (most recent first)
        query = query.order_by(Contact.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        contacts = result.scalars().all()
        
        return contacts, total

    async def update_contact(
        self,
        db: AsyncSession,
        contact_id: int,
        contact_update: ContactUpdate
    ) -> Optional[Contact]:
        """Update a contact submission"""
        db_contact = await self.get_contact(db, contact_id)
        if not db_contact:
            return None
        
        update_data = contact_update.model_dump(exclude_unset=True)
        
        # Convert status string to enum if provided
        if "status" in update_data and update_data["status"]:
            update_data["status"] = ContactStatus(update_data["status"])
        
        for field, value in update_data.items():
            setattr(db_contact, field, value)
        
        await db.commit()
        await db.refresh(db_contact)
        return db_contact

    async def mark_as_read(self, db: AsyncSession, contact_id: int) -> Optional[Contact]:
        """Mark contact as read"""
        db_contact = await self.get_contact(db, contact_id)
        if db_contact:
            db_contact.status = ContactStatus.read
            await db.commit()
            await db.refresh(db_contact)
        return db_contact

    async def get_stats(self, db: AsyncSession) -> dict:
        """Get contact statistics"""
        total = await db.execute(select(func.count(Contact.id)))
        total_count = total.scalar() or 0
        
        new = await db.execute(
            select(func.count(Contact.id)).filter(Contact.status == ContactStatus.new)
        )
        new_count = new.scalar() or 0
        
        read = await db.execute(
            select(func.count(Contact.id)).filter(Contact.status == ContactStatus.read)
        )
        read_count = read.scalar() or 0
        
        replied = await db.execute(
            select(func.count(Contact.id)).filter(Contact.status == ContactStatus.replied)
        )
        replied_count = replied.scalar() or 0
        
        archived = await db.execute(
            select(func.count(Contact.id)).filter(Contact.status == ContactStatus.archived)
        )
        archived_count = archived.scalar() or 0
        
        unresolved = await db.execute(
            select(func.count(Contact.id)).filter(Contact.is_resolved == False)
        )
        unresolved_count = unresolved.scalar() or 0
        
        return {
            "total_contacts": total_count,
            "new_contacts": new_count,
            "read_contacts": read_count,
            "replied_contacts": replied_count,
            "archived_contacts": archived_count,
            "unresolved_contacts": unresolved_count,
        }

    async def delete_contact(self, db: AsyncSession, contact_id: int) -> bool:
        """Delete a contact submission"""
        result = await db.execute(
            delete(Contact).filter(Contact.id == contact_id)
        )
        await db.commit()
        return result.rowcount > 0


# Create singleton instance
contact_crud = ContactCRUD()
