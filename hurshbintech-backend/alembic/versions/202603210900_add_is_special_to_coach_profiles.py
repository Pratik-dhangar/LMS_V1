"""add_is_special_to_coach_profiles

Revision ID: 202603210900
Revises: b8bfdcd7973d
Create Date: 2026-03-21 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "202603210900"
down_revision: Union[str, Sequence[str], None] = "b8bfdcd7973d"
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
                WHERE table_name = 'coach_profiles'
                  AND column_name = 'is_special'
            ) THEN
                ALTER TABLE coach_profiles
                ADD COLUMN is_special BOOLEAN NOT NULL DEFAULT FALSE;
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
                WHERE table_name = 'coach_profiles'
                  AND column_name = 'is_special'
            ) THEN
                ALTER TABLE coach_profiles
                DROP COLUMN is_special;
            END IF;
        END
        $$;
        """
    )
