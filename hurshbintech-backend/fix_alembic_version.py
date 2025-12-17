"""fix alembic version

Just run: python -m alembic stamp -sql dfbd0171d916 > temp.sql
Then manually execute: UPDATE alembic_version SET version_num = 'dfbd0171d916';
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

async def fix_version():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        await conn.execute("UPDATE alembic_version SET version_num = 'dfbd0171d916'")
    print("✓ Fixed alembic version to dfbd0171d916")
    await engine.dispose()

asyncio.run(fix_version())
