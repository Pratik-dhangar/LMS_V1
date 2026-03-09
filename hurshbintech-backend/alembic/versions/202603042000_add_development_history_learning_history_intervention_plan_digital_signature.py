"""add_development_history_learning_history_intervention_plan_digital_signature

Revision ID: 202603042000
Revises: 202602271100
Create Date: 2026-03-04 20:00:00.000000

This migration adds the following columns to learner_progress_reports table:
- development_history: Text field for developmental history
- learning_history: Text field for learning history  
- intervention_plan: Text field for immediate intervention plan
- digital_signature: String field for signature file reference
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202603042000"
down_revision = "202602271100"
branch_labels = None
depends_on = None


def upgrade():
    """Add new columns to learner_progress_reports table."""
    op.add_column(
        "learner_progress_reports",
        sa.Column("development_history", sa.Text, nullable=True),
    )
    op.add_column(
        "learner_progress_reports",
        sa.Column("learning_history", sa.Text, nullable=True),
    )
    op.add_column(
        "learner_progress_reports",
        sa.Column("intervention_plan", sa.Text, nullable=True),
    )
    op.add_column(
        "learner_progress_reports",
        sa.Column("digital_signature", sa.String(1024), nullable=True),
    )


def downgrade():
    """Remove the newly added columns."""
    op.drop_column("learner_progress_reports", "digital_signature")
    op.drop_column("learner_progress_reports", "intervention_plan")
    op.drop_column("learner_progress_reports", "learning_history")
    op.drop_column("learner_progress_reports", "development_history")
