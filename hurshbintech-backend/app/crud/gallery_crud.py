from typing import List, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gallery_model import Gallery
from app.schemas.gallery import GalleryCreate, GalleryUpdate


class GalleryCRUD:
    async def create_gallery(self, db: AsyncSession, gallery: GalleryCreate) -> Gallery:
        db_gallery = Gallery(
            photo_url=gallery.photo_url,
            photo_size=gallery.photo_size,
            thumbnail_url=gallery.thumbnail_url,
            video_url=gallery.video_url,
            video_size=gallery.video_size,
            video_thumbnail_url=gallery.video_thumbnail_url,
            status=gallery.status or "draft",
        )
        db.add(db_gallery)
        await db.commit()
        await db.refresh(db_gallery)
        return db_gallery

    async def get_gallery(self, db: AsyncSession, gallery_id: int) -> Optional[Gallery]:
        result = await db.execute(select(Gallery).filter(Gallery.id == gallery_id))
        return result.scalar_one_or_none()

    async def get_galleries(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Gallery]:
        stmt = select(Gallery).offset(skip).limit(limit)
        result = await db.execute(stmt)
        galleries = result.scalars().all()
        return list(galleries)

    async def count_galleries(self, db: AsyncSession, status_filter: Optional[str] = None) -> int:
        stmt = select(func.count(Gallery.id))
        if status_filter:
            stmt = stmt.filter(Gallery.status == status_filter)
        result = await db.execute(stmt)
        return result.scalar() or 0

    async def update_gallery(
        self, db: AsyncSession, gallery_id: int, gallery: GalleryUpdate
    ) -> Optional[Gallery]:
        db_gallery = await self.get_gallery(db, gallery_id)
        if not db_gallery:
            return None

        update_data = gallery.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_gallery, key, value)

        await db.commit()
        await db.refresh(db_gallery)
        return db_gallery

    async def delete_gallery(self, db: AsyncSession, gallery_id: int) -> bool:
        db_gallery = await self.get_gallery(db, gallery_id)
        if not db_gallery:
            return False

        # Get the base directory (backend root)
        from pathlib import Path

        base_dir = Path(__file__).parent.parent.parent

        # Convert URL paths to file system paths and delete files
        if db_gallery.photo_url:
            # Remove leading slash and normalize path separators
            clean_path = db_gallery.photo_url.lstrip("/").replace("\\", "/")
            file_path = base_dir / clean_path
            if file_path.exists():
                file_path.unlink()

        if db_gallery.thumbnail_url:
            # Remove leading slash and normalize path separators
            clean_path = db_gallery.thumbnail_url.lstrip("/").replace("\\", "/")
            thumbnail_path = base_dir / clean_path
            if thumbnail_path.exists():
                thumbnail_path.unlink()

        if db_gallery.video_url:
            # Remove leading slash and normalize path separators
            clean_path = db_gallery.video_url.lstrip("/").replace("\\", "/")
            file_path = base_dir / clean_path
            if file_path.exists():
                file_path.unlink()

        if db_gallery.video_thumbnail_url:
            # Remove leading slash and normalize path separators
            clean_path = db_gallery.video_thumbnail_url.lstrip("/").replace("\\", "/")
            thumbnail_path = base_dir / clean_path
            if thumbnail_path.exists():
                thumbnail_path.unlink()

        await db.delete(db_gallery)
        await db.commit()
        return True
