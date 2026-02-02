"""add featured coach to about us

Revision ID: a1b2c3d4e5f8
Revises: a4b5c6d7e8f9
Create Date: 2026-02-02 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f8'
down_revision = 'a4b5c6d7e8f9'
branch_labels = None
depends_on = None


def upgrade():
    # Add featured_coach_id column to about_us table
    op.add_column('about_us', sa.Column('featured_coach_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_about_us_featured_coach',
        'about_us',
        'coach_profiles',
        ['featured_coach_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade():
    # Remove foreign key constraint
    op.drop_constraint('fk_about_us_featured_coach', 'about_us', type_='foreignkey')
    # Remove column
    op.drop_column('about_us', 'featured_coach_id')
