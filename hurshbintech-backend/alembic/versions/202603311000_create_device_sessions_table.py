"""create device_sessions table for single-device active session management

Revision ID: 202603311000
Revises: 202603301100
Create Date: 2026-03-31 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "202603311000"
down_revision: Union[str, Sequence[str], None] = "202603301100"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "device_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("device_id", sa.String(length=255), nullable=False),
        sa.Column("device_name", sa.String(length=255), nullable=True),
        sa.Column("device_type", sa.String(length=50), nullable=True),
        sa.Column("browser_info", sa.String(length=255), nullable=True),
        sa.Column("ip_address", sa.String(length=50), nullable=True),
        sa.Column("access_token_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("last_activity_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("deactivated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    
    # Create indexes for performance
    op.create_index("ix_device_sessions_id", "device_sessions", ["id"], unique=False)
    op.create_index("ix_device_sessions_user_id_active", "device_sessions", ["user_id", "is_active"], unique=False)
    op.create_index("ix_device_sessions_device_id", "device_sessions", ["device_id"], unique=False)
    op.create_index("ix_device_sessions_access_token_hash", "device_sessions", ["access_token_hash"], unique=False)
    op.create_index("ix_device_sessions_is_active", "device_sessions", ["is_active"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_device_sessions_is_active", table_name="device_sessions")
    op.drop_index("ix_device_sessions_access_token_hash", table_name="device_sessions")
    op.drop_index("ix_device_sessions_device_id", table_name="device_sessions")
    op.drop_index("ix_device_sessions_user_id_active", table_name="device_sessions")
    op.drop_index("ix_device_sessions_id", table_name="device_sessions")
    op.drop_table("device_sessions")
