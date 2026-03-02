"""make_reinforcement_meter_nullable_in_session_reports

Revision ID: 202602261000
Revises: 202602221000
Create Date: 2026-02-26 10:00:00.000000

Changes
  - Makes `reinforcement_meter` column nullable in `session_reports` table.
    Session reports are now generated based on Prompt value only; the
    Reinforcement Meter is no longer required when saving a report.
  - The column is kept for backward compatibility with existing data.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = "202602261000"
down_revision = "202602221000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make reinforcement_meter nullable - prompt value is now the sole required field
    op.alter_column(
        "session_reports",
        "reinforcement_meter",
        existing_type=sa.String(length=10),
        nullable=True,
    )


def downgrade() -> None:
    # Revert: make reinforcement_meter non-nullable again
    # Note: rows with NULL reinforcement_meter will need to be updated first
    op.alter_column(
        "session_reports",
        "reinforcement_meter",
        existing_type=sa.String(length=10),
        nullable=False,
    )
