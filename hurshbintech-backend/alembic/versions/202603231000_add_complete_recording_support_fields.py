"""Add complete recording support fields to training_sessions

Revision ID: 202603231000
Revises: 202603221200
Create Date: 2026-03-23 10:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "202603231000"
down_revision: Union[str, Sequence[str], None] = "202603221200"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add missing recording fields used by chunked recording flow."""
    op.add_column(
        "training_sessions",
        sa.Column(
            "has_recording",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
            comment="Whether this session has a recording",
        ),
    )
    op.add_column(
        "training_sessions",
        sa.Column(
            "recording_id",
            sa.String(length=255),
            nullable=True,
            comment="Unique recording identifier",
        ),
    )
    op.add_column(
        "training_sessions",
        sa.Column(
            "recording_error",
            sa.Text(),
            nullable=True,
            comment="Error details if recording fails",
        ),
    )
    op.add_column(
        "training_sessions",
        sa.Column(
            "recording_created_at",
            sa.DateTime(),
            nullable=True,
            comment="When recording metadata was created",
        ),
    )
    op.add_column(
        "training_sessions",
        sa.Column(
            "recording_chunks_count",
            sa.Integer(),
            nullable=True,
            server_default="0",
            comment="Number of chunks uploaded",
        ),
    )
    op.add_column(
        "training_sessions",
        sa.Column(
            "s3_key",
            sa.String(length=500),
            nullable=True,
            comment="S3 key for stored recording",
        ),
    )

    op.create_index(
        "ix_training_sessions_has_recording",
        "training_sessions",
        ["has_recording"],
        unique=False,
    )
    op.create_index(
        "ix_training_sessions_recording_id",
        "training_sessions",
        ["recording_id"],
        unique=True,
    )


def downgrade() -> None:
    """Drop complete recording support fields from training_sessions."""
    op.drop_index("ix_training_sessions_recording_id", table_name="training_sessions")
    op.drop_index("ix_training_sessions_has_recording", table_name="training_sessions")

    op.drop_column("training_sessions", "s3_key")
    op.drop_column("training_sessions", "recording_chunks_count")
    op.drop_column("training_sessions", "recording_created_at")
    op.drop_column("training_sessions", "recording_error")
    op.drop_column("training_sessions", "recording_id")
    op.drop_column("training_sessions", "has_recording")
