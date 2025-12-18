"""merge conflicting migrations

Revision ID: 1a50173b183a
Revises: 0329c5805c7b, dfbd0171d916
Create Date: 2025-12-18 13:07:27.116816

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1a50173b183a'
down_revision: Union[str, Sequence[str], None] = ('0329c5805c7b', 'dfbd0171d916')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Ensure session_notes and head_session_notes tables exist."""
    # Create session_notes table if it doesn't exist (from 5c1d2a3e4f5g branch)
    op.execute("""
        CREATE TABLE IF NOT EXISTS session_notes (
            id SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
            trainer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            notes TEXT,
            version INTEGER DEFAULT 1 NOT NULL,
            is_finalized VARCHAR(10) DEFAULT 'false' NOT NULL,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_session_notes_id ON session_notes(id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_session_notes_session_id ON session_notes(session_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_session_notes_trainer_id ON session_notes(trainer_id)")
    
    # Create head_session_notes table if it doesn't exist (from 0329c5805c7b branch)
    op.execute("""
        CREATE TABLE IF NOT EXISTS head_session_notes (
            id SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
            head_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            notes TEXT,
            version INTEGER DEFAULT 1 NOT NULL,
            is_finalized VARCHAR(10) DEFAULT 'false' NOT NULL,
            created_at TIMESTAMP NOT NULL,
            updated_at TIMESTAMP NOT NULL
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_head_session_notes_id ON head_session_notes(id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_head_session_notes_session_id ON head_session_notes(session_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_head_session_notes_head_id ON head_session_notes(head_id)")


def downgrade() -> None:
    """Downgrade schema."""
    pass
