"""add_rejection_fields_to_appointments

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


def downgrade() -> None:
    """Downgrade schema."""
    # Remove columns from appointments table
    op.drop_column('appointments', 'refund_receipt_url')
    op.drop_column('appointments', 'rejection_reason')
