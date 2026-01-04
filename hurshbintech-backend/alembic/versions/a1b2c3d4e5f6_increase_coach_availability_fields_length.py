"""increase coach availability fields length

Revision ID: a1b2c3d4e5f6
Revises: s8t9u0v1w2x3
Create Date: 2025-12-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 's8t9u0v1w2x3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Increase length of availability_days from VARCHAR(50) to VARCHAR(200)
    op.alter_column('coach_profiles', 'availability_days',
                    existing_type=sa.String(50),
                    type_=sa.String(200),
                    existing_nullable=True)
    
    # Increase length of time_slots from VARCHAR(100) to VARCHAR(200)
    op.alter_column('coach_profiles', 'time_slots',
                    existing_type=sa.String(100),
                    type_=sa.String(200),
                    existing_nullable=True)


def downgrade() -> None:
    # Revert availability_days back to VARCHAR(50)
    op.alter_column('coach_profiles', 'availability_days',
                    existing_type=sa.String(200),
                    type_=sa.String(50),
                    existing_nullable=True)
    
    # Revert time_slots back to VARCHAR(100)
    op.alter_column('coach_profiles', 'time_slots',
                    existing_type=sa.String(200),
                    type_=sa.String(100),
                    existing_nullable=True)
