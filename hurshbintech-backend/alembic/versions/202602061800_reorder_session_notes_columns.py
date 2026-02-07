"""reorder_session_notes_columns

Revision ID: 202602061800
Revises: 202602061700
Create Date: 2026-02-06 18:00:00.000000

This migration reorders columns in the session_notes table for better logical grouping:
- coach_appointment_session_id moved to LEFT of session_id
- coach_id moved to RIGHT of trainer_id

New column order:
id -> coach_appointment_session_id -> session_id -> trainer_id -> coach_id -> notes -> version -> is_finalized -> created_at -> updated_at

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '202602061800'
down_revision: Union[str, Sequence[str], None] = '202602061700'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Reorder columns in session_notes table"""
    
    # For PostgreSQL, we need to recreate the table with new column order
    # Drop existing indexes and foreign keys first
    op.drop_index('ix_session_notes_coach_id', table_name='session_notes')
    op.drop_index('ix_session_notes_coach_appointment_session_id', table_name='session_notes')
    op.drop_index('ix_session_notes_session_id', table_name='session_notes')
    op.drop_index('ix_session_notes_trainer_id', table_name='session_notes')
    
    # Drop foreign key constraints
    op.drop_constraint('session_notes_coach_id_fkey', 'session_notes', type_='foreignkey')
    op.drop_constraint('session_notes_coach_appointment_session_id_fkey', 'session_notes', type_='foreignkey')
    op.drop_constraint('session_notes_trainer_id_fkey', 'session_notes', type_='foreignkey')
    op.drop_constraint('session_notes_session_id_fkey', 'session_notes', type_='foreignkey')
    
    # Recreate table with new column order using raw SQL
    op.execute("""
        CREATE TABLE session_notes_new (
            id SERIAL PRIMARY KEY,
            coach_appointment_session_id INTEGER,
            session_id INTEGER,
            trainer_id INTEGER,
            coach_id INTEGER,
            notes TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            is_finalized VARCHAR(10) NOT NULL DEFAULT 'false',
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
        )
    """)
    
    # Copy data from old table to new table
    op.execute("""
        INSERT INTO session_notes_new 
        (id, coach_appointment_session_id, session_id, trainer_id, coach_id, notes, version, is_finalized, created_at, updated_at)
        SELECT 
            id, coach_appointment_session_id, session_id, trainer_id, coach_id, notes, version, is_finalized, created_at, updated_at
        FROM session_notes
    """)
    
    # Drop old table
    op.drop_table('session_notes')
    
    # Rename new table
    op.execute('ALTER TABLE session_notes_new RENAME TO session_notes')
    
    # Recreate indexes
    op.create_index('ix_session_notes_id', 'session_notes', ['id'])
    op.create_index('ix_session_notes_coach_appointment_session_id', 'session_notes', ['coach_appointment_session_id'])
    op.create_index('ix_session_notes_session_id', 'session_notes', ['session_id'])
    op.create_index('ix_session_notes_trainer_id', 'session_notes', ['trainer_id'])
    op.create_index('ix_session_notes_coach_id', 'session_notes', ['coach_id'])
    
    # Recreate foreign key constraints
    op.create_foreign_key(
        'session_notes_coach_appointment_session_id_fkey',
        'session_notes', 'coach_appointment_sessions',
        ['coach_appointment_session_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'session_notes_session_id_fkey',
        'session_notes', 'training_sessions',
        ['session_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'session_notes_trainer_id_fkey',
        'session_notes', 'users',
        ['trainer_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'session_notes_coach_id_fkey',
        'session_notes', 'coach_profiles',
        ['coach_id'], ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    """Downgrade schema - Revert to original column order"""
    
    # Drop indexes and foreign keys
    op.drop_index('ix_session_notes_coach_id', table_name='session_notes')
    op.drop_index('ix_session_notes_coach_appointment_session_id', table_name='session_notes')
    op.drop_index('ix_session_notes_session_id', table_name='session_notes')
    op.drop_index('ix_session_notes_trainer_id', table_name='session_notes')
    op.drop_index('ix_session_notes_id', table_name='session_notes')
    
    op.drop_constraint('session_notes_coach_id_fkey', 'session_notes', type_='foreignkey')
    op.drop_constraint('session_notes_coach_appointment_session_id_fkey', 'session_notes', type_='foreignkey')
    op.drop_constraint('session_notes_trainer_id_fkey', 'session_notes', type_='foreignkey')
    op.drop_constraint('session_notes_session_id_fkey', 'session_notes', type_='foreignkey')
    
    # Recreate table with original column order
    op.execute("""
        CREATE TABLE session_notes_new (
            id SERIAL PRIMARY KEY,
            session_id INTEGER,
            trainer_id INTEGER,
            coach_appointment_session_id INTEGER,
            coach_id INTEGER,
            notes TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            is_finalized VARCHAR(10) NOT NULL DEFAULT 'false',
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
        )
    """)
    
    # Copy data
    op.execute("""
        INSERT INTO session_notes_new 
        (id, session_id, trainer_id, coach_appointment_session_id, coach_id, notes, version, is_finalized, created_at, updated_at)
        SELECT 
            id, session_id, trainer_id, coach_appointment_session_id, coach_id, notes, version, is_finalized, created_at, updated_at
        FROM session_notes
    """)
    
    # Drop old table
    op.drop_table('session_notes')
    
    # Rename new table
    op.execute('ALTER TABLE session_notes_new RENAME TO session_notes')
    
    # Recreate indexes
    op.create_index('ix_session_notes_id', 'session_notes', ['id'])
    op.create_index('ix_session_notes_session_id', 'session_notes', ['session_id'])
    op.create_index('ix_session_notes_trainer_id', 'session_notes', ['trainer_id'])
    op.create_index('ix_session_notes_coach_appointment_session_id', 'session_notes', ['coach_appointment_session_id'])
    op.create_index('ix_session_notes_coach_id', 'session_notes', ['coach_id'])
    
    # Recreate foreign key constraints with original order
    op.create_foreign_key(
        'session_notes_session_id_fkey',
        'session_notes', 'training_sessions',
        ['session_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'session_notes_trainer_id_fkey',
        'session_notes', 'users',
        ['trainer_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'session_notes_coach_appointment_session_id_fkey',
        'session_notes', 'coach_appointment_sessions',
        ['coach_appointment_session_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'session_notes_coach_id_fkey',
        'session_notes', 'coach_profiles',
        ['coach_id'], ['id'],
        ondelete='CASCADE'
    )
