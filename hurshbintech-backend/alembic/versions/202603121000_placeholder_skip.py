"""Placeholder migration - skip

Revision ID: 202603121000
Revises: 202603091000
Create Date: 2025-03-12 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '202603121000'
down_revision: Union[str, Sequence[str], None] = '202603091000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Placeholder - no changes"""
    pass


def downgrade() -> None:
    """Placeholder - no changes"""
    pass
