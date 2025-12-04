"""Add passcode_hash column for bcrypt hashes

Revision ID: e8d7c6b5a4f3
Revises: a9f8b7c6d5e4
Create Date: 2025-12-03 00:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e8d7c6b5a4f3'
down_revision = 'a9f8b7c6d5e4'
branch_labels = None
depends_on = None


def upgrade():
    # Add passcode_hash column to store bcrypt hashes
    # Temporarily nullable, will be populated from current passcode values
    op.add_column('users', sa.Column('passcode_hash', sa.String(60), nullable=True, index=True))


def downgrade():
    # Remove passcode_hash column
    op.drop_column('users', 'passcode_hash')
