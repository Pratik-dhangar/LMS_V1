"""add_trainer_ilp_override_permission

Revision ID: 20260524
Revises: 20260521
Create Date: 2026-05-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260524"
down_revision: Union[str, Sequence[str], None] = "20260521"
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
                WHERE table_name = 'trainer_profiles'
                  AND column_name = 'can_schedule_ilp'
            ) THEN
                ALTER TABLE trainer_profiles
                ADD COLUMN can_schedule_ilp BOOLEAN NULL;
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
                WHERE table_name = 'trainer_profiles'
                  AND column_name = 'can_schedule_ilp'
            ) THEN
                ALTER TABLE trainer_profiles
                DROP COLUMN can_schedule_ilp;
            END IF;
        END
        $$;
        """
    )
