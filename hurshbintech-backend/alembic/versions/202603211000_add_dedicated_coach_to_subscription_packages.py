"""add_dedicated_coach_to_subscription_packages

Revision ID: 202603211000
Revises: 202603210900
Create Date: 2026-03-21 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "202603211000"
down_revision: Union[str, Sequence[str], None] = "202603210900"
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
                WHERE table_name = 'subscription_packages'
                  AND column_name = 'dedicated_coach_id'
            ) THEN
                ALTER TABLE subscription_packages
                ADD COLUMN dedicated_coach_id INTEGER NULL;
            END IF;
        END
        $$;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.table_constraints tc
                WHERE tc.table_name = 'subscription_packages'
                  AND tc.constraint_type = 'FOREIGN KEY'
                  AND tc.constraint_name = 'fk_subscription_packages_dedicated_coach_id'
            ) THEN
                ALTER TABLE subscription_packages
                ADD CONSTRAINT fk_subscription_packages_dedicated_coach_id
                FOREIGN KEY (dedicated_coach_id)
                REFERENCES coach_profiles (id)
                ON DELETE SET NULL;
            END IF;
        END
        $$;
        """
    )

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_package_dedicated_coach
        ON subscription_packages (dedicated_coach_id);
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        """
        DROP INDEX IF EXISTS idx_package_dedicated_coach;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.table_constraints tc
                WHERE tc.table_name = 'subscription_packages'
                  AND tc.constraint_type = 'FOREIGN KEY'
                  AND tc.constraint_name = 'fk_subscription_packages_dedicated_coach_id'
            ) THEN
                ALTER TABLE subscription_packages
                DROP CONSTRAINT fk_subscription_packages_dedicated_coach_id;
            END IF;
        END
        $$;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'subscription_packages'
                  AND column_name = 'dedicated_coach_id'
            ) THEN
                ALTER TABLE subscription_packages
                DROP COLUMN dedicated_coach_id;
            END IF;
        END
        $$;
        """
    )
