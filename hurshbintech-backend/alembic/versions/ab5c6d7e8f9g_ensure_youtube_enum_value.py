"""Ensure YOUTUBE value exists in contenttype enum

Revision ID: ab5c6d7e8f9g
Revises: aa4b5c6d7e8f
Create Date: 2026-01-20 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ab5c6d7e8f9g'
down_revision = 'aa4b5c6d7e8f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Check if youtube value exists in contenttype enum, if not add it
    # This is a safety migration to ensure the enum is properly configured
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum 
                WHERE enumlabel = 'youtube' AND enumtypid = (
                    SELECT oid FROM pg_type WHERE typname = 'contenttype'
                )
            ) THEN
                ALTER TYPE contenttype ADD VALUE 'youtube';
            END IF;
        END
        $$;
    """)


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values
    # This migration is for ensuring the enum value exists, so nothing to do on downgrade
    pass
