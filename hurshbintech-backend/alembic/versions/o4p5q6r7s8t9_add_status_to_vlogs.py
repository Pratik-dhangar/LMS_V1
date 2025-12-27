"""add_status_to_vlogs

Revision ID: o4p5q6r7s8t9
Revises: db3eb5736338
Create Date: 2025-12-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'o4p5q6r7s8t9'
down_revision: Union[str, Sequence[str], None] = 'db3eb5736338'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add status column to vlogs table with default DRAFT."""
    # Create the enum type
    op.execute("CREATE TYPE vlogstatus AS ENUM ('draft', 'published')")
    
    # Add status column with default value
    op.add_column('vlogs',
        sa.Column('status', sa.Enum('draft', 'published', name='vlogstatus'),
                  nullable=False, server_default='draft')
    )


def downgrade() -> None:
    """Remove status column from vlogs table."""
    # Drop the status column
    op.drop_column('vlogs', 'status')
    
    # Drop the enum type
    op.execute("DROP TYPE IF EXISTS vlogstatus")
