"""create learning_skills table

Revision ID: 202603301100
Revises: 202603231030
Create Date: 2026-03-30 11:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "202603301100"
down_revision: Union[str, Sequence[str], None] = "202603231030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "learning_skills",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("skill_name", sa.String(length=255), nullable=False),
        sa.Column("created_by_admin_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_learning_skills_id", "learning_skills", ["id"], unique=False)
    op.create_index("ix_learning_skills_skill_name", "learning_skills", ["skill_name"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_learning_skills_skill_name", table_name="learning_skills")
    op.drop_index("ix_learning_skills_id", table_name="learning_skills")
    op.drop_table("learning_skills")
