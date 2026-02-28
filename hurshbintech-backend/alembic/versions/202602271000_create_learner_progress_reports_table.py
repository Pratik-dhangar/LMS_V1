"""create_learner_progress_reports_table

Revision ID: 202602271000
Revises: 202602261000
Create Date: 2026-02-27 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202602271000"
down_revision = "202602261000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "learner_progress_reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("learner_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("date_of_report", sa.Date(), nullable=False),
        sa.Column("birth_history", sa.Text(), nullable=True),
        sa.Column("attention_cooperation", sa.Text(), nullable=True),
        sa.Column("sensory_integration_motor", sa.Text(), nullable=True),
        sa.Column("speech_language_communication", sa.Text(), nullable=True),
        sa.Column("play_leisure", sa.Text(), nullable=True),
        sa.Column("social_interaction_group", sa.Text(), nullable=True),
        sa.Column("emotional_regulation", sa.Text(), nullable=True),
        sa.Column("independent_living", sa.Text(), nullable=True),
        sa.Column("academic_readiness", sa.Text(), nullable=True),
        sa.Column("professional_development", sa.Text(), nullable=True),
        sa.Column("recommendation", sa.Text(), nullable=True),
        sa.Column("conclusion", sa.Text(), nullable=True),
        sa.Column("report_created_by", sa.String(length=255), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["learner_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_learner_progress_reports_id"), "learner_progress_reports", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_learner_progress_reports_learner_id"),
        "learner_progress_reports",
        ["learner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_learner_progress_reports_created_by_id"),
        "learner_progress_reports",
        ["created_by_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_learner_progress_reports_created_by_id"), table_name="learner_progress_reports"
    )
    op.drop_index(
        op.f("ix_learner_progress_reports_learner_id"), table_name="learner_progress_reports"
    )
    op.drop_index(
        op.f("ix_learner_progress_reports_id"), table_name="learner_progress_reports"
    )
    op.drop_table("learner_progress_reports")
