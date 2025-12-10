"""add_session_tracking_columns

Revision ID: 250f6efd5979
Revises: c8fc90759ada
Create Date: 2025-12-09 21:32:13.579416

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '250f6efd5979'
down_revision: Union[str, Sequence[str], None] = 'c8fc90759ada'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add new columns to training_sessions table
    op.add_column('training_sessions', sa.Column('total_duration', sa.Integer(), nullable=True, comment='Total duration of session in minutes'))
    op.add_column('training_sessions', sa.Column('learner_name', sa.String(length=255), nullable=True, comment='Cached learner name for quick access'))
    op.add_column('training_sessions', sa.Column('session_start_time', sa.DateTime(), nullable=True, comment='When session was actually started by trainer'))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove added columns
    op.drop_column('training_sessions', 'session_start_time')
    op.drop_column('training_sessions', 'learner_name')
    op.drop_column('training_sessions', 'total_duration')
