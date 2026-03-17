"""create_free_assessments_table

Revision ID: b8bfdcd7973d
Revises: 202603151000
Create Date: 2026-03-17 11:15:22.657950

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8bfdcd7973d'
down_revision: Union[str, Sequence[str], None] = '202603151000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "free_assessments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("child_name", sa.String(length=255), nullable=False),
        sa.Column("child_age", sa.String(length=50), nullable=True),
        sa.Column("date_of_assessment", sa.Date(), nullable=True),
        sa.Column("mother_name", sa.String(length=255), nullable=True),
        sa.Column("mother_age", sa.String(length=50), nullable=True),
        sa.Column("mother_education", sa.String(length=255), nullable=True),
        sa.Column("mother_profession", sa.String(length=255), nullable=True),
        sa.Column("mother_contact", sa.String(length=30), nullable=True),
        sa.Column("mother_email", sa.String(length=255), nullable=True),
        sa.Column("father_name", sa.String(length=255), nullable=True),
        sa.Column("father_age", sa.String(length=50), nullable=True),
        sa.Column("father_education", sa.String(length=255), nullable=True),
        sa.Column("father_profession", sa.String(length=255), nullable=True),
        sa.Column("father_contact", sa.String(length=30), nullable=True),
        sa.Column("father_email", sa.String(length=255), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("siblings", sa.String(length=255), nullable=True),
        sa.Column("sibling_age", sa.String(length=50), nullable=True),
        sa.Column("selected_disorders", sa.JSON(), nullable=False),
        sa.Column("medical_baby_scream", sa.Text(), nullable=True),
        sa.Column("medical_difficult_sleep", sa.Text(), nullable=True),
        sa.Column("medical_routine_change", sa.Text(), nullable=True),
        sa.Column("medical_food_habit_shift", sa.Text(), nullable=True),
        sa.Column("medical_physical_milestones", sa.Text(), nullable=True),
        sa.Column("medical_language_milestones", sa.Text(), nullable=True),
        sa.Column("medical_major_illness", sa.Text(), nullable=True),
        sa.Column("medical_specific_details", sa.Text(), nullable=True),
        sa.Column("learning_school_years", sa.String(length=100), nullable=True),
        sa.Column("learning_support", sa.Text(), nullable=True),
        sa.Column("learning_current_grade", sa.String(length=100), nullable=True),
        sa.Column("learning_scenario", sa.Text(), nullable=True),
        sa.Column("intervention_history", sa.Text(), nullable=True),
        sa.Column("skills", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_free_assessments_child_name"), "free_assessments", ["child_name"], unique=False)
    op.create_index(op.f("ix_free_assessments_created_at"), "free_assessments", ["created_at"], unique=False)
    op.create_index(op.f("ix_free_assessments_father_contact"), "free_assessments", ["father_contact"], unique=False)
    op.create_index(op.f("ix_free_assessments_id"), "free_assessments", ["id"], unique=False)
    op.create_index(op.f("ix_free_assessments_mother_contact"), "free_assessments", ["mother_contact"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_free_assessments_mother_contact"), table_name="free_assessments")
    op.drop_index(op.f("ix_free_assessments_id"), table_name="free_assessments")
    op.drop_index(op.f("ix_free_assessments_father_contact"), table_name="free_assessments")
    op.drop_index(op.f("ix_free_assessments_created_at"), table_name="free_assessments")
    op.drop_index(op.f("ix_free_assessments_child_name"), table_name="free_assessments")
    op.drop_table("free_assessments")
