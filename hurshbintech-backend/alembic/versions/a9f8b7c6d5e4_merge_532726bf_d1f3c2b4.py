"""Merge heads: 532726bf0529, d1f3c2b4e5f6

Revision ID: a9f8b7c6d5e4
Revises: 532726bf0529, d1f3c2b4e5f6
Create Date: 2025-12-03 00:10:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a9f8b7c6d5e4'
down_revision = ('532726bf0529', 'd1f3c2b4e5f6')
branch_labels = None
depends_on = None


def upgrade():
    # This is a merge revision to combine two separate migration heads.
    pass


def downgrade():
    # Downgrade is a no-op for the merge revision.
    pass
