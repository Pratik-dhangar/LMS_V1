"""add_target_user_ids_to_assigned_trainings

Revision ID: 20260608_01
Revises: 20260602_02
Create Date: 2026-06-08 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260608_01'
down_revision: Union[str, Sequence[str], None] = '20260602_02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add target_user_ids column to assigned_trainings table
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'assigned_trainings'
                  AND column_name = 'target_user_ids'
            ) THEN
                ALTER TABLE assigned_trainings
                ADD COLUMN target_user_ids JSON DEFAULT '[]'::json;
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    # Remove target_user_ids column from assigned_trainings table
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'assigned_trainings'
                  AND column_name = 'target_user_ids'
            ) THEN
                ALTER TABLE assigned_trainings
                DROP COLUMN target_user_ids;
            END IF;
        END
        $$;
        """
    )
