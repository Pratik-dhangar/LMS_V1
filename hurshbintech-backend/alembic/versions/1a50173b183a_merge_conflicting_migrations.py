"""merge conflicting migrations

Revision ID: 1a50173b183a
Revises: 0329c5805c7b, dfbd0171d916
Create Date: 2025-12-18 13:07:27.116816

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1a50173b183a'
down_revision: Union[str, Sequence[str], None] = ('0329c5805c7b', 'dfbd0171d916')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
