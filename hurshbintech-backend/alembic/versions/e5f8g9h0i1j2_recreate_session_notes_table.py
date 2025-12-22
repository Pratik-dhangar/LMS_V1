"""Recreate session_notes table after accidental drop

Revision ID: e5f8g9h0i1j2
Revises: d10f77230d5b
Create Date: 2025-12-22 09:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f8g9h0i1j2'
down_revision: Union[str, Sequence[str], None] = 'd10f77230d5b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - recreate session_notes and head_session_notes tables."""
    op.create_table('session_notes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('session_id', sa.Integer(), nullable=False),
    sa.Column('trainer_id', sa.Integer(), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('is_finalized', sa.String(length=10), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['training_sessions.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['trainer_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_session_notes_id'), 'session_notes', ['id'], unique=False)
    op.create_index(op.f('ix_session_notes_session_id'), 'session_notes', ['session_id'], unique=False)
    op.create_index(op.f('ix_session_notes_trainer_id'), 'session_notes', ['trainer_id'], unique=False)
    
    op.create_table('head_session_notes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('session_id', sa.Integer(), nullable=False),
    sa.Column('head_id', sa.Integer(), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('is_finalized', sa.String(length=10), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['training_sessions.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['head_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_head_session_notes_id'), 'head_session_notes', ['id'], unique=False)
    op.create_index(op.f('ix_head_session_notes_session_id'), 'head_session_notes', ['session_id'], unique=False)
    op.create_index(op.f('ix_head_session_notes_head_id'), 'head_session_notes', ['head_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_head_session_notes_head_id'), table_name='head_session_notes')
    op.drop_index(op.f('ix_head_session_notes_session_id'), table_name='head_session_notes')
    op.drop_index(op.f('ix_head_session_notes_id'), table_name='head_session_notes')
    op.drop_table('head_session_notes')
    
    op.drop_index(op.f('ix_session_notes_trainer_id'), table_name='session_notes')
    op.drop_index(op.f('ix_session_notes_session_id'), table_name='session_notes')
    op.drop_index(op.f('ix_session_notes_id'), table_name='session_notes')
    op.drop_table('session_notes')
