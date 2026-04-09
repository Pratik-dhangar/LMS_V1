"""Add unique constraint on appointments to prevent double-booking

This migration adds a unique index on (coach_id, scheduled_date, scheduled_time)
to prevent race conditions where multiple users can book the same time slot concurrently.
The index is partial and only includes active/pending appointments.

Revision ID: 202604091000
Revises: 202604081000
Create Date: 2026-04-09 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '202604091000'
down_revision = '202604081000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create a partial unique index to prevent double-booking on the same time slot
    # This covers: coach_id, date, time for PENDING, CONFIRMED, GUEST_INTENT, PAYMENT_PENDING, VERIFICATION_PENDING
    # Using raw SQL because SQLAlchemy's UniqueConstraint doesn't support WHERE clauses
    # Note: Cannot use CONCURRENTLY inside transaction block, using regular CREATE UNIQUE INDEX
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_coach_date_time_active 
        ON appointments(coach_id, scheduled_date, scheduled_time)
        WHERE status IN ('PENDING', 'CONFIRMED', 'GUEST_INTENT', 'PAYMENT_PENDING', 'VERIFICATION_PENDING')
        """
    )


def downgrade() -> None:
    # Drop the partial unique index
    op.execute("DROP INDEX IF EXISTS uq_appointments_coach_date_time_active")
