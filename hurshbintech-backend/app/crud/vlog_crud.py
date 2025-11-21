from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.vlog_model import Vlog
from app.schemas.vlog import VlogCreate, VlogUpdate
from typing import List, Optional
import os

class VlogCRUD:
    async def create_vlog(self, db: AsyncSession, vlog: VlogCreate) -> Vlog:
        db_vlog = Vlog(
            title=vlog.title,
            description=vlog.description,
            file_url=vlog.file_url,
            file_size=vlog.file_size,
            thumbnail_url=vlog.thumbnail_url
        )
        db.add(db_vlog)
        await db.commit()
        await db.refresh(db_vlog)
        return db_vlog

    async def get_vlog(self, db: AsyncSession, vlog_id: int) -> Optional[Vlog]:
        result = await db.execute(select(Vlog).filter(Vlog.id == vlog_id))
        return result.scalar_one_or_none()

    async def get_vlogs(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Vlog]:
        stmt = select(Vlog).offset(skip).limit(limit)
        result = await db.execute(stmt)
        vlogs = result.scalars().all()
        return list(vlogs)

    async def update_vlog(self, db: AsyncSession, vlog_id: int, vlog: VlogUpdate) -> Optional[Vlog]:
        db_vlog = await self.get_vlog(db, vlog_id)
        if not db_vlog:
            return None

        update_data = vlog.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_vlog, key, value)

        await db.commit()
        await db.refresh(db_vlog)
        return db_vlog

    async def delete_vlog(self, db: AsyncSession, vlog_id: int) -> bool:
        db_vlog = await self.get_vlog(db, vlog_id)
        if not db_vlog:
            return False

        # Get the base directory (backend root)
        from pathlib import Path
        base_dir = Path(__file__).parent.parent.parent
        
        # Convert URL paths to file system paths and delete files
        if db_vlog.file_url:
            # Remove leading slash and normalize path separators
            clean_path = db_vlog.file_url.lstrip('/').replace('\\', '/')
            file_path = base_dir / clean_path
            print(f"Attempting to delete video file: {file_path}")
            if file_path.exists():
                file_path.unlink()
                print(f"Deleted video file: {file_path}")
            else:
                print(f"Video file not found: {file_path}")

        if db_vlog.thumbnail_url:
            # Remove leading slash and normalize path separators
            clean_path = db_vlog.thumbnail_url.lstrip('/').replace('\\', '/')
            thumbnail_path = base_dir / clean_path
            print(f"Attempting to delete thumbnail file: {thumbnail_path}")
            if thumbnail_path.exists():
                thumbnail_path.unlink()
                print(f"Deleted thumbnail file: {thumbnail_path}")
            else:
                print(f"Thumbnail file not found: {thumbnail_path}")

        await db.delete(db_vlog)
        await db.commit()
        print(f"Deleted vlog {vlog_id} from database")
        return True