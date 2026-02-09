"""fix_session_notes_constraints_and_sequence

Revision ID: 202602091500
Revises: 202602071000
Create Date: 2026-02-09 15:00:00.000000

This migration fixes the session_notes table to properly handle trainer and coach notes independently:
1. Removes old invalid UNIQUE constraints from columns
2. Adds composite UNIQUE constraints to allow one note per (session, trainer) and one per (coach_appointment_session, coach)
3. Resets the ID sequence to start from max(id) + 1 to prevent duplicate key errors
4. Allows both trainer and coach to save independent notes for the same session
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '202602091500'
down_revision: Union[str, Sequence[str], None] = '202602071000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Fix constraints and sequence"""
    
    # Drop existing unique constraints from model definition if they exist
    # Use raw SQL with IF EXISTS to avoid transaction abort
    op.execute("""
        ALTER TABLE IF EXISTS session_notes
        DROP CONSTRAINT IF EXISTS session_notes_session_id_key
    """)
    
    op.execute("""
        ALTER TABLE IF EXISTS session_notes
        DROP CONSTRAINT IF EXISTS session_notes_coach_appointment_session_id_key
    """)
    
    # Add composite unique indexes (without CONCURRENTLY - not allowed in transactions)
    # For training sessions: one note per trainer per session
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS session_notes_training_session_trainer_idx
        ON session_notes (session_id, trainer_id)
        WHERE session_id IS NOT NULL AND trainer_id IS NOT NULL
    """)
    
    # For coach appointment sessions: one note per coach per session
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS session_notes_coach_appointment_coach_idx
        ON session_notes (coach_appointment_session_id, coach_id)
        WHERE coach_appointment_session_id IS NOT NULL AND coach_id IS NOT NULL
    """)
    
    # Reset the sequence to start from max(id) + 1
    # This prevents duplicate key errors when inserting new records
    # Find the actual sequence name dynamically (it might be session_notes_id_seq or session_notes_new_id_seq)
    op.execute("""
        DO $$
        DECLARE
            seq_name TEXT;
        BEGIN
            -- Find the sequence associated with session_notes.id column
            SELECT pg_get_serial_sequence('session_notes', 'id') INTO seq_name;
            
            IF seq_name IS NOT NULL THEN
                -- Reset the sequence to max(id) + 1
                EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(id) + 1 FROM session_notes), 1), false)', seq_name);
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """Downgrade schema - Remove new indexes"""
    
    op.execute("""
        DROP INDEX IF EXISTS session_notes_training_session_trainer_idx
    """)
    
    op.execute("""
        DROP INDEX IF EXISTS session_notes_coach_appointment_coach_idx
    """)
    
    # Recreate old unique constraints if needed
    # op.create_unique_constraint('session_notes_session_id_key', 'session_notes', ['session_id'])
    # op.create_unique_constraint('session_notes_coach_appointment_session_id_key', 'session_notes', ['coach_appointment_session_id'])
