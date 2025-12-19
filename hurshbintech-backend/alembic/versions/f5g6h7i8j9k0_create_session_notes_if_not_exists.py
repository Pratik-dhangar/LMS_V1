"""Create session_notes table if not exists - Fix missing table

Revision ID: f5g6h7i8j9k0
Revises: e4b7c8d9f0a1
Create Date: 2025-12-18 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f5g6h7i8j9k0'
down_revision: Union[str, Sequence[str], None] = 'e4b7c8d9f0a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create session_notes and head_session_notes tables if they don't exist - idempotent operation"""
    
    # Use raw SQL with IF NOT EXISTS for idempotent table creation
    op.execute("""
        DO $$
        BEGIN
            -- Create session_notes table if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name='session_notes'
            ) THEN
                CREATE TABLE session_notes (
                    id INTEGER NOT NULL,
                    session_id INTEGER NOT NULL,
                    trainer_id INTEGER NOT NULL,
                    notes TEXT,
                    version INTEGER NOT NULL DEFAULT 1,
                    is_finalized VARCHAR(10) NOT NULL DEFAULT 'false',
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL,
                    PRIMARY KEY (id),
                    FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE CASCADE,
                    FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE CASCADE
                );
                
                -- Create indexes
                CREATE INDEX ix_session_notes_id ON session_notes(id);
                CREATE INDEX ix_session_notes_session_id ON session_notes(session_id);
                CREATE INDEX ix_session_notes_trainer_id ON session_notes(trainer_id);
            END IF;

            -- Create head_session_notes table if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name='head_session_notes'
            ) THEN
                CREATE TABLE head_session_notes (
                    id INTEGER NOT NULL,
                    session_id INTEGER NOT NULL,
                    head_id INTEGER NOT NULL,
                    notes TEXT,
                    version INTEGER NOT NULL,
                    is_finalized VARCHAR(10) NOT NULL,
                    created_at TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP NOT NULL,
                    PRIMARY KEY (id),
                    FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE CASCADE,
                    FOREIGN KEY (head_id) REFERENCES users(id) ON DELETE CASCADE
                );
                
                -- Create indexes
                CREATE INDEX ix_head_session_notes_id ON head_session_notes(id);
                CREATE INDEX ix_head_session_notes_session_id ON head_session_notes(session_id);
                CREATE INDEX ix_head_session_notes_head_id ON head_session_notes(head_id);
            END IF;
        END
        $$;
    """)


def downgrade() -> None:
    """Drop session_notes and head_session_notes tables if they exist"""
    
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name='head_session_notes'
            ) THEN
                DROP TABLE IF EXISTS head_session_notes;
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name='session_notes'
            ) THEN
                DROP TABLE IF EXISTS session_notes;
            END IF;
        END
        $$;
    """)
