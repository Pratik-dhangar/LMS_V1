"""Increase passcode column length for encryption

Revision ID: f9e8d7c6b5a4
Revises: e8d7c6b5a4f3
Create Date: 2025-12-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f9e8d7c6b5a4'
down_revision = 'e8d7c6b5a4f3'
branch_labels = None
depends_on = None


def upgrade():
    # Increase passcode column length to accommodate Fernet encrypted data
    op.alter_column('users', 'passcode',
                    existing_type=sa.String(20),
                    type_=sa.String(255),
                    existing_nullable=False)


def downgrade():
    # Revert passcode column to original length
    op.alter_column('users', 'passcode',
                    existing_type=sa.String(255),
                    type_=sa.String(20),
                    existing_nullable=False)
