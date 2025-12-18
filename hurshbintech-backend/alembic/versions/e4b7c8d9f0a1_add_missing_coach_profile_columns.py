"""add missing coach profile columns

Revision ID: e4b7c8d9f0a1
Revises: 330f576003e9
Create Date: 2025-12-18 09:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e4b7c8d9f0a1'
down_revision = '330f576003e9'
branch_labels = None
depends_on = None


def upgrade():
    """Add missing columns to coach_profiles table that exist in the model but not in the database."""
    
    # Check if columns exist before adding them
    op.execute("""
        DO $$
        BEGIN
            -- Add experience_with_hurshbin column if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='coach_profiles' AND column_name='experience_with_hurshbin'
            ) THEN
                ALTER TABLE coach_profiles ADD COLUMN experience_with_hurshbin TEXT;
            END IF;

            -- Add interest column if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='coach_profiles' AND column_name='interest'
            ) THEN
                ALTER TABLE coach_profiles ADD COLUMN interest TEXT;
            END IF;

            -- Add self_description column if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='coach_profiles' AND column_name='self_description'
            ) THEN
                ALTER TABLE coach_profiles ADD COLUMN self_description TEXT;
            END IF;

            -- Add future_vision column if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='coach_profiles' AND column_name='future_vision'
            ) THEN
                ALTER TABLE coach_profiles ADD COLUMN future_vision TEXT;
            END IF;

            -- Add number_of_sessions_done column if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='coach_profiles' AND column_name='number_of_sessions_done'
            ) THEN
                ALTER TABLE coach_profiles ADD COLUMN number_of_sessions_done INTEGER DEFAULT 0;
            END IF;

            -- Add head_description column if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='coach_profiles' AND column_name='head_description'
            ) THEN
                ALTER TABLE coach_profiles ADD COLUMN head_description TEXT;
            END IF;

            -- Add learners_guardian_description column if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='coach_profiles' AND column_name='learners_guardian_description'
            ) THEN
                ALTER TABLE coach_profiles ADD COLUMN learners_guardian_description TEXT;
            END IF;

            -- Add input_at_hurshbin column if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='coach_profiles' AND column_name='input_at_hurshbin'
            ) THEN
                ALTER TABLE coach_profiles ADD COLUMN input_at_hurshbin TEXT;
            END IF;

            -- Add note_box column if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='coach_profiles' AND column_name='note_box'
            ) THEN
                ALTER TABLE coach_profiles ADD COLUMN note_box TEXT;
            END IF;

            -- Add message_box column if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='coach_profiles' AND column_name='message_box'
            ) THEN
                ALTER TABLE coach_profiles ADD COLUMN message_box TEXT;
            END IF;

            -- Drop created_by_admin_id if it exists (not in model)
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='coach_profiles' AND column_name='created_by_admin_id'
            ) THEN
                ALTER TABLE coach_profiles DROP COLUMN created_by_admin_id;
            END IF;

            -- Ensure user_id has UNIQUE constraint
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE table_name='coach_profiles' AND constraint_type='UNIQUE' 
                AND constraint_name LIKE '%user_id%'
            ) THEN
                ALTER TABLE coach_profiles ADD CONSTRAINT coach_profiles_user_id_key UNIQUE (user_id);
            END IF;
        END $$;
    """)


def downgrade():
    """Remove the added columns."""
    op.execute("""
        ALTER TABLE coach_profiles 
        DROP COLUMN IF EXISTS experience_with_hurshbin,
        DROP COLUMN IF EXISTS interest,
        DROP COLUMN IF EXISTS self_description,
        DROP COLUMN IF EXISTS future_vision,
        DROP COLUMN IF EXISTS number_of_sessions_done,
        DROP COLUMN IF EXISTS head_description,
        DROP COLUMN IF EXISTS learners_guardian_description,
        DROP COLUMN IF EXISTS input_at_hurshbin,
        DROP COLUMN IF EXISTS note_box,
        DROP COLUMN IF EXISTS message_box;
    """)
