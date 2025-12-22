"""add_rejection_fields_and_email_logs

Revision ID: 7d8e9f0a1b2c
Revises: 5c769fca3e15
Create Date: 2025-12-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7d8e9f0a1b2c'
down_revision: Union[str, Sequence[str], None] = '5c769fca3e15'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add rejection_reason column to appointments table
    op.add_column('appointments', sa.Column('rejection_reason', sa.Text(), nullable=True))
    
    # Add refund_receipt_url column to appointments table
    op.add_column('appointments', sa.Column('refund_receipt_url', sa.String(length=500), nullable=True))
    
    # Create email_logs table
    op.create_table(
        'email_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('recipient_email', sa.String(length=255), nullable=False),
        sa.Column('recipient_name', sa.String(length=255), nullable=False),
        sa.Column('subject', sa.String(length=255), nullable=False),
        sa.Column('email_type', sa.String(length=50), nullable=False),
        sa.Column('appointment_id', sa.Integer(), nullable=True),
        sa.Column('coach_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='sent'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id'], ),
        sa.ForeignKeyConstraint(['coach_id'], ['coach_profiles.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_logs_recipient_email'), 'email_logs', ['recipient_email'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop email_logs table
    op.drop_index(op.f('ix_email_logs_recipient_email'), table_name='email_logs')
    op.drop_table('email_logs')
    
    # Remove columns from appointments table
    op.drop_column('appointments', 'refund_receipt_url')
    op.drop_column('appointments', 'rejection_reason')
