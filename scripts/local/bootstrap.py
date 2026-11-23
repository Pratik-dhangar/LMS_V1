"""Create this setup's admin without replacing any existing user."""

import asyncio
import os

from sqlalchemy import select

import app.models  # Register relationship targets before querying User.
from app.core.security import encrypt_passcode, hash_password, verify_password
from app.db.session import AsyncSessionLocal, engine
from app.models.user_model import User, UserRole


async def main():
    email = os.environ["LOCAL_ADMIN_EMAIL"]
    passcode = os.environ["LOCAL_ADMIN_PASSCODE"]
    if len(passcode) != 6 or not passcode.isascii() or not passcode.isdigit():
        raise RuntimeError("The local admin passcode must contain six ASCII digits.")
    async with AsyncSessionLocal() as db:
        existing = await db.scalar(select(User).where(User.email == email))
        if existing:
            if existing.role != UserRole.ADMIN or not verify_password(passcode, existing.passcode_hash):
                raise RuntimeError(
                    "Existing account does not match the saved local admin credentials. "
                    "No account was changed. Restore the original local credentials."
                )
            print("Local administrator already exists; preserved.")
            return
        # Login is role + passcode, so do not create an ambiguous second admin.
        admins = (await db.scalars(select(User).where(User.role == UserRole.ADMIN))).all()
        if any(verify_password(passcode, admin.passcode_hash) for admin in admins):
            raise RuntimeError("Local passcode already belongs to another admin. No account changed.")
        db.add(User(
            name="Local Administrator",
            email=email,
            passcode=encrypt_passcode(passcode),
            passcode_hash=hash_password(passcode),
            role=UserRole.ADMIN,
            is_active=True,
        ))
        await db.commit()
        print("Local administrator created.")


async def run():
    try:
        await main()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run())
