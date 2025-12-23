"""make user_role nullable for guest appointments

Revision ID: j9k0l1m2n3o4
Revises: i8j9k0l1m2n3
Create Date: 2025-12-23 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'j9k0l1m2n3o4'
down_revision: Union[str, Sequence[str], None] = 'i8j9k0l1m2n3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Make user_role nullable to support guest appointments."""
    op.alter_column('appointments', 'user_role',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_nullable=False)


def downgrade() -> None:
    """Make user_role not nullable again."""
    # Set any NULL values to a default before making not nullable
    op.execute("UPDATE appointments SET user_role = 'LEARNER' WHERE user_role IS NULL")
    
    op.alter_column('appointments', 'user_role',
               existing_type=sa.VARCHAR(length=20),
               nullable=False,
               existing_nullable=True)
