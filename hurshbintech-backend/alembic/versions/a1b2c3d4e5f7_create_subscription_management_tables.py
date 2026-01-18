"""Create subscription management tables

Revision ID: a1b2c3d4e5f7
Revises: z3a4b5c6d7e8f
Create Date: 2026-01-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f7'
down_revision: Union[str, Sequence[str], None] = 'z3a4b5c6d7e8f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create subscription management tables"""
    
    # Note: Enum types are created automatically by SQLAlchemy when tables are created
    # because create_type=False is NOT set on Enum columns (letting SQLAlchemy handle it)
    
    # Create subscription_packages table
    op.create_table(
        'subscription_packages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('head_id', sa.Integer(), nullable=False),
        sa.Column('package_name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('sessions_count', sa.Integer(), nullable=False),
        sa.Column('validity_days', sa.Integer(), nullable=False),
        sa.Column('price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['head_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_subscription_packages_id', 'subscription_packages', ['id'])
    op.create_index('idx_package_head_active', 'subscription_packages', ['head_id', 'is_active'])
    
    # Create subscription_discounts table
    op.create_table(
        'subscription_discounts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_by_admin_id', sa.Integer(), nullable=True),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('discount_type', sa.Enum('PERCENTAGE', 'FIXED', name='discounttype'), nullable=False),
        sa.Column('discount_value', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('eligibility_criteria', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('valid_from', sa.Date(), nullable=False),
        sa.Column('valid_until', sa.Date(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('usage_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('max_usage_count', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.CheckConstraint('discount_value >= 0', name='check_discount_value_positive'),
        sa.ForeignKeyConstraint(['created_by_admin_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index('ix_subscription_discounts_id', 'subscription_discounts', ['id'])
    op.create_index('idx_discount_code_active', 'subscription_discounts', ['code', 'is_active'])
    op.create_index('idx_discount_validity', 'subscription_discounts', ['valid_from', 'valid_until', 'is_active'])
    
    # Create learner_subscriptions table
    op.create_table(
        'learner_subscriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('learner_id', sa.Integer(), nullable=False),
        sa.Column('package_id', sa.Integer(), nullable=True),
        sa.Column('created_by_head_id', sa.Integer(), nullable=True),
        sa.Column('current_head_id', sa.Integer(), nullable=True),
        
        # Denormalized package details
        sa.Column('package_name', sa.String(length=200), nullable=False),
        sa.Column('package_sessions', sa.Integer(), nullable=False),
        sa.Column('package_validity_days', sa.Integer(), nullable=False),
        sa.Column('package_original_price', sa.Numeric(precision=10, scale=2), nullable=False),
        
        # Subscription lifecycle
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('expiry_date', sa.Date(), nullable=False),
        sa.Column('status', sa.Enum('ACTIVE', 'EXPIRED', 'CANCELLED', 'REFUNDED', 'PAUSED', 'FROZEN', name='subscriptionstatus'), 
                  nullable=False, server_default='ACTIVE'),
        
        # Session tracking
        sa.Column('sessions_total', sa.Integer(), nullable=False),
        sa.Column('sessions_completed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sessions_remaining', sa.Integer(), nullable=False),
        
        # Pricing and discounts
        sa.Column('discount_applied', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0'),
        sa.Column('discount_code_id', sa.Integer(), nullable=True),
        sa.Column('applied_by_head_id', sa.Integer(), nullable=True),
        sa.Column('net_price_paid', sa.Numeric(precision=10, scale=2), nullable=False),
        
        # Pause/Freeze tracking
        sa.Column('paused_at', sa.DateTime(), nullable=True),
        sa.Column('paused_duration_days', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('frozen_at', sa.DateTime(), nullable=True),
        sa.Column('frozen_duration_days', sa.Integer(), nullable=False, server_default='0'),
        
        # Renewal tracking
        sa.Column('renewed_from_subscription_id', sa.Integer(), nullable=True),
        sa.Column('renewed_to_subscription_id', sa.Integer(), nullable=True),
        
        # Refund tracking
        sa.Column('refund_amount', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('refund_type', sa.Enum('FULL', 'PRORATED', name='refundtype'), nullable=True),
        sa.Column('refund_date', sa.DateTime(), nullable=True),
        sa.Column('refund_reason', sa.Text(), nullable=True),
        
        # Metadata
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        
        sa.CheckConstraint('sessions_total >= 0', name='check_sessions_total_positive'),
        sa.CheckConstraint('sessions_completed >= 0', name='check_sessions_completed_positive'),
        sa.CheckConstraint('sessions_remaining >= 0', name='check_sessions_remaining_positive'),
        sa.CheckConstraint('net_price_paid >= 0', name='check_net_price_positive'),
        sa.ForeignKeyConstraint(['learner_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['package_id'], ['subscription_packages.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by_head_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['current_head_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['discount_code_id'], ['subscription_discounts.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['applied_by_head_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['renewed_from_subscription_id'], ['learner_subscriptions.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_learner_subscriptions_id', 'learner_subscriptions', ['id'])
    op.create_index('idx_subscription_learner_status', 'learner_subscriptions', ['learner_id', 'status'])
    op.create_index('idx_subscription_head_status', 'learner_subscriptions', ['current_head_id', 'status'])
    op.create_index('idx_subscription_expiry', 'learner_subscriptions', ['expiry_date', 'status'])
    
    # Create subscription_payment_receipts table
    op.create_table(
        'subscription_payment_receipts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('subscription_id', sa.Integer(), nullable=False),
        sa.Column('uploaded_by_head_id', sa.Integer(), nullable=True),
        
        # File details
        sa.Column('file_name', sa.String(length=500), nullable=False),
        sa.Column('file_path', sa.String(length=1024), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('storage_type', sa.String(length=20), nullable=False, server_default='s3'),
        
        # Payment verification
        sa.Column('payment_status', sa.Enum('PENDING', 'APPROVED', 'REJECTED', name='paymentstatus'), 
                  nullable=False, server_default='PENDING'),
        sa.Column('verified_by_admin_id', sa.Integer(), nullable=True),
        sa.Column('verified_at', sa.DateTime(), nullable=True),
        sa.Column('verification_notes', sa.Text(), nullable=True),
        
        # Metadata
        sa.Column('uploaded_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        
        sa.ForeignKeyConstraint(['subscription_id'], ['learner_subscriptions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by_head_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['verified_by_admin_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_subscription_payment_receipts_id', 'subscription_payment_receipts', ['id'])
    op.create_index('idx_receipt_subscription_status', 'subscription_payment_receipts', ['subscription_id', 'payment_status'])
    op.create_index('idx_receipt_status_uploaded', 'subscription_payment_receipts', ['payment_status', 'uploaded_at'])
    
    # Create session_adjustment_logs table
    op.create_table(
        'session_adjustment_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('subscription_id', sa.Integer(), nullable=False),
        sa.Column('adjusted_by_id', sa.Integer(), nullable=True),
        sa.Column('adjusted_by_role', sa.String(length=20), nullable=False),
        
        # Adjustment details
        sa.Column('adjustment_type', sa.Enum('ADD', 'SUBTRACT', name='adjustmenttype'), nullable=False),
        sa.Column('adjustment_amount', sa.Integer(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        
        # Session counts before/after
        sa.Column('sessions_before', sa.Integer(), nullable=False),
        sa.Column('sessions_after', sa.Integer(), nullable=False),
        
        # Metadata
        sa.Column('adjusted_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        
        sa.CheckConstraint('adjustment_amount > 0', name='check_adjustment_amount_positive'),
        sa.ForeignKeyConstraint(['subscription_id'], ['learner_subscriptions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['adjusted_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_session_adjustment_logs_id', 'session_adjustment_logs', ['id'])
    op.create_index('idx_adjustment_subscription', 'session_adjustment_logs', ['subscription_id', 'adjusted_at'])
    op.create_index('idx_adjustment_user', 'session_adjustment_logs', ['adjusted_by_id', 'adjusted_at'])
    
    # Create subscription_event_logs table
    op.create_table(
        'subscription_event_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('subscription_id', sa.Integer(), nullable=False),
        sa.Column('triggered_by_id', sa.Integer(), nullable=True),
        sa.Column('triggered_by_role', sa.String(length=20), nullable=True),
        
        # Event details
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('event_description', sa.Text(), nullable=False),
        sa.Column('event_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        
        # Metadata
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        
        sa.ForeignKeyConstraint(['subscription_id'], ['learner_subscriptions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['triggered_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_subscription_event_logs_id', 'subscription_event_logs', ['id'])
    op.create_index('idx_event_subscription_type', 'subscription_event_logs', ['subscription_id', 'event_type', 'created_at'])
    op.create_index('idx_event_created', 'subscription_event_logs', ['created_at'])


def downgrade() -> None:
    """Drop subscription management tables"""
    
    # Drop tables in reverse order (respecting foreign keys)
    op.drop_index('idx_event_created', table_name='subscription_event_logs')
    op.drop_index('idx_event_subscription_type', table_name='subscription_event_logs')
    op.drop_index('ix_subscription_event_logs_id', table_name='subscription_event_logs')
    op.drop_table('subscription_event_logs')
    
    op.drop_index('idx_adjustment_user', table_name='session_adjustment_logs')
    op.drop_index('idx_adjustment_subscription', table_name='session_adjustment_logs')
    op.drop_index('ix_session_adjustment_logs_id', table_name='session_adjustment_logs')
    op.drop_table('session_adjustment_logs')
    
    op.drop_index('idx_receipt_status_uploaded', table_name='subscription_payment_receipts')
    op.drop_index('idx_receipt_subscription_status', table_name='subscription_payment_receipts')
    op.drop_index('ix_subscription_payment_receipts_id', table_name='subscription_payment_receipts')
    op.drop_table('subscription_payment_receipts')
    
    op.drop_index('idx_subscription_expiry', table_name='learner_subscriptions')
    op.drop_index('idx_subscription_head_status', table_name='learner_subscriptions')
    op.drop_index('idx_subscription_learner_status', table_name='learner_subscriptions')
    op.drop_index('ix_learner_subscriptions_id', table_name='learner_subscriptions')
    op.drop_table('learner_subscriptions')
    
    op.drop_index('idx_discount_validity', table_name='subscription_discounts')
    op.drop_index('idx_discount_code_active', table_name='subscription_discounts')
    op.drop_index('ix_subscription_discounts_id', table_name='subscription_discounts')
    op.drop_table('subscription_discounts')
    
    op.drop_index('idx_package_head_active', table_name='subscription_packages')
    op.drop_index('ix_subscription_packages_id', table_name='subscription_packages')
    op.drop_table('subscription_packages')
    
    # Drop enums
    op.execute("DROP TYPE adjustmenttype")
    op.execute("DROP TYPE refundtype")
    op.execute("DROP TYPE discounttype")
    op.execute("DROP TYPE paymentstatus")
    op.execute("DROP TYPE subscriptionstatus")
