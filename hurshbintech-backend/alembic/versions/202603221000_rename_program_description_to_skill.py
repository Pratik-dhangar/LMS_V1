"""rename_program_description_to_skill

Revision ID: 202603221000
Revises: 202603211000
Create Date: 2026-03-22 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "202603221000"
down_revision: Union[str, Sequence[str], None] = "202603211000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'programs'
                  AND column_name = 'description'
            )
            AND NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'programs'
                  AND column_name = 'skill'
            ) THEN
                ALTER TABLE programs
                RENAME COLUMN description TO skill;
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
                WHERE table_name = 'programs'
                  AND column_name = 'skill'
            )
            AND NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'programs'
                  AND column_name = 'description'
            ) THEN
                ALTER TABLE programs
                RENAME COLUMN skill TO description;
            END IF;
        END
        $$;
        """
    )
