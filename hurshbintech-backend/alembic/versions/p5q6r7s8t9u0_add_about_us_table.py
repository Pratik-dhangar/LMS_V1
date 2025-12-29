"""Add about_us table

Revision ID: p5q6r7s8t9u0
Revises: o4p5q6r7s8t9
Create Date: 2025-12-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'p5q6r7s8t9u0'
down_revision: Union[str, Sequence[str], None] = 'o4p5q6r7s8t9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create about_us table"""
    # Drop existing enum type if it exists (from failed migration attempts)
    op.execute("DROP TYPE IF EXISTS aboutusstatus CASCADE")
    
    # Create the about_us table (enum will be created automatically by SQLAlchemy)
    op.create_table(
        'about_us',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('language_code', sa.String(length=10), nullable=False, server_default='en'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('featured_image_url', sa.String(length=500), nullable=True),
        sa.Column('hero_title', sa.String(length=255), nullable=True),
        sa.Column('hero_subtitle', sa.String(length=500), nullable=True),
        sa.Column('intro_title', sa.String(length=255), nullable=True, server_default='Who We Are'),
        sa.Column('intro_content', sa.Text(), nullable=True),
        sa.Column('mission_title', sa.String(length=255), nullable=True, server_default='Our Mission'),
        sa.Column('mission_content', sa.Text(), nullable=True),
        sa.Column('vision_title', sa.String(length=255), nullable=True, server_default='Our Vision'),
        sa.Column('vision_content', sa.Text(), nullable=True),
        sa.Column('programs_title', sa.String(length=255), nullable=True, server_default='What We Teach'),
        sa.Column('programs_content', sa.Text(), nullable=True),
        sa.Column('methodology_title', sa.String(length=255), nullable=True, server_default='How We Teach'),
        sa.Column('methodology_content', sa.Text(), nullable=True),
        sa.Column('why_us_title', sa.String(length=255), nullable=True, server_default='Why Choose Us'),
        sa.Column('why_us_content', sa.Text(), nullable=True),
        sa.Column('team_title', sa.String(length=255), nullable=True, server_default='Our Educators'),
        sa.Column('team_content', sa.Text(), nullable=True),
        sa.Column('learner_focus_title', sa.String(length=255), nullable=True, server_default='Learner & Parent Focus'),
        sa.Column('learner_focus_content', sa.Text(), nullable=True),
        sa.Column('values_title', sa.String(length=255), nullable=True, server_default='Our Values'),
        sa.Column('values_content', sa.Text(), nullable=True),
        sa.Column('commitment_title', sa.String(length=255), nullable=True, server_default='Our Commitment'),
        sa.Column('commitment_content', sa.Text(), nullable=True),
        sa.Column('author_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('DRAFT', 'PUBLISHED', name='aboutusstatus'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_about_us_id'), 'about_us', ['id'], unique=False)
    op.create_index(op.f('ix_about_us_is_active'), 'about_us', ['is_active'], unique=False)


def downgrade() -> None:
    """Drop about_us table"""
    op.drop_index(op.f('ix_about_us_is_active'), table_name='about_us')
    op.drop_index(op.f('ix_about_us_id'), table_name='about_us')
    op.drop_table('about_us')
    op.execute("DROP TYPE IF EXISTS aboutusstatus")
    op.execute("DROP TYPE IF EXISTS aboutusstatus")
