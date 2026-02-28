"""add_pdf_url_to_learner_progress_reports

Revision ID: 202602271100
Revises: 202602271000
Create Date: 2026-02-27 11:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202602271100"
down_revision = "202602271000"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "learner_progress_reports",
        sa.Column("pdf_url", sa.String(1024), nullable=True),
    )


def downgrade():
    op.drop_column("learner_progress_reports", "pdf_url")
