"""add_coach_features

Revision ID: dfbd0171d916
Revises: 4a8c9d2e1f3b
Create Date: 2025-12-17 15:06:23.880506

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dfbd0171d916'
down_revision: Union[str, Sequence[str], None] = '4a8c9d2e1f3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add 'coach' to userrole enum if not exists
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'COACH' 
                AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole')
            ) THEN
                ALTER TYPE userrole ADD VALUE 'COACH';
            END IF;
        END $$;
    """)
    
    # Create referencedatatype enum if not exists
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referencedatatype') THEN
                CREATE TYPE referencedatatype AS ENUM ('link', 'pdf', 'image', 'video', 'docx');
            END IF;
        END $$;
    """)
    
    # Create coach_profiles table if not exists
    op.execute("""
        CREATE TABLE IF NOT EXISTS coach_profiles (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            age INTEGER,
            address TEXT,
            contact_no VARCHAR(20),
            qualification TEXT,
            experience TEXT,
            date_of_joining DATE,
            availability_days VARCHAR(50),
            time_slots VARCHAR(100),
            specialization TEXT,
            profile_picture_url VARCHAR(500),
            is_available BOOLEAN DEFAULT TRUE,
            unavailable_until TIMESTAMP,
            unavailable_reason VARCHAR(255),
            created_by_admin_id INTEGER REFERENCES users(id),
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_coach_profiles_user_id ON coach_profiles(user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_coach_profiles_id ON coach_profiles(id)")
    
    # Create coach_reference_data table if not exists
    op.execute("""
        CREATE TABLE IF NOT EXISTS coach_reference_data (
            id SERIAL PRIMARY KEY,
            coach_id INTEGER NOT NULL REFERENCES coach_profiles(id),
            data_type referencedatatype NOT NULL,
            file_name VARCHAR(255),
            file_path VARCHAR(255) NOT NULL,
            description TEXT,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_coach_reference_data_id ON coach_reference_data(id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_coach_reference_data_coach_id ON coach_reference_data(coach_id)")
    
    # Create coach_sessions table if not exists
    op.execute("""
        CREATE TABLE IF NOT EXISTS coach_sessions (
            id SERIAL PRIMARY KEY,
            coach_id INTEGER NOT NULL REFERENCES coach_profiles(id),
            session_date DATE NOT NULL,
            session_time VARCHAR(20) NOT NULL,
            session_title VARCHAR(255),
            learning_content_id INTEGER REFERENCES learning_contents(id),
            description TEXT,
            status VARCHAR(20) DEFAULT 'scheduled',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_coach_sessions_id ON coach_sessions(id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_coach_sessions_coach_id ON coach_sessions(coach_id)")
    
    # Create coach_session_participants table if not exists
    op.execute("""
        CREATE TABLE IF NOT EXISTS coach_session_participants (
            id SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES coach_sessions(id),
            user_id INTEGER NOT NULL REFERENCES users(id),
            participant_role VARCHAR(20) NOT NULL,
            status VARCHAR(20) DEFAULT 'invited',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_coach_session_participants_id ON coach_session_participants(id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_coach_session_participants_session_id ON coach_session_participants(session_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_coach_session_participants_user_id ON coach_session_participants(user_id)")


def downgrade() -> None:
    """Downgrade schema."""
    # Drop coach-related tables in correct order (drop dependent tables first)
    op.execute("DROP TABLE IF EXISTS coach_session_participants CASCADE;")
    op.execute("DROP TABLE IF EXISTS coach_sessions CASCADE;")
    op.execute("DROP TABLE IF EXISTS coach_reference_data CASCADE;")
    op.execute("DROP TABLE IF EXISTS coach_profiles CASCADE;")
    
    # Drop enums
    op.execute("DROP TYPE IF EXISTS referencedatatype CASCADE;")
    op.execute("DROP TABLE IF EXISTS coach_reference_data CASCADE;")
    
    # Note: We don't drop the enums or 'coach' value from userrole enum
    # because it might be referenced elsewhere and dropping enum values is complex
