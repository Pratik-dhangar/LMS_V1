"""add_free_appointments_table

Revision ID: 20260602_02
Revises: 20260602_01
Create Date: 2026-06-02

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260602_02"
down_revision = "20260602_01"
branch_labels = None
depends_on = None


def upgrade():
    # Create free_appointments table
    op.create_table(
        "free_appointments",

        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),

        sa.Column("child_name", sa.String(length=255), nullable=False),

        sa.Column("age", sa.Integer(), nullable=False),

        sa.Column("concerns", sa.String(length=500), nullable=False),

        sa.Column("diagnosis", sa.String(length=500), nullable=True),

        sa.Column("address", sa.String(length=500), nullable=False),

        sa.Column("contact_number", sa.String(length=20), nullable=False),

        sa.Column("reference_by", sa.String(length=255), nullable=True),

        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False
        ),
    )

    # Create indexes
    op.create_index(
        "ix_free_appointments_child_name",
        "free_appointments",
        ["child_name"]
    )

    op.create_index(
        "ix_free_appointments_contact_number",
        "free_appointments",
        ["contact_number"]
    )

    op.create_index(
        "ix_free_appointments_created_at",
        "free_appointments",
        ["created_at"]
    )


def downgrade():
    # Drop indexes
    op.drop_index(
        "ix_free_appointments_created_at",
        table_name="free_appointments"
    )

    op.drop_index(
        "ix_free_appointments_contact_number",
        table_name="free_appointments"
    )

    op.drop_index(
        "ix_free_appointments_child_name",
        table_name="free_appointments"
    )

    # Drop table
    op.drop_table("free_appointments")
