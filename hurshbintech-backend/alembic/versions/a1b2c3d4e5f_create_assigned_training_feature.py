"""Create assigned training feature tables

Revision ID: a1b2c3d4e5f
Revises: x13y4z5a67b8
Create Date: 2026-01-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f'
down_revision: Union[str, Sequence[str], None] = 'x13y4z5a67b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Create assigned training tables."""
    
    # Create enums using raw SQL with IF NOT EXISTS check for PostgreSQL
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE trainingtype AS ENUM ('CUSTOM', 'PROGRAM', 'CONTENT', 'VLOG');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE training_status AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Check if assigned_trainings table exists, create only if it doesn't
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    
    if 'assigned_trainings' not in inspector.get_table_names():
        # Create assigned_trainings table
        op.create_table(
            'assigned_trainings',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('title', sa.String(255), nullable=False, index=True),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('training_type', sa.String(50), nullable=False, index=True),  # Use String instead of Enum
            sa.Column('custom_content', sa.Text(), nullable=True),
            sa.Column('training_ref_ids', sa.JSON(), nullable=True),
            sa.Column('target_roles', sa.JSON(), nullable=False),
            sa.Column('assigned_by_admin', sa.Integer(), nullable=True, index=True),
            sa.Column('start_date', sa.Date(), nullable=True, index=True),
            sa.Column('end_date', sa.Date(), nullable=True, index=True),
            sa.Column('duration_days', sa.Integer(), nullable=True),
            sa.Column('active', sa.Boolean(), nullable=False, server_default='true', index=True),
            sa.Column('custom_metadata', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, index=True),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['assigned_by_admin'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id')
        )
    
    if 'assigned_training_users' not in inspector.get_table_names():
        # Create assigned_training_users table
        op.create_table(
            'assigned_training_users',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('assigned_training_id', sa.Integer(), nullable=False, index=True),
            sa.Column('user_id', sa.Integer(), nullable=False, index=True),
            sa.Column('status', sa.String(50), nullable=False, index=True),  # Use String instead of Enum
            sa.Column('progress', sa.JSON(), nullable=True),
            sa.Column('started_at', sa.DateTime(), nullable=True),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
            sa.Column('evidence', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['assigned_training_id'], ['assigned_trainings.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )


def downgrade() -> None:
    """Downgrade schema - Drop assigned training tables and enums."""
    
    # Drop tables
    op.drop_table('assigned_training_users')
    op.drop_table('assigned_trainings')
    
    # Drop enums
    op.execute("""
        DO $$ BEGIN
            DROP TYPE IF EXISTS training_status;
        EXCEPTION WHEN undefined_object THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            DROP TYPE IF EXISTS trainingtype;
        EXCEPTION WHEN undefined_object THEN null;
        END $$;
    """)
