"""merge_multiple_heads

Revision ID: c8fc90759ada
Revises: session_reports_001, e7a9b8c6d5f4, f9e8d7c6b5a4
Create Date: 2025-12-09 21:32:03.744559

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8fc90759ada'
down_revision: Union[str, Sequence[str], None] = ('session_reports_001', 'e7a9b8c6d5f4', 'f9e8d7c6b5a4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
