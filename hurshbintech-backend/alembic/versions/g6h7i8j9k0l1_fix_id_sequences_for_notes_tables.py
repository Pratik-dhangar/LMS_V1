"""Fix id column sequences for session_notes and head_session_notes tables

Revision ID: g6h7i8j9k0l1
Revises: f5g6h7i8j9k0
Create Date: 2025-12-18 11:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'g6h7i8j9k0l1'
down_revision: Union[str, Sequence[str], None] = 'f5g6h7i8j9k0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add sequences and defaults for auto-incrementing id columns"""
    
    op.execute("""
        DO $$
        BEGIN
            -- Create sequence for session_notes if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.sequences 
                WHERE sequence_name='session_notes_id_seq'
            ) THEN
                CREATE SEQUENCE session_notes_id_seq;
                ALTER TABLE session_notes ALTER COLUMN id SET DEFAULT nextval('session_notes_id_seq');
                ALTER SEQUENCE session_notes_id_seq OWNED BY session_notes.id;
            END IF;

            -- Create sequence for head_session_notes if it doesn't exist
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.sequences 
                WHERE sequence_name='head_session_notes_id_seq'
            ) THEN
                CREATE SEQUENCE head_session_notes_id_seq;
                ALTER TABLE head_session_notes ALTER COLUMN id SET DEFAULT nextval('head_session_notes_id_seq');
                ALTER SEQUENCE head_session_notes_id_seq OWNED BY head_session_notes.id;
            END IF;
        END
        $$;
    """)


def downgrade() -> None:
    """Drop sequences for id columns"""
    
    op.execute("""
        DO $$
        BEGIN
            -- Drop sequences if they exist
            IF EXISTS (
                SELECT 1 FROM information_schema.sequences 
                WHERE sequence_name='session_notes_id_seq'
            ) THEN
                DROP SEQUENCE IF EXISTS session_notes_id_seq;
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.sequences 
                WHERE sequence_name='head_session_notes_id_seq'
            ) THEN
                DROP SEQUENCE IF EXISTS head_session_notes_id_seq;
            END IF;
        END
        $$;
    """)
