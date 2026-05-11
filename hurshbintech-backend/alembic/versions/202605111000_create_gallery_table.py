"""create_gallery_table

Revision ID: 202605111000
Revises: 202604091000
Create Date: 2026-05-11 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "202605111000"
down_revision: Union[str, Sequence[str], None] = "202604091000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create gallery table for managing admin photos"""

    # Create the enum type only if it does not already exist.
    op.execute(
        """
        DO $$
        BEGIN
            CREATE TYPE galleryphoto_status AS ENUM ('draft', 'published');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END
        $$;
        """
    )

    status_enum = postgresql.ENUM(
        "draft",
        "published",
        name="galleryphoto_status",
        create_type=False,
    )
    
    # Create gallery table
    op.create_table(
        "gallery",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("photo_url", sa.String(length=255), nullable=False),
        sa.Column("photo_size", sa.Float(), nullable=False),
        sa.Column("thumbnail_url", sa.String(length=255), nullable=True),
        sa.Column("status", status_enum, nullable=False, server_default="draft"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    
    # Create index for status column for faster queries
    op.create_index(
        "ix_gallery_status",
        "gallery",
        ["status"],
        unique=False,
    )
    
    # Create index for created_at for sorting
    op.create_index(
        "ix_gallery_created_at",
        "gallery",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Drop gallery table and enum"""
    
    # Drop indexes
    op.drop_index("ix_gallery_created_at", table_name="gallery")
    op.drop_index("ix_gallery_status", table_name="gallery")
    
    # Drop table
    op.drop_table("gallery")
    
    # Drop the enum type
    op.execute("DROP TYPE IF EXISTS galleryphoto_status")
