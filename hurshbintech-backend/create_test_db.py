"""
Script to create the test database for running pytest.
Run this before running tests for the first time.
"""

import asyncio
import asyncpg
from app.core.config import settings


async def create_test_database():
    """Create the test database if it doesn't exist."""
    # Connect to default postgres database
    conn = await asyncpg.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database="postgres",  # Connect to default database
    )

    try:
        # Check if test database exists
        db_exists = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", "hurshbintech_pwa_test"
        )

        if not db_exists:
            print("Creating test database 'hurshbintech_pwa_test'...")
            await conn.execute("CREATE DATABASE hurshbintech_pwa_test")
            print("✅ Test database created successfully!")
        else:
            print("✅ Test database already exists")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(create_test_database())
