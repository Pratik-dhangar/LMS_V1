"""add_session_feedback_table

Revision ID: fc0312361c66
Revises: 202603061100
Create Date: 2026-03-09 10:16:33.709865

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'fc0312361c66'
down_revision: Union[str, Sequence[str], None] = '202603061100'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'session_feedback',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('attendee_id', sa.Integer(), nullable=True),
        sa.Column('attendee_name', sa.String(length=255), nullable=True),
        sa.Column('attendee_role', sa.String(length=50), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('remark', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['attendee_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['session_id'], ['training_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_session_feedback_id'), 'session_feedback', ['id'], unique=False)
    op.create_index(op.f('ix_session_feedback_session_id'), 'session_feedback', ['session_id'], unique=False)
    op.create_index(op.f('ix_session_feedback_attendee_id'), 'session_feedback', ['attendee_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_session_feedback_attendee_id'), table_name='session_feedback')
    op.drop_index(op.f('ix_session_feedback_session_id'), table_name='session_feedback')
    op.drop_index(op.f('ix_session_feedback_id'), table_name='session_feedback')
    op.drop_table('session_feedback')
