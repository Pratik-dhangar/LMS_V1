"""Add subscription session tracking to training sessions

Revision ID: a4b5c6d7e8f9
Revises: 20260130_webinar
Create Date: 2026-02-02 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a4b5c6d7e8f9'
down_revision = '20260130_webinar'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add subscription tracking columns to training_sessions table"""
    
    # Add subscription_id foreign key column
    op.add_column(
        'training_sessions',
        sa.Column(
            'subscription_id',
            sa.Integer(),
            nullable=True,
            comment='Linked learner subscription for session count tracking'
        )
    )
    
    # Add session_counted flag for idempotent processing
    op.add_column(
        'training_sessions',
        sa.Column(
            'session_counted',
            sa.Integer(),
            nullable=False,
            server_default='0',
            comment='Has this ended session been counted towards subscription usage?'
        )
    )
    
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_training_sessions_subscription_id',
        'training_sessions',
        'learner_subscriptions',
        ['subscription_id'],
        ['id'],
        ondelete='SET NULL'
    )
    
    # Add index for performance optimization
    op.create_index(
        'idx_training_sessions_subscription_id',
        'training_sessions',
        ['subscription_id']
    )
    
    # Add composite index for efficient querying of unprocessed sessions
    op.create_index(
        'idx_training_sessions_status_counted',
        'training_sessions',
        ['status', 'session_counted']
    )


def downgrade() -> None:
    """Remove subscription tracking columns from training_sessions table"""
    
    # Drop indexes
    op.drop_index('idx_training_sessions_status_counted', table_name='training_sessions')
    op.drop_index('idx_training_sessions_subscription_id', table_name='training_sessions')
    
    # Drop foreign key constraint
    op.drop_constraint('fk_training_sessions_subscription_id', 'training_sessions', type_='foreignkey')
    
    # Drop columns
    op.drop_column('training_sessions', 'session_counted')
    op.drop_column('training_sessions', 'subscription_id')
