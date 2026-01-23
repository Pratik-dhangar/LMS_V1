"""Add YouTube support to learning_content

Revision ID: aa4b5c6d7e8f
Revises: a1b2c3d4e5f7
Create Date: 2026-01-14 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'aa4b5c6d7e8f'
down_revision = 'a1b2c3d4e5f7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # First, add youtube value to the contenttype enum (lowercase to match other values)
    op.execute("ALTER TYPE contenttype ADD VALUE 'youtube'")
    
    # Add YouTube-specific columns to learning_contents table
    op.add_column('learning_contents', sa.Column('youtube_url', sa.String(500), nullable=True))
    op.add_column('learning_contents', sa.Column('youtube_video_id', sa.String(50), nullable=True))
    op.add_column('learning_contents', sa.Column('is_youtube', sa.Boolean(), nullable=False, server_default='0'))
    
    # Add index on youtube_video_id for faster lookups
    op.create_index(op.f('ix_learning_contents_youtube_video_id'), 'learning_contents', ['youtube_video_id'], unique=False)
    
    # Make file_url nullable since YouTube content doesn't need it
    op.alter_column('learning_contents', 'file_url', existing_type=sa.String(500), nullable=True)


def downgrade() -> None:
    # Revert file_url back to non-nullable
    op.alter_column('learning_contents', 'file_url', existing_type=sa.String(500), nullable=False)
    
    # Remove index
    op.drop_index(op.f('ix_learning_contents_youtube_video_id'), table_name='learning_contents')
    
    # Remove YouTube columns
    op.drop_column('learning_contents', 'is_youtube')
    op.drop_column('learning_contents', 'youtube_video_id')
    op.drop_column('learning_contents', 'youtube_url')
    
    # Note: PostgreSQL doesn't support removing values from enums directly
    # The YOUTUBE value will remain in the contenttype enum but won't be used
    # To fully remove it would require recreating the entire enum type
