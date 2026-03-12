"""add_package_type_to_subscription_packages

Revision ID: 202603091000
Revises: fc0312361c66
Create Date: 2026-03-09 10:00:00.000000

This migration adds the package_type column to subscription_packages table:
- package_type: Enum (LEARNER, COACH) to distinguish learner vs coach packages
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "202603091000"
down_revision = "fc0312361c66"
branch_labels = None
depends_on = None


def upgrade():
    # Create the enum type first
    packagetype_enum = sa.Enum("LEARNER", "COACH", name="packagetype")
    packagetype_enum.create(op.get_bind(), checkfirst=True)

    # Add the package_type column with a default of LEARNER
    op.add_column(
        "subscription_packages",
        sa.Column(
            "package_type",
            sa.Enum("LEARNER", "COACH", name="packagetype"),
            nullable=False,
            server_default="LEARNER",
        ),
    )


def downgrade():
    op.drop_column("subscription_packages", "package_type")

    # Drop the enum type
    packagetype_enum = sa.Enum("LEARNER", "COACH", name="packagetype")
    packagetype_enum.drop(op.get_bind(), checkfirst=True)
