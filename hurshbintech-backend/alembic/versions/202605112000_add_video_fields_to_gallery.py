"""add_video_fields_to_gallery

Revision ID: 202605112000
Revises: 202605141020
Create Date: 2026-05-11 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "202605112000"
down_revision: Union[str, Sequence[str], None] = "202605141020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add video support fields to gallery table."""
    with op.batch_alter_table("gallery") as batch_op:
        # Make photo_url nullable to allow video-only entries
        batch_op.alter_column(
            "photo_url",
            existing_type=sa.String(255),
            nullable=True
        )
        # Make photo_size nullable to allow video-only entries
        batch_op.alter_column(
            "photo_size",
            existing_type=sa.Float(),
            nullable=True
        )
        # Add video fields
        batch_op.add_column(sa.Column("video_url", sa.String(255), nullable=True))
        batch_op.add_column(sa.Column("video_size", sa.Float(), nullable=True))
        batch_op.add_column(sa.Column("video_thumbnail_url", sa.String(255), nullable=True))


def downgrade() -> None:
    """Remove video support fields from gallery table."""
    with op.batch_alter_table("gallery") as batch_op:
        # Remove video fields
        batch_op.drop_column("video_url")
        batch_op.drop_column("video_size")
        batch_op.drop_column("video_thumbnail_url")
        # Make photo_url not nullable again
        batch_op.alter_column(
            "photo_url",
            existing_type=sa.String(255),
            nullable=False
        )
        # Make photo_size not nullable again
        batch_op.alter_column(
            "photo_size",
            existing_type=sa.Float(),
            nullable=False
        )
