"""Head Notes Table created

Revision ID: 0329c5805c7b
Revises: 5c1d2a3e4f5g
Create Date: 2025-12-18 00:17:24.363378

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0329c5805c7b'
down_revision: Union[str, Sequence[str], None] = '5c1d2a3e4f5g'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'head_session_notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('head_id', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('is_finalized', sa.String(length=10), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['head_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['session_id'], ['training_sessions.id'], ondelete='CASCADE'),
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
