"""add_trainers_ilp_permission

Revision ID: 20260521
Revises: 202605112000
Create Date: 2026-05-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260521"
down_revision: Union[str, Sequence[str], None] = "202605112000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'head_profiles'
                  AND column_name = 'can_trainers_schedule_ilp'
            ) THEN
                ALTER TABLE head_profiles
                ADD COLUMN can_trainers_schedule_ilp BOOLEAN NOT NULL DEFAULT FALSE;
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'head_profiles'
                  AND column_name = 'can_trainers_schedule_ilp'
            ) THEN
                ALTER TABLE head_profiles
                DROP COLUMN can_trainers_schedule_ilp;
            END IF;
        END
        $$;
        """
    )
