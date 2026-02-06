"""add_coach_session_support_to_session_notes

Revision ID: 202602061700
Revises: a1b2c3d4e5f8
Create Date: 2026-02-06 17:00:00.000000

This migration adds support for coach appointment session notes to the session_notes table.
Previously, session_notes only supported training_sessions. Now it can also store notes for
coach_appointment_sessions.

Changes:
- Make session_id nullable (was previously NOT NULL) to support coach-only notes
- Add coach_appointment_session_id column with FK to coach_appointment_sessions
- Make trainer_id nullable to support coach-only notes
- Add coach_id column with FK to coach_profiles for coach-created notes
- Add index on coach_appointment_session_id for query performance

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '202602061700'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add coach appointment session support to session_notes"""
    
    # Alter session_id to be nullable (currently NOT NULL for training sessions)
    op.alter_column('session_notes', 'session_id',
               existing_type=sa.Integer(),
               nullable=True,
               existing_nullable=False)
    
    # Alter trainer_id to be nullable (coaches don't have trainer_id)
    op.alter_column('session_notes', 'trainer_id',
               existing_type=sa.Integer(),
               nullable=True,
               existing_nullable=False)
    
    # Add coach_appointment_session_id column with foreign key
    op.add_column('session_notes',
        sa.Column('coach_appointment_session_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'session_notes_coach_appointment_session_id_fkey',
        'session_notes', 'coach_appointment_sessions',
        ['coach_appointment_session_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_index(
        'ix_session_notes_coach_appointment_session_id',
        'session_notes', ['coach_appointment_session_id']
    )
    
    # Add coach_id column with foreign key
    op.add_column('session_notes',
        sa.Column('coach_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'session_notes_coach_id_fkey',
        'session_notes', 'coach_profiles',
        ['coach_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_index(
        'ix_session_notes_coach_id',
        'session_notes', ['coach_id']
    )


def downgrade() -> None:
    """Downgrade schema - Remove coach appointment session support from session_notes"""
    
    # Drop indexes
    op.drop_index('ix_session_notes_coach_id', table_name='session_notes')
    op.drop_index('ix_session_notes_coach_appointment_session_id', table_name='session_notes')
    
    # Drop foreign keys and columns
    op.drop_constraint('session_notes_coach_id_fkey', 'session_notes', type_='foreignkey')
    op.drop_column('session_notes', 'coach_id')
    
    op.drop_constraint('session_notes_coach_appointment_session_id_fkey', 'session_notes', type_='foreignkey')
    op.drop_column('session_notes', 'coach_appointment_session_id')
    
    # Alter columns back to NOT NULL
    op.alter_column('session_notes', 'trainer_id',
               existing_type=sa.Integer(),
               nullable=False,
               existing_nullable=True)
    
    op.alter_column('session_notes', 'session_id',
               existing_type=sa.Integer(),
               nullable=False,
               existing_nullable=True)
