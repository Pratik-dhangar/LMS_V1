"""Add chunked recording support fields to training_sessions

Revision ID: 202603151000
Revises: 202603091000
Create Date: 2025-03-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '202603151000'
down_revision: Union[str, Sequence[str], None] = '202603121000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add chunked recording support fields to training_sessions table"""
    
    # Add recording_started_at column for chunked uploads
    op.add_column(
        'training_sessions',
        sa.Column(
            'recording_started_at', 
            sa.DateTime(), 
            nullable=True, 
            comment='When recording started (for chunked uploads)'
        )
    )
    
    # Add recording_duration column to track total recording time
    op.add_column(
        'training_sessions',
        sa.Column(
            'recording_duration', 
            sa.Integer(), 
            nullable=True, 
            comment='Total recording duration in seconds'
        )
    )
    
    # Update recording_status comment to include 'recording' state
    # This is informational - actual constraint update handled in model
    op.alter_column(
        'training_sessions',
        'recording_status',
        existing_type=sa.String(length=50),
        existing_comment='Recording status: pending, processing, completed, failed',
        new_comment='Recording status: pending, recording, processing, completed, failed',
        existing_nullable=True
    )
    
    # Create index on recording_started_at for faster queries on in-progress recordings
    op.create_index(
        'ix_training_sessions_recording_started_at', 
        'training_sessions', 
        ['recording_started_at'],
        unique=False
    )


def downgrade() -> None:
    """Remove chunked recording support fields from training_sessions table"""
    
    # Drop index
    op.drop_index('ix_training_sessions_recording_started_at', table_name='training_sessions')
    
    # Drop recording_started_at column
    op.drop_column('training_sessions', 'recording_started_at')
    
    # Drop recording_duration column
    op.drop_column('training_sessions', 'recording_duration')
    
    # Revert recording_status comment
    op.alter_column(
        'training_sessions',
        'recording_status',
        existing_type=sa.String(length=50),
        existing_comment='Recording status: pending, recording, processing, completed, failed',
        new_comment='Recording status: pending, processing, completed, failed',
        existing_nullable=True
    )
