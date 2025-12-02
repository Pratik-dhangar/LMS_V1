"""add_performance_indexes

Revision ID: 532726bf0529
Revises: increase_passcode_length
Create Date: 2025-12-02 00:03:15.643439

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '532726bf0529'
down_revision: Union[str, Sequence[str], None] = 'increase_passcode_length'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add indexes for frequently queried columns on users table only."""
    
    # Users table - frequently queried by role and is_active
    # These indexes will significantly improve login and user queries
    op.create_index('ix_users_role', 'users', ['role'], unique=False)
    op.create_index('ix_users_is_active', 'users', ['is_active'], unique=False)
    op.create_index('ix_users_role_active', 'users', ['role', 'is_active'], unique=False)


def downgrade() -> None:
    """Remove performance indexes from users table."""
    
    # Drop users table indexes
    op.drop_index('ix_users_role_active', 'users')
    op.drop_index('ix_users_is_active', 'users')
    op.drop_index('ix_users_role', 'users')
