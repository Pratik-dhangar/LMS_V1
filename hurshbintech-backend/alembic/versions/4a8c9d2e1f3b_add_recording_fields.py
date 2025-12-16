"""Add recording fields to training_sessions

Revision ID: 4a8c9d2e1f3b
Revises: 3875ef5357fb
Create Date: 2025-12-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4a8c9d2e1f3b'
down_revision: Union[str, Sequence[str], None] = '3875ef5357fb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add recording-related columns to training_sessions table"""
    
    # Add recording_url column
    op.add_column(
        'training_sessions',
        sa.Column('recording_url', sa.String(length=500), nullable=True, comment='Storage path/key for session recording')
    )
    
    # Add recording_status column
    op.add_column(
        'training_sessions',
        sa.Column('recording_status', sa.String(length=50), nullable=True, server_default='pending', comment='Recording status: pending, processing, completed, failed')
    )
    
    # Add recording_uploaded_at column
    op.add_column(
        'training_sessions',
        sa.Column('recording_uploaded_at', sa.DateTime(), nullable=True, comment='When recording was successfully stored')
    )
    
    # Create index on recording_status for faster queries
    op.create_index('ix_training_sessions_recording_status', 'training_sessions', ['recording_status'])


def downgrade() -> None:
    """Remove recording-related columns from training_sessions table"""
    
    # Drop index
    op.drop_index('ix_training_sessions_recording_status', 'training_sessions')
    
    # Drop columns
    op.drop_column('training_sessions', 'recording_uploaded_at')
    op.drop_column('training_sessions', 'recording_status')
    op.drop_column('training_sessions', 'recording_url')
