"""increase passcode length for bcrypt

Revision ID: increase_passcode_length
Revises: b32f14640083
Create Date: 2025-06-01 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'increase_passcode_length'
down_revision = 'b32f14640083'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Increase passcode column length to accommodate bcrypt hashes (60 chars)
    op.alter_column('users', 'passcode',
                    existing_type=sa.String(20),
                    type_=sa.String(60),
                    existing_nullable=False)


def downgrade() -> None:
    # Revert back to original length
    op.alter_column('users', 'passcode',
                    existing_type=sa.String(60),
                    type_=sa.String(20),
                    existing_nullable=False)
