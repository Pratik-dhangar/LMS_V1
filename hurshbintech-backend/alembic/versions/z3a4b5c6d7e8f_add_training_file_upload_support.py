"""Add training file upload support

Revision ID: z3a4b5c6d7e8f
Revises: y2z3a4b5c6d7
Create Date: 2026-01-14 15:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'z3a4b5c6d7e8f'
down_revision = 'y2z3a4b5c6d7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns to assigned_trainings table
    op.add_column('assigned_trainings', sa.Column('featured_image_url', sa.String(500), nullable=True))
    op.add_column('assigned_trainings', sa.Column('training_files', sa.JSON(), nullable=True, server_default='[]'))
    op.add_column('assigned_trainings', sa.Column('training_folder', sa.String(255), nullable=True))


def downgrade() -> None:
    # Remove columns if rolling back
    op.drop_column('assigned_trainings', 'training_folder')
    op.drop_column('assigned_trainings', 'training_files')
    op.drop_column('assigned_trainings', 'featured_image_url')
