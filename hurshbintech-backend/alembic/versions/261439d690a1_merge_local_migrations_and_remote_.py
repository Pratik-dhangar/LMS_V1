"""merge local migrations and remote migrations

Revision ID: 261439d690a1
Revises: 7d8e9f0a1b2c, d24a3be24e8f
Create Date: 2025-12-20 19:23:12.787989

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '261439d690a1'
down_revision: Union[str, Sequence[str], None] = ('7d8e9f0a1b2c', 'd24a3be24e8f')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
