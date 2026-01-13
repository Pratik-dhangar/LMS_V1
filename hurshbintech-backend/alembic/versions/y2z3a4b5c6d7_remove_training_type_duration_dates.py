"""Remove training_type, duration_days, start_date, and end_date from assigned_trainings

Revision ID: y2z3a4b5c6d7
Revises: a1b2c3d4e5f
Create Date: 2026-01-13 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'y2z3a4b5c6d7'
down_revision = 'a1b2c3d4e5f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the columns from assigned_trainings table
    with op.batch_alter_table('assigned_trainings', schema=None) as batch_op:
        batch_op.drop_column('training_type')
        batch_op.drop_column('duration_days')
        batch_op.drop_column('start_date')
        batch_op.drop_column('end_date')


def downgrade() -> None:
    # Restore the columns to assigned_trainings table
    with op.batch_alter_table('assigned_trainings', schema=None) as batch_op:
        batch_op.add_column(sa.Column('training_type', sa.String(length=50), nullable=False, server_default='custom'))
        batch_op.add_column(sa.Column('duration_days', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('start_date', sa.Date(), nullable=True))
        batch_op.add_column(sa.Column('end_date', sa.Date(), nullable=True))
