"""add ip_address to guest_otps

Revision ID: m2n3o4p5q6r7
Revises: l1m2n3o4p5q6
Create Date: 2025-12-23 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'm2n3o4p5q6r7'
down_revision: Union[str, None] = 'l1m2n3o4p5q6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add ip_address column to guest_otps table for rate limiting
    op.add_column('guest_otps', sa.Column('ip_address', sa.String(length=45), nullable=True))
    op.create_index(op.f('ix_guest_otps_ip_address'), 'guest_otps', ['ip_address'], unique=False)


def downgrade() -> None:
    # Remove ip_address column
    op.drop_index(op.f('ix_guest_otps_ip_address'), table_name='guest_otps')
    op.drop_column('guest_otps', 'ip_address')
