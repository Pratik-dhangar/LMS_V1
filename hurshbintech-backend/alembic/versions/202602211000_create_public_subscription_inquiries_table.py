"""create_public_subscription_inquiries_table

Revision ID: 202602211000
Revises: 202602191000
Create Date: 2026-02-21 10:00:00.000000

Creates the public_subscription_inquiries table for storing subscription
inquiry form submissions from the public landing page. This table does NOT
create subscriptions or learner accounts — it only stores the inquiry data
for admin review and CSV export.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '202602211000'
down_revision: Union[str, Sequence[str], None] = '202602191000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the public_subscription_inquiries table."""
    op.create_table(
        'public_subscription_inquiries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('learner_name', sa.String(length=200), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('contact_number', sa.String(length=50), nullable=False),
        sa.Column('age', sa.Integer(), nullable=True),
        sa.Column('date_of_birth', sa.Date(), nullable=True),
        sa.Column('date_of_assessment', sa.Date(), nullable=True),
        sa.Column('package_id', sa.Integer(), nullable=True),
        sa.Column('package_name', sa.String(length=200), nullable=True),
        sa.Column('package_price', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('payment_method', sa.String(length=50), nullable=True),
        sa.Column('payment_receipt_url', sa.String(length=1024), nullable=True),
        sa.Column('payment_receipt_filename', sa.String(length=500), nullable=True),
        sa.Column('review_status', sa.String(length=50), nullable=False, server_default='NEW'),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(
            ['package_id'],
            ['subscription_packages.id'],
            name='fk_inquiry_package_id',
            ondelete='SET NULL',
        ),
        sa.PrimaryKeyConstraint('id'),
    )

    # Indexes
    op.create_index(
        'idx_inquiry_submitted_at',
        'public_subscription_inquiries',
        ['submitted_at'],
    )
    op.create_index(
        'idx_inquiry_review_status',
        'public_subscription_inquiries',
        ['review_status'],
    )


def downgrade() -> None:
    """Drop the public_subscription_inquiries table."""
    op.drop_index('idx_inquiry_review_status', table_name='public_subscription_inquiries')
    op.drop_index('idx_inquiry_submitted_at', table_name='public_subscription_inquiries')
    op.drop_table('public_subscription_inquiries')
