"""Add blog table

Revision ID: db3eb5736338
Revises: f6dd5023749e
Create Date: 2025-12-26 23:55:53.038374

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'db3eb5736338'
down_revision: Union[str, Sequence[str], None] = 'f6dd5023749e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Create blogs table"""
    op.create_table(
        'blogs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=255), nullable=False),
        sa.Column('excerpt', sa.String(length=500), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('featured_image_url', sa.String(length=500), nullable=True),
        sa.Column('author_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.Enum('DRAFT', 'PUBLISHED', name='blogstatus'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_blogs_id'), 'blogs', ['id'], unique=False)
    op.create_index(op.f('ix_blogs_slug'), 'blogs', ['slug'], unique=True)


def downgrade() -> None:
    """Drop blogs table"""
    op.drop_index(op.f('ix_blogs_slug'), table_name='blogs')
    op.drop_index(op.f('ix_blogs_id'), table_name='blogs')
    op.drop_table('blogs')
    op.execute("DROP TYPE blogstatus")
