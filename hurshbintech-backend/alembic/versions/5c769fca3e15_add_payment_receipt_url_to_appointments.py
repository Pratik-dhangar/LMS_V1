"""add_payment_receipt_url_to_appointments

Revision ID: 5c769fca3e15
Revises: g6h7i8j9k0l1
Create Date: 2025-12-19 10:33:02.914524

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5c769fca3e15'
down_revision: Union[str, Sequence[str], None] = 'g6h7i8j9k0l1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add payment_receipt_url column to appointments table
    op.add_column('appointments', sa.Column('payment_receipt_url', sa.String(length=500), nullable=True))
    
    # Add session_type column to appointments table
    op.add_column('appointments', sa.Column('session_type', sa.String(length=50), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove columns from appointments table
    op.drop_column('appointments', 'session_type')
    op.drop_column('appointments', 'payment_receipt_url')
