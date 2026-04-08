"""Add skills column to programs table for multi-skill support

Revision ID: 202604081000
Revises: 202603311000
Create Date: 2026-04-08 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '202604081000'
down_revision = '202603311000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add skills column to programs table
    # Structure: [{"skill_id": 1, "skill_name": "Skill 1", "goal_ids": [1, 2, 3]}, ...]
    op.add_column('programs', sa.Column('skills', sa.JSON(), nullable=False, server_default='[]'))


def downgrade() -> None:
    op.drop_column('programs', 'skills')
