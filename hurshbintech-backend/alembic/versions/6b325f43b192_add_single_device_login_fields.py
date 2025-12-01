"""add_single_device_login_fields

Revision ID: 6b325f43b192
Revises: 8f2a87d3b95f
Create Date: 2025-11-27 23:15:42.752298

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6b325f43b192'
down_revision: Union[str, Sequence[str], None] = '8f2a87d3b95f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
