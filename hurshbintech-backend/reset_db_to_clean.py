"""Reset database to clean state before coach changes"""
import asyncio
from sqlalchemy import text
from app.db.session import engine

async def reset_to_clean_state():
    async with engine.begin() as conn:
        print("Dropping coach-specific columns from coach_profiles...")
        
        # Drop columns that were added in the buggy migrations
        columns_to_drop = [
            'created_by_head_id',
            'availability_days',
            'time_slots', 
            'specialization',
            'profile_picture_url',
            'is_available',
            'unavailable_until',
            'unavailable_reason'
        ]
        
        for col in columns_to_drop:
            try:
                await conn.execute(text(f"ALTER TABLE coach_profiles DROP COLUMN IF EXISTS {col}"))
                print(f"  ✓ Dropped {col}")
            except Exception as e:
                print(f"  ✗ Could not drop {col}: {e}")
        
        # Reset alembic version to 4a8c9d2e1f3b
        await conn.execute(text("UPDATE alembic_version SET version_num = '4a8c9d2e1f3b'"))
        print("\n✓ Reset alembic_version to 4a8c9d2e1f3b")
        print("\nDatabase is now at clean state (version 4a8c9d2e1f3b)")
        print("You can now generate a new migration with: alembic revision --autogenerate -m 'add_coach_features'")

asyncio.run(reset_to_clean_state())
