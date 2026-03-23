"""add_child_fields_to_contacts

Revision ID: 202603221200
Revises: 202603221100
Create Date: 2026-03-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "202603221200"
down_revision: Union[str, Sequence[str], None] = "202603221100"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("contacts", sa.Column("child_name", sa.String(length=255), nullable=True))
    op.add_column("contacts", sa.Column("child_age", sa.String(length=20), nullable=True))
    op.add_column("contacts", sa.Column("address", sa.Text(), nullable=True))
    op.create_index("ix_contacts_child_name", "contacts", ["child_name"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_contacts_child_name", table_name="contacts")
    op.drop_column("contacts", "address")
    op.drop_column("contacts", "child_age")
    op.drop_column("contacts", "child_name")
