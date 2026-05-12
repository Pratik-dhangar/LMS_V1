"""Make order audit and payment receipt actor columns nullable for guest checkout

Revision ID: 202605131000
Revises: 202605121400
Create Date: 2026-05-13 00:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '202605131000'
down_revision = '202605121400'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        'order_audit_log',
        'performed_by_id',
        existing_type=sa.Integer(),
        nullable=True,
        existing_nullable=False,
    )
    op.alter_column(
        'payment_receipts',
        'uploaded_by_id',
        existing_type=sa.Integer(),
        nullable=True,
        existing_nullable=False,
    )


def downgrade():
    op.alter_column(
        'payment_receipts',
        'uploaded_by_id',
        existing_type=sa.Integer(),
        nullable=False,
        existing_nullable=True,
    )
    op.alter_column(
        'order_audit_log',
        'performed_by_id',
        existing_type=sa.Integer(),
        nullable=False,
        existing_nullable=True,
    )