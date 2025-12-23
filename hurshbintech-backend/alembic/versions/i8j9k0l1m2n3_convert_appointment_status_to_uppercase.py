"""convert appointment status to uppercase and add guest booking enum values

Revision ID: i8j9k0l1m2n3
Revises: h7i8j9k0l1m2
Create Date: 2025-12-23 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'i8j9k0l1m2n3'
down_revision: Union[str, Sequence[str], None] = 'h7i8j9k0l1m2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - convert existing lowercase enum values to UPPERCASE and add guest status values."""
    
    # Step 1: Convert the status column to VARCHAR temporarily to allow any value
    op.execute("""
        ALTER TABLE appointments
        ALTER COLUMN status TYPE VARCHAR(50)
    """)
    
    # Step 2: Update all existing values to uppercase
    op.execute("""
        UPDATE appointments
        SET status = UPPER(status)
        WHERE status IS NOT NULL
    """)
    
    # Step 3: Create the new enum type with all values (old + new) in UPPERCASE
    op.execute("""
        CREATE TYPE appointmentstatus_new AS ENUM (
            'PENDING',
            'CONFIRMED', 
            'CANCELLED',
            'COMPLETED',
            'NO_SHOW',
            'REJECTED',
            'GUEST_INTENT',
            'PAYMENT_PENDING',
            'VERIFICATION_PENDING'
        )
    """)
    
    # Step 4: Convert the status column back to the new enum type
    op.execute("""
        ALTER TABLE appointments
        ALTER COLUMN status TYPE appointmentstatus_new USING status::appointmentstatus_new
    """)
    
    # Step 5: Drop the old enum and rename the new one
    op.execute("DROP TYPE appointmentstatus")
    op.execute("ALTER TYPE appointmentstatus_new RENAME TO appointmentstatus")


def downgrade() -> None:
    """Downgrade schema - revert to lowercase enum values and remove guest booking values."""
    
    # Step 1: Create the old enum type with only the original values
    op.execute("""
        CREATE TYPE appointmentstatus_old AS ENUM (
            'pending',
            'confirmed',
            'cancelled',
            'completed',
            'no_show',
            'rejected'
        )
    """)
    
    # Step 2: Convert UPPERCASE values back to lowercase
    op.execute("""
        UPDATE appointments
        SET status = 'pending'
        WHERE status IN ('PENDING', 'pending')
    """)
    
    op.execute("""
        UPDATE appointments
        SET status = 'confirmed'
        WHERE status IN ('CONFIRMED', 'confirmed')
    """)
    
    op.execute("""
        UPDATE appointments
        SET status = 'cancelled'
        WHERE status IN ('CANCELLED', 'cancelled')
    """)
    
    op.execute("""
        UPDATE appointments
        SET status = 'completed'
        WHERE status IN ('COMPLETED', 'completed')
    """)
    
    op.execute("""
        UPDATE appointments
        SET status = 'no_show'
        WHERE status IN ('NO_SHOW', 'no_show')
    """)
    
    op.execute("""
        UPDATE appointments
        SET status = 'rejected'
        WHERE status IN ('REJECTED', 'rejected')
    """)
    
    # Remove any guest booking statuses by setting them to 'pending'
    op.execute("""
        UPDATE appointments
        SET status = 'pending'
        WHERE status IN ('GUEST_INTENT', 'PAYMENT_PENDING', 'VERIFICATION_PENDING')
    """)
    
    # Step 3: Convert the status column back to the old enum type
    op.execute("""
        ALTER TABLE appointments
        ALTER COLUMN status TYPE appointmentstatus_old USING status::text::appointmentstatus_old
    """)
    
    # Step 4: Drop the current enum and rename the old one
    op.execute("DROP TYPE appointmentstatus")
    op.execute("ALTER TYPE appointmentstatus_old RENAME TO appointmentstatus")
