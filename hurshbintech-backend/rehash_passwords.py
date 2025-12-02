"""
Script to rehash all existing passwords in the database to bcrypt format.
Run this once after implementing bcrypt password hashing.
"""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update
from app.models.user_model import User
from app.core.security import hash_password
from app.core.config import settings


async def rehash_all_passwords():
    """Rehash all user passwords to bcrypt format"""

    # Create async engine
    engine = create_async_engine(settings.DATABASE_URI, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Get all users
        result = await session.execute(select(User))
        users = result.scalars().all()

        print(f"\nFound {len(users)} users in database")
        print("-" * 50)

        rehashed_count = 0
        skipped_count = 0

        for user in users:
            # Check if password is already bcrypt hashed (starts with $2b$)
            if user.passcode and user.passcode.startswith("$2b$"):
                print(f"✓ SKIP: {user.name} ({user.role}) - Already bcrypt hashed")
                skipped_count += 1
                continue

            # Get the current password (plaintext or old hash)
            old_passcode = user.passcode

            # Hash it with bcrypt
            new_passcode = hash_password(old_passcode)

            # Update the user
            user.passcode = new_passcode
            session.add(user)

            print(f"✓ REHASHED: {user.name} ({user.role})")
            print(f"  Old: {old_passcode[:20]}...")
            print(f"  New: {new_passcode[:60]}...")
            rehashed_count += 1

        # Commit all changes
        await session.commit()

        print("-" * 50)
        print(f"\n✅ Complete!")
        print(f"   Rehashed: {rehashed_count} users")
        print(f"   Skipped:  {skipped_count} users (already bcrypt)")
        print(f"   Total:    {len(users)} users")

    await engine.dispose()


if __name__ == "__main__":
    print("=" * 50)
    print("Password Rehashing Script")
    print("=" * 50)
    print("\n⚠️  WARNING: This will rehash ALL passwords in the database!")
    print("   Make sure you have a backup before proceeding.\n")

    response = input("Continue? (yes/no): ").strip().lower()

    if response == "yes":
        asyncio.run(rehash_all_passwords())
    else:
        print("\n❌ Aborted. No changes made.")
