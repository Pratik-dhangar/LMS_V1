"""Normalize contenttype enum label for YouTube

Revision ID: 202603231030
Revises: 202603231000
Create Date: 2026-03-23 10:30:00.000000
"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "202603231030"
down_revision: Union[str, Sequence[str], None] = "202603231000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Ensure contenttype enum uses uppercase YOUTUBE label expected by SQLAlchemy."""
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'youtube'
                  AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'contenttype')
            ) AND NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'YOUTUBE'
                  AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'contenttype')
            ) THEN
                ALTER TYPE contenttype RENAME VALUE 'youtube' TO 'YOUTUBE';
            ELSIF NOT EXISTS (
                SELECT 1
                FROM pg_enum
                WHERE enumlabel = 'YOUTUBE'
                  AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'contenttype')
            ) THEN
                ALTER TYPE contenttype ADD VALUE 'YOUTUBE';
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
                FROM pg_enum
                WHERE enumlabel = 'youtube'
                  AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'contenttype')
            ) THEN
                UPDATE learning_contents
                SET content_type = 'YOUTUBE'::contenttype
                WHERE content_type::text = 'youtube';
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    """No-op downgrade: enum value renames should not be reversed in production."""
    pass
