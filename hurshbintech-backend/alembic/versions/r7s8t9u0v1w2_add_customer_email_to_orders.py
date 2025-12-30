"""Add customer_email column to orders table

Revision ID: r7s8t9u0v1w2
Revises: q6r7s8t9u0v1
Create Date: 2025-12-29 17:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'r7s8t9u0v1w2'
down_revision: Union[str, Sequence[str], None] = 'q6r7s8t9u0v1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add customer_email column to orders table"""
    # Add customer_email column to orders table
    op.add_column('orders', sa.Column('customer_email', sa.String(255), nullable=True))
    # Create index on customer_email for faster lookups
    op.create_index('ix_orders_customer_email', 'orders', ['customer_email'])


def downgrade() -> None:
    """Remove customer_email column from orders table"""
    # Drop index first
    op.drop_index('ix_orders_customer_email', table_name='orders')
    # Drop column
    op.drop_column('orders', 'customer_email')
