"""CRUD operations for About Us Page
"""
from typing import Optional
from sqlalchemy import select, update, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.about_us_model import AboutUs, AboutUsStatus
from app.schemas.about_us import AboutUsCreate, AboutUsUpdate


class AboutUsCRUD:
    async def create_about_us(
        self, db: AsyncSession, about_us: AboutUsCreate, author_id: int
    ) -> AboutUs:
        """Create a new About Us record"""
        # Deactivate any previous active records for this language
        await self._deactivate_previous_versions(db, about_us.language_code)
        
        # Get next version number
        version_number = await self._get_next_version(db, about_us.language_code)
        
        db_about_us = AboutUs(
            version_number=version_number,
            language_code=about_us.language_code,
            is_active=about_us.is_active,
            featured_image_url=about_us.featured_image_url,
            hero_title=about_us.hero_title,
            hero_subtitle=about_us.hero_subtitle,
            intro_title=about_us.intro_title,
            intro_content=about_us.intro_content,
            mission_title=about_us.mission_title,
            mission_content=about_us.mission_content,
            vision_title=about_us.vision_title,
            vision_content=about_us.vision_content,
            programs_title=about_us.programs_title,
            programs_content=about_us.programs_content,
            methodology_title=about_us.methodology_title,
            methodology_content=about_us.methodology_content,
            why_us_title=about_us.why_us_title,
            why_us_content=about_us.why_us_content,
            team_title=about_us.team_title,
            team_content=about_us.team_content,
            learner_focus_title=about_us.learner_focus_title,
            learner_focus_content=about_us.learner_focus_content,
            values_title=about_us.values_title,
            values_content=about_us.values_content,
            commitment_title=about_us.commitment_title,
            commitment_content=about_us.commitment_content,
            author_id=author_id,
            status=AboutUsStatus(about_us.status),
        )
        db.add(db_about_us)
        await db.commit()
        await db.refresh(db_about_us)
        
        # Load author relationship
        await db.refresh(db_about_us, ["author"])
        return db_about_us

    async def get_active_about_us(
        self, db: AsyncSession, language_code: str = "en"
    ) -> Optional[AboutUs]:
        """Get the active About Us record for a language"""
        result = await db.execute(
            select(AboutUs)
            .options(selectinload(AboutUs.author))
            .filter(
                and_(
                    AboutUs.is_active == True,
                    AboutUs.language_code == language_code
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_published_about_us(
        self, db: AsyncSession, language_code: str = "en"
    ) -> Optional[AboutUs]:
        """Get the active and published About Us record"""
        result = await db.execute(
            select(AboutUs)
            .options(selectinload(AboutUs.author))
            .filter(
                and_(
                    AboutUs.is_active == True,
                    AboutUs.language_code == language_code,
                    AboutUs.status == AboutUsStatus.PUBLISHED
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_latest_about_us(
        self, db: AsyncSession, language_code: str = "en"
    ) -> Optional[AboutUs]:
        """Get the latest About Us record (for admin editing - regardless of active status)"""
        result = await db.execute(
            select(AboutUs)
            .options(selectinload(AboutUs.author))
            .filter(AboutUs.language_code == language_code)
            .order_by(AboutUs.version_number.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_about_us_by_id(self, db: AsyncSession, about_us_id: int) -> Optional[AboutUs]:
        """Get About Us by ID"""
        result = await db.execute(
            select(AboutUs)
            .options(selectinload(AboutUs.author))
            .filter(AboutUs.id == about_us_id)
        )
        return result.scalar_one_or_none()

    async def update_about_us(
        self, db: AsyncSession, about_us_id: int, about_us: AboutUsUpdate
    ) -> Optional[AboutUs]:
        """Update an About Us record"""
        db_about_us = await self.get_about_us_by_id(db, about_us_id)
        if not db_about_us:
            return None

        update_data = about_us.dict(exclude_unset=True)
        
        # Convert status string to enum if present
        if "status" in update_data:
            update_data["status"] = AboutUsStatus(update_data["status"])
        
        # If is_active is being set to True, deactivate other versions
        if update_data.get("is_active") == True:
            await self._deactivate_previous_versions(
                db, db_about_us.language_code, exclude_id=about_us_id
            )
        
        for key, value in update_data.items():
            setattr(db_about_us, key, value)

        await db.commit()
        await db.refresh(db_about_us)
        await db.refresh(db_about_us, ["author"])
        return db_about_us

    async def delete_about_us(self, db: AsyncSession, about_us_id: int) -> bool:
        """Soft delete an About Us record by deactivating it"""
        db_about_us = await self.get_about_us_by_id(db, about_us_id)
        if not db_about_us:
            return False
        
        db_about_us.is_active = False
        await db.commit()
        return True

    async def _deactivate_previous_versions(
        self, db: AsyncSession, language_code: str, exclude_id: Optional[int] = None
    ):
        """Deactivate all active versions for a language"""
        stmt = (
            update(AboutUs)
            .where(
                and_(
                    AboutUs.language_code == language_code,
                    AboutUs.is_active == True
                )
            )
            .values(is_active=False)
        )
        
        if exclude_id is not None:
            stmt = stmt.where(AboutUs.id != exclude_id)
        
        await db.execute(stmt)
        await db.commit()

    async def _get_next_version(self, db: AsyncSession, language_code: str) -> int:
        """Get the next version number for a language"""
        result = await db.execute(
            select(AboutUs.version_number)
            .filter(AboutUs.language_code == language_code)
            .order_by(AboutUs.version_number.desc())
            .limit(1)
        )
        max_version = result.scalar_one_or_none()
        return (max_version or 0) + 1


# Singleton instance
about_us_crud = AboutUsCRUD()
