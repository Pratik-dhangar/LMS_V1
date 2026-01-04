"""add guest session token to appointments

Revision ID: guest_session_001
Revises: 
Create Date: 2026-01-04

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'guest_session_001'
down_revision = None  # Update this to your latest migration
branch_labels = None
depends_on = None


def upgrade():
    # Add guest_session_token and guest_session_token_expires_at columns to appointments table
    op.add_column('appointments', sa.Column('guest_session_token', sa.String(length=100), nullable=True))
    op.add_column('appointments', sa.Column('guest_session_token_expires_at', sa.DateTime(), nullable=True))
    
    # Create unique index on guest_session_token
    op.create_index(op.f('ix_appointments_guest_session_token'), 'appointments', ['guest_session_token'], unique=True)


def downgrade():
    # Drop index and columns
    op.drop_index(op.f('ix_appointments_guest_session_token'), table_name='appointments')
    op.drop_column('appointments', 'guest_session_token_expires_at')
    op.drop_column('appointments', 'guest_session_token')
