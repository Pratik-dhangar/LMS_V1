"""Add guest checkout support to orders table

Revision ID: 202605121400
Revises: 202605111500
Create Date: 2026-05-12 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '202605121400'
down_revision = '202605111500'
branch_labels = None
depends_on = None


def upgrade():
    # Make user_id nullable to support guest checkout
    op.alter_column('orders', 'user_id',
               existing_type=sa.Integer(),
               nullable=True,
               existing_nullable=False)
    
    # Add customer_name for guest users
    op.add_column('orders', sa.Column('customer_name', sa.String(255), nullable=True))
    
    # Add customer_contact_number for guest users
    op.add_column('orders', sa.Column('customer_contact_number', sa.String(20), nullable=True))
    
    # Add guest_token for tracking guest orders (unique identifier)
    op.add_column('orders', sa.Column('guest_token', sa.String(64), nullable=True, unique=True))
    
    # Create index on guest_token for faster lookup
    op.create_index(op.f('ix_orders_guest_token'), 'orders', ['guest_token'], unique=True)


def downgrade():
    # Drop index
    op.drop_index(op.f('ix_orders_guest_token'), table_name='orders')
    
    # Drop columns
    op.drop_column('orders', 'guest_token')
    op.drop_column('orders', 'customer_contact_number')
    op.drop_column('orders', 'customer_name')
    
    # Make user_id NOT nullable again
    op.alter_column('orders', 'user_id',
               existing_type=sa.Integer(),
               nullable=False,
               existing_nullable=True)
