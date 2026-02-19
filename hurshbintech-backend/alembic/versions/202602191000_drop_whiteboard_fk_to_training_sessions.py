"""drop_whiteboard_fk_to_training_sessions

Revision ID: 202602191000
Revises: 202602161500
Create Date: 2026-02-19 10:00:00.000000

The whiteboard_states table originally had a FK constraint (fk_whiteboard_session)
pointing to training_sessions.session_id. However, the whiteboard feature is also
used with coach appointment sessions (coach_appointment_sessions), whose session_ids
are NOT present in training_sessions. This caused ForeignKeyViolationError every time
a coach appointment session used the whiteboard.

Fix: Drop the FK constraint so session_id is a plain VARCHAR that accepts any session
type without referencing a specific table. Referential integrity for coach sessions is
enforced at the application layer.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '202602191000'
down_revision: Union[str, Sequence[str], None] = '202602161500'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop the FK constraint from whiteboard_states.session_id"""
    op.execute("""
        ALTER TABLE whiteboard_states
        DROP CONSTRAINT IF EXISTS fk_whiteboard_session
    """)


def downgrade() -> None:
    """Re-add the FK constraint (only works if all session_ids exist in training_sessions)"""
    op.execute("""
        ALTER TABLE whiteboard_states
        ADD CONSTRAINT fk_whiteboard_session
        FOREIGN KEY (session_id)
        REFERENCES training_sessions(session_id)
        ON DELETE CASCADE
    """)
