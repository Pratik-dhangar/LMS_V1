"""drop_title_description_from_gallery

Revision ID: 202605111500
Revises: 202605111000
Create Date: 2026-05-11 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "202605111500"
down_revision: Union[str, Sequence[str], None] = "202605111000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop title and description columns from gallery table."""
    # Drop columns if they exist (safe to run against DB that might already have been altered)
    with op.batch_alter_table("gallery") as batch_op:
        try:
            batch_op.drop_column("title")
        except Exception:
            # Ignore if column does not exist
            pass
        try:
            batch_op.drop_column("description")
        except Exception:
            pass


def downgrade() -> None:
    """Add title and description columns back to gallery table."""
    with op.batch_alter_table("gallery") as batch_op:
        batch_op.add_column(sa.Column("title", sa.String(length=255), nullable=False, server_default=""))
        batch_op.add_column(sa.Column("description", sa.Text(), nullable=True))
