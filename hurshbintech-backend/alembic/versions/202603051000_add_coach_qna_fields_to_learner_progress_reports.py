"""add_coach_qna_fields_to_learner_progress_reports

Revision ID: 202603051000
Revises: 202603042000
Create Date: 2026-03-05 10:00:00.000000

This migration adds the following columns to learner_progress_reports table for coach support:
- report_type: String field to differentiate between 'head' and 'coach' reports
- coach_qna_data: JSON field to store dynamic question-answer pairs for coach reports
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202603051000"
down_revision = "202603042000"
branch_labels = None
depends_on = None


def upgrade():
    """Add coach Q&A fields to learner_progress_reports table."""
    op.add_column(
        "learner_progress_reports",
        sa.Column("report_type", sa.String(50), nullable=False, server_default="head"),
    )
    op.add_column(
        "learner_progress_reports",
        sa.Column("coach_qna_data", sa.JSON, nullable=True, server_default="[]"),
    )


def downgrade():
    """Remove the newly added columns."""
    op.drop_column("learner_progress_reports", "coach_qna_data")
    op.drop_column("learner_progress_reports", "report_type")
