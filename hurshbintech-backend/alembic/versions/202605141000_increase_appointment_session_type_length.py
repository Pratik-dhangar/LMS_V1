"""Increase appointment session_type length to 255

Revision ID: 202605141000
Revises: 202605131000
Create Date: 2026-05-14 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '202605141000'
down_revision = '202605131000'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'appointments',
        'session_type',
        existing_type=sa.String(length=50),
        type_=sa.String(length=255),
        existing_nullable=True,
    )


def downgrade():
    op.alter_column(
        'appointments',
        'session_type',
        existing_type=sa.String(length=255),
        type_=sa.String(length=50),
        existing_nullable=True,
    )