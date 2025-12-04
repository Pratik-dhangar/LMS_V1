"""
Data Migration Script: Encrypt Existing Plaintext Passcodes

This script encrypts all existing plaintext passcodes in the users table
using Fernet symmetric encryption.

WARNING: 
- Backup your database before running this script!
- Ensure ENCRYPTION_KEY is set in your .env file
- This will encrypt all existing plaintext passcodes
- After running, passcodes can only be viewed via the reveal API endpoint

Usage:
    python encrypt_existing_passcodes.py
"""

import asyncio
import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from cryptography.fernet import Fernet


def get_database_url():
    """Build database URL from environment variables"""
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_host = os.getenv("DB_HOST", "localhost")
    db_port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME")
    
    if not all([db_user, db_password, db_name]):
        raise ValueError("Missing required database environment variables")
    
    return f"postgresql+asyncpg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"


def encrypt_passcode(plain_passcode: str, encryption_key: str) -> str:
    """Encrypt a plaintext passcode using Fernet"""
    cipher = Fernet(encryption_key.encode())
    encrypted_bytes = cipher.encrypt(plain_passcode.encode())
    return encrypted_bytes.decode()


async def main():
    print("\n" + "="*80)
    print("PASSCODE ENCRYPTION MIGRATION SCRIPT")
    print("="*80 + "\n")
    
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    encryption_key = os.getenv("ENCRYPTION_KEY")
    if not encryption_key:
        print("❌ ERROR: ENCRYPTION_KEY not found in environment!")
        print("\nTo generate a key, run:")
        print("  python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"")
        print("\nThen add it to your .env file:")
        print("  ENCRYPTION_KEY=<generated_key>")
        return
    
    print(f"✓ Encryption key loaded (length: {len(encryption_key)} characters)")
    
    # Verify key format
    try:
        Fernet(encryption_key.encode())
        print("✓ Encryption key format is valid\n")
    except Exception as e:
        print(f"❌ ERROR: Invalid encryption key format: {e}")
        return
    
    # Connect to database
    try:
        database_url = get_database_url()
        engine = create_async_engine(database_url, echo=False)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        print(f"✓ Connected to database\n")
    except Exception as e:
        print(f"❌ ERROR: Failed to connect to database: {e}")
        return
    
    # Confirm before proceeding
    print("⚠️  WARNING: This will encrypt all plaintext passcodes in the database.")
    print("   Make sure you have a backup before proceeding!\n")
    response = input("Continue? (yes/no): ")
    if response.lower() != "yes":
        print("\n❌ Migration cancelled.")
        return
    
    async with async_session() as session:
        try:
            # Get all users with plaintext passcodes
            result = await session.execute(
                text("SELECT id, name, role, passcode FROM users")
            )
            users = result.fetchall()
            
            print(f"\n📊 Found {len(users)} users to process\n")
            
            encrypted_count = 0
            skipped_count = 0
            
            for user in users:
                user_id, name, role, passcode = user
                
                # Check if passcode is already encrypted (Fernet tokens start with 'gAAAAA')
                if passcode and (passcode.startswith('gAAAAA') or len(passcode) > 50):
                    print(f"  ⏭️  Skipping user {user_id} ({name}) - already encrypted")
                    skipped_count += 1
                    continue
                
                try:
                    # Encrypt the passcode
                    encrypted_passcode = encrypt_passcode(passcode, encryption_key)
                    
                    # Update the database
                    await session.execute(
                        text("UPDATE users SET passcode = :encrypted WHERE id = :user_id"),
                        {"encrypted": encrypted_passcode, "user_id": user_id}
                    )
                    
                    print(f"  ✓ Encrypted passcode for user {user_id} ({name}, {role})")
                    encrypted_count += 1
                    
                except Exception as e:
                    print(f"  ❌ ERROR encrypting passcode for user {user_id}: {e}")
            
            # Commit all changes
            await session.commit()
            
            print(f"\n" + "="*80)
            print(f"✅ MIGRATION COMPLETED")
            print(f"="*80)
            print(f"  Encrypted: {encrypted_count} users")
            print(f"  Skipped:   {skipped_count} users (already encrypted)")
            print(f"  Total:     {len(users)} users")
            print(f"\n✓ All passcodes are now encrypted.")
            print(f"✓ Use the reveal API endpoint to decrypt passcodes when needed.\n")
            
        except Exception as e:
            print(f"\n❌ ERROR during migration: {e}")
            await session.rollback()
            raise
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
