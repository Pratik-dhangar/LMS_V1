"""
Standalone migration script to handle existing user passcodes.
Does NOT import app modules to avoid DB connection issues.
Generates new plain-text passcodes and hashes for existing users.

Run from backend root: python migrate_existing_passcodes.py
"""

import asyncio
import random
import sys
import os
from passlib.context import CryptContext
from sqlalchemy import select, String, Column, Integer
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Build DATABASE_URL from environment
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    if not all([DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME]):
        print("❌ ERROR: Missing database configuration in .env or DATABASE_URL not set")
        sys.exit(1)
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Convert to async URL
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

safe_url = ASYNC_DATABASE_URL.replace(DB_PASSWORD or '', '***') if DB_PASSWORD else ASYNC_DATABASE_URL
print(f"\n🔗 Database URL: {safe_url}\n")

# Setup password hashing (same as app.core.security)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


# Define User model inline to avoid app imports
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    passcode = Column(String(20), unique=True, nullable=False, index=True)
    passcode_hash = Column(String(60), nullable=True, index=True)
    role = Column(String(50), nullable=False)


async def main():
    """Main migration function"""
    
    # Create async engine
    engine = create_async_engine(ASYNC_DATABASE_URL, echo=False)
    
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as db:
        try:
            print("📦 Starting passcode migration...\n")
            
            # Get all users
            result = await db.execute(select(User))
            users = result.scalars().all()
            
            if not users:
                print("✓ No users found to migrate.")
                await engine.dispose()
                return
            
            print(f"Found {len(users)} users to migrate.\n")
            print("-" * 80)
            
            for user in users:
                # Generate a new plain-text passcode (6 digits)
                plain_passcode = str(random.randint(100000, 999999))
                
                # Hash it for passcode_hash column
                hashed = hash_password(plain_passcode)
                
                # Update user
                user.passcode = plain_passcode
                user.passcode_hash = hashed
                
                print(f"✓ ID {user.id:3d} | {user.name:30s} | Role: {user.role:12s} | New Passcode: {plain_passcode}")
            
            print("-" * 80)
            
            # Commit all changes
            await db.commit()
            print(f"\n✓✓✓ Successfully migrated {len(users)} users! ✓✓✓\n")
            print("✓ Old hashes have been replaced with new plain-text passcodes.")
            print("✓ All passcodes are now hashed in passcode_hash column.")
            print("✓ Admin UI will display plain-text passcodes.")
            print("✓ Login verification will use passcode_hash.\n")
            
        except Exception as e:
            await db.rollback()
            print(f"\n❌ Migration failed: {e}\n")
            import traceback
            traceback.print_exc()
            sys.exit(1)
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
