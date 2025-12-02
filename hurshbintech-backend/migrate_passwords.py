"""
One-time script to hash existing plain text passwords
Run ONCE before starting the updated backend

Usage:
    python migrate_passwords.py

This script will:
1. Connect to your database
2. Find all users and admins with plain text passwords
3. Hash them using bcrypt
4. Update the database
"""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize password hasher
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    print("❌ ERROR: DATABASE_URL not found in .env file")
    print("Please create a .env file with your database connection string")
    exit(1)

# Convert to asyncpg format
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")


async def migrate_passwords():
    """Migrate all plain text passwords to bcrypt hashes"""

    print("=" * 60)
    print("🔐 PASSWORD MIGRATION SCRIPT")
    print("=" * 60)
    print(f"Database: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'unknown'}")
    print()

    # Create async engine
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with async_session() as session:
            print("🔄 Starting password migration...")
            print()

            total_hashed = 0

            # Migrate users table
            print("📊 Checking 'users' table...")
            try:
                result = await session.execute(text("SELECT id, name, passcode FROM users"))
                users = result.fetchall()

                print(f"   Found {len(users)} users")

                for user_id, name, passcode in users:
                    # Check if already hashed (bcrypt hashes start with $2b$)
                    if passcode and not passcode.startswith("$2b$"):
                        hashed = pwd_context.hash(passcode)
                        await session.execute(
                            text("UPDATE users SET passcode = :hashed WHERE id = :id"),
                            {"hashed": hashed, "id": user_id},
                        )
                        total_hashed += 1
                        print(f"   ✅ Hashed password for user: {name} (ID: {user_id})")
                    else:
                        print(f"   ⏭️  Skipped (already hashed): {name} (ID: {user_id})")

            except Exception as e:
                print(f"   ⚠️  Error processing users table: {e}")

            print()

            # Migrate admins table (if exists)
            print("📊 Checking 'admins' table...")
            try:
                result = await session.execute(text("SELECT id, name, passcode FROM admins"))
                admins = result.fetchall()

                print(f"   Found {len(admins)} admins")

                for admin_id, name, passcode in admins:
                    if passcode and not passcode.startswith("$2b$"):
                        hashed = pwd_context.hash(passcode)
                        await session.execute(
                            text("UPDATE admins SET passcode = :hashed WHERE id = :id"),
                            {"hashed": hashed, "id": admin_id},
                        )
                        total_hashed += 1
                        print(f"   ✅ Hashed password for admin: {name} (ID: {admin_id})")
                    else:
                        print(f"   ⏭️  Skipped (already hashed): {name} (ID: {admin_id})")

            except Exception as e:
                print(f"   ⚠️  Admins table not found or error: {e}")

            # Commit all changes
            await session.commit()

            print()
            print("=" * 60)
            print(f"✅ MIGRATION COMPLETE!")
            print(f"   Total passwords hashed: {total_hashed}")
            print("=" * 60)
            print()
            print("🚀 Next steps:")
            print("   1. Start your backend server: uvicorn main:app --reload")
            print("   2. Test login with existing credentials")
            print("   3. Verify passwords are hashed in database")
            print()

    except Exception as e:
        print()
        print("❌ MIGRATION FAILED!")
        print(f"Error: {e}")
        print()
        print("Please check:")
        print("  - Database is running")
        print("  - DATABASE_URL in .env is correct")
        print("  - You have database access permissions")
        return
    finally:
        await engine.dispose()


async def verify_migration():
    """Verify that passwords were migrated successfully"""

    print("🔍 Verifying migration...")

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Check a sample user
        result = await session.execute(text("SELECT passcode FROM users LIMIT 1"))
        row = result.fetchone()

        if row and row[0]:
            passcode = row[0]
            if passcode.startswith("$2b$"):
                print("   ✅ Verification passed - passwords are hashed")
            else:
                print("   ❌ Verification failed - passwords still in plain text")
        else:
            print("   ⚠️  No users found to verify")

    await engine.dispose()


if __name__ == "__main__":
    print()
    print("⚠️  WARNING: This script will modify your database")
    print("   It will hash all plain text passwords using bcrypt")
    print()

    # Ask for confirmation
    response = input("Do you want to continue? (yes/no): ").strip().lower()

    if response in ["yes", "y"]:
        print()
        asyncio.run(migrate_passwords())
        asyncio.run(verify_migration())
    else:
        print("Migration cancelled.")
        print()
