"""add_delivery_instruction_to_learning_goals

Revision ID: 20260602
Revises: 20260524
Create Date: 2026-06-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260602"
down_revision: Union[str, Sequence[str], None] = "20260524"
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
                WHERE table_name = 'learning_goals'
                  AND column_name = 'delivery_instruction'
            ) THEN
                ALTER TABLE learning_goals
                ADD COLUMN delivery_instruction TEXT NULL;
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
                WHERE table_name = 'learning_goals'
                  AND column_name = 'delivery_instruction'
            ) THEN
                ALTER TABLE learning_goals
                DROP COLUMN delivery_instruction;
            END IF;
        END
        $$;
        """
    )