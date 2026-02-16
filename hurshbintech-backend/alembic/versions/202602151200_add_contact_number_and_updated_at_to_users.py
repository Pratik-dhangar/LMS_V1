"""add_contact_number_updated_at_to_users_and_create_vendors_table

Revision ID: 202602151200
Revises: 202602141430
Create Date: 2026-02-15 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '202602151200'
down_revision = '202602141430'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add contact_number column to users table
    op.add_column('users', sa.Column('contact_number', sa.String(20), nullable=True))
    
    # Create unique index for contact_number
    op.create_index(op.f('ix_users_contact_number'), 'users', ['contact_number'], unique=True)
    
    # Add updated_at column to users table
    op.add_column('users', sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.func.now()))
    
    # Create vendors table
    op.create_table(
        'vendors',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('admin_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('contact_number', sa.String(20), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('state', sa.String(100), nullable=True),
        sa.Column('country', sa.String(100), nullable=True),
        sa.Column('postal_code', sa.String(20), nullable=True),
        sa.Column('company_name', sa.String(255), nullable=True),
        sa.Column('website', sa.String(255), nullable=True),
        sa.Column('tax_id', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for vendors table
    op.create_index(op.f('ix_vendors_admin_id'), 'vendors', ['admin_id'], unique=False)
    op.create_index(op.f('ix_vendors_email'), 'vendors', ['email'], unique=True)
    op.create_index(op.f('ix_vendors_contact_number'), 'vendors', ['contact_number'], unique=True)
    op.create_index(op.f('ix_vendors_is_active'), 'vendors', ['is_active'], unique=False)
    op.create_index(op.f('ix_vendors_created_at'), 'vendors', ['created_at'], unique=False)
    op.create_index(op.f('ix_vendors_name'), 'vendors', ['name'], unique=False)


def downgrade() -> None:
    # Drop vendors table
    op.drop_table('vendors')
    
    # Remove updated_at column
    op.drop_column('users', 'updated_at')
    
    # Remove contact_number index
    op.drop_index(op.f('ix_users_contact_number'), table_name='users')
    
    # Remove contact_number column
    op.drop_column('users', 'contact_number')

