"""Create invoices table for order invoice management

Revision ID: s8t9u0v1a2x3
Revises: a1b2c3d4e5f6
Create Date: 2025-12-30 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 's8t9u0v1a2x3'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create invoices table with proper relationships and constraints"""
    op.create_table(
        'invoices',
        sa.Column('id', UUID(as_uuid=True), server_default=sa.func.gen_random_uuid(), nullable=False),
        sa.Column('order_id', UUID(as_uuid=True), nullable=False),
        sa.Column('invoice_number', sa.String(20), nullable=False),
        sa.Column('invoice_pdf_url', sa.String(1024), nullable=False),
        sa.Column('total_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint('total_amount > 0', name='invoices_total_check'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invoice_number', name='uq_invoices_invoice_number'),
        sa.UniqueConstraint('order_id', name='uq_invoices_order_id')
    )
    
    # Create indexes for faster lookups
    op.create_index('ix_invoices_order_id', 'invoices', ['order_id'])
    op.create_index('ix_invoices_invoice_number', 'invoices', ['invoice_number'])
    op.create_index('ix_invoices_created_at', 'invoices', ['created_at'])
    op.create_index('ix_invoices_expires_at', 'invoices', ['expires_at'])

    # Add thumbnail_url column to products for product thumbnails
    # (nullable, max length 1024)
    op.add_column('products', sa.Column('thumbnail_url', sa.String(length=1024), nullable=True))


def downgrade() -> None:
    """Drop invoices table"""
    # Remove thumbnail_url column from products
    op.drop_column('products', 'thumbnail_url')
    op.drop_index('ix_invoices_expires_at', table_name='invoices')
    op.drop_index('ix_invoices_created_at', table_name='invoices')
    op.drop_index('ix_invoices_invoice_number', table_name='invoices')
    op.drop_index('ix_invoices_order_id', table_name='invoices')
    op.drop_table('invoices')
