import asyncio
import logging
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.core.security import hash_password, encrypt_passcode
from app.models.user_model import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

NEW_EMAIL = "hurshbin@gmail.com"
RAW_PASSWORD = "123456"


async def create_new_admin():
    async with AsyncSessionLocal() as session:
        logger.info("--- Connecting to Database... ---")

        # Check if the admin already exists
        result = await session.execute(
            select(User).where(User.email == NEW_EMAIL)
        )
        existing_user = result.scalar_one_or_none()

        # If user exists, remove and recreate
        if existing_user:
            await session.delete(existing_user)
            await session.commit()
            logger.info(f"--- Existing user {NEW_EMAIL} deleted. Recreating. ---")

        # Create new admin user
        new_admin = User(
            name="Binal Shah",
            email=NEW_EMAIL,
            contact_number="9920528752",
            passcode=encrypt_passcode(RAW_PASSWORD),
            passcode_hash=hash_password(RAW_PASSWORD),
            role="ADMIN",
            is_active=True,
        )

        session.add(new_admin)
        await session.commit()

        logger.info(f"--- SUCCESS: New Admin Created ---")
        logger.info(f"Email: {NEW_EMAIL}")
        logger.info(f"Password: {RAW_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(create_new_admin())
