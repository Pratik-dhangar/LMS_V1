"""add_guest_booking_support

Revision ID: h7i8j9k0l1m2
Revises: e5f8g9h0i1j2
Create Date: 2025-12-20 10:45:30.123456

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'h7i8j9k0l1m2'
down_revision: Union[str, Sequence[str], None] = 'e5f8g9h0i1j2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add guest booking support."""
    
    # Check if enum exists, if not create it with all values
    connection = op.get_bind()
    
    # Check if appointmentstatus enum exists
    result = connection.execute(sa.text("""
        SELECT EXISTS (
            SELECT 1 FROM pg_type WHERE typname = 'appointmentstatus'
        )
    """))
    enum_exists = result.scalar()
    
    if not enum_exists:
        # Create AppointmentStatus enum with all values including guest-related statuses
        appointment_status_enum = postgresql.ENUM(
            'pending',
            'confirmed', 
            'rescheduled',
            'completed',
            'cancelled',
            'rejected',
            'payment_received',
            'guest_intent',
            'payment_pending',
            'verification_pending',
            name='appointmentstatus'
        )
        appointment_status_enum.create(op.get_bind())
    else:
        # If enum exists, add missing values using ALTER TYPE
        try:
            op.execute(sa.text("ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS 'guest_intent'"))
        except:
            pass
        try:
            op.execute(sa.text("ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS 'payment_pending'"))
        except:
            pass
        try:
            op.execute(sa.text("ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS 'verification_pending'"))
        except:
            pass
    
    # Modify appointments table to support guests
    # Make user_id nullable to support guest bookings
    op.alter_column('appointments', 'user_id',
               existing_type=sa.Integer(),
               nullable=True,
               existing_nullable=False)
    
    # Add guest-specific columns
    op.add_column('appointments', sa.Column('guest_name', sa.String(length=100), nullable=True))
    op.add_column('appointments', sa.Column('guest_email', sa.String(length=255), nullable=True))
    op.add_column('appointments', sa.Column('guest_phone', sa.String(length=20), nullable=True))
    op.add_column('appointments', sa.Column('upload_token', sa.String(length=255), nullable=True, unique=True))
    op.add_column('appointments', sa.Column('upload_token_expires_at', sa.DateTime(timezone=True), nullable=True))
    
    # Create index on upload_token for fast lookups
    op.create_index(op.f('ix_appointments_upload_token'), 'appointments', ['upload_token'], unique=False)
    
    # Create GuestOTP table for temporary OTP storage
    op.create_table(
        'guest_otps',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('otp_code', sa.String(length=6), nullable=False),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create index on email for fast OTP lookup
    op.create_index(op.f('ix_guest_otps_email'), 'guest_otps', ['email'], unique=False)
    
    # Create index on expires_at for cleanup queries
    op.create_index(op.f('ix_guest_otps_expires_at'), 'guest_otps', ['expires_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema - Remove guest booking support."""
    
    # Drop guest_otps table and indexes
    op.drop_index(op.f('ix_guest_otps_expires_at'), table_name='guest_otps')
    op.drop_index(op.f('ix_guest_otps_email'), table_name='guest_otps')
    op.drop_table('guest_otps')
    
    # Drop appointments table indexes and columns
    op.drop_index(op.f('ix_appointments_upload_token'), table_name='appointments')
    op.drop_column('appointments', 'upload_token_expires_at')
    op.drop_column('appointments', 'upload_token')
    op.drop_column('appointments', 'guest_phone')
    op.drop_column('appointments', 'guest_email')
    op.drop_column('appointments', 'guest_name')
    
    # Revert user_id back to NOT NULL
    op.alter_column('appointments', 'user_id',
               existing_type=sa.Integer(),
               nullable=False,
               existing_nullable=True)
    
    # NOTE: Do NOT drop the appointmentstatus enum
    # Other migrations may depend on it, and PostgreSQL doesn't allow
    # removing enum values anyway. The enum will remain in the database.

