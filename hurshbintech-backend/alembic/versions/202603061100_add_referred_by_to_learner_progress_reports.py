"""add_referred_by_to_learner_progress_reports

Revision ID: 202603061100
Revises: 202603051000
Create Date: 2026-03-06 11:00:00.000000

This migration adds the referred_by column to learner_progress_reports table:
- referred_by: String field (255 chars) to store the referrer/source information for the learner
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202603061100"
down_revision = "202603051000"
branch_labels = None
depends_on = None


def upgrade():
    """Add referred_by field to learner_progress_reports table."""
    op.add_column(
        "learner_progress_reports",
        sa.Column("referred_by", sa.String(255), nullable=True),
    )


def downgrade():
    """Remove the referred_by column."""
    op.drop_column("learner_progress_reports", "referred_by")
