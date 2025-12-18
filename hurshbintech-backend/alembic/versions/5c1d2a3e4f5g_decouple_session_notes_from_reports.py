"""Decouple session notes from session_reports - Independent notes storage

Revision ID: 5c1d2a3e4f5g
Revises: 4a8c9d2e1f3b
Create Date: 2025-12-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '5c1d2a3e4f5g'
down_revision: Union[str, Sequence[str], None] = '4a8c9d2e1f3b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Move session notes from session_reports to independent session_notes table"""
    
    # 1. Recreate session_notes table with enhanced fields
    op.create_table(
        'session_notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('trainer_id', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('is_finalized', sa.String(10), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['training_sessions.id'], name='session_notes_session_id_fkey', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['trainer_id'], ['users.id'], name='session_notes_trainer_id_fkey', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='session_notes_pkey')
    )
    
    # 2. Create indexes for better query performance
    op.create_index(op.f('ix_session_notes_id'), 'session_notes', ['id'], unique=False)
    op.create_index(op.f('ix_session_notes_session_id'), 'session_notes', ['session_id'], unique=False)
    op.create_index(op.f('ix_session_notes_trainer_id'), 'session_notes', ['trainer_id'], unique=False)
    
    # 3. Migrate existing session notes from session_reports to session_notes table
    # This SQL will copy notes from session_reports to session_notes (one entry per session)
    op.execute("""
        INSERT INTO session_notes (session_id, trainer_id, notes, version, is_finalized, created_at, updated_at)
        SELECT DISTINCT 
            sr.session_id,
            ts.trainer_id,
            sr.session_notes,
            1,
            'false',
            CASE WHEN sr.session_notes IS NOT NULL THEN sr.created_at ELSE NOW() END,
            CASE WHEN sr.session_notes IS NOT NULL THEN sr.updated_at ELSE NOW() END
        FROM session_reports sr
        JOIN training_sessions ts ON sr.session_id = ts.id
        WHERE sr.session_notes IS NOT NULL
        ON CONFLICT DO NOTHING
    """)
    
    # 4. Drop session_notes column from session_reports table
    op.drop_column('session_reports', 'session_notes')


def downgrade() -> None:
    """Downgrade schema - Move session notes back to session_reports table"""
    
    # 1. Add session_notes column back to session_reports
    op.add_column(
        'session_reports',
        sa.Column('session_notes', sa.Text(), nullable=True)
    )
    
    # 2. Migrate notes back from session_notes table to session_reports
    op.execute("""
        UPDATE session_reports sr
        SET session_notes = sn.notes
        FROM session_notes sn
        WHERE sr.session_id = sn.session_id
        AND sn.is_finalized = 'false'
    """)
    
    # 3. Drop session_notes table
    op.drop_index(op.f('ix_session_notes_trainer_id'), table_name='session_notes')
    op.drop_index(op.f('ix_session_notes_session_id'), table_name='session_notes')
    op.drop_index(op.f('ix_session_notes_id'), table_name='session_notes')
    op.drop_table('session_notes')
