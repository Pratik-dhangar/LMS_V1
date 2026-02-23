"""create programs table and add program_id to training_sessions

Revision ID: 202602221000
Revises: 202602211000
Create Date: 2026-02-22 10:00:00.000000

Changes:
  - Creates `programs` table (head-scoped, learner-scoped program container)
  - Adds nullable `program_id` FK column to `training_sessions`
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = "202602221000"
down_revision = "202602211000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Create programs table ──────────────────────────────────────────────
    op.create_table(
        "programs",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("name", sa.String(255), nullable=False, index=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "head_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column(
            "learner_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("goal_ids", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("content_ids", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=True,
            onupdate=sa.func.now(),
        ),
    )

    # ── 2. Add program_id FK to training_sessions ─────────────────────────────
    op.add_column(
        "training_sessions",
        sa.Column(
            "program_id",
            sa.Integer(),
            sa.ForeignKey("programs.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("training_sessions", "program_id")
    op.drop_table("programs")
