"""add_coach_appointment_sessions_table

Revision ID: s8t9u0v1w2x3
Revises: r7s8t9u0v1w2
Create Date: 2025-12-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 's8t9u0v1w2x3'
down_revision: Union[str, None] = 'r7s8t9u0v1w2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create coach_appointment_sessions table
    op.create_table(
        'coach_appointment_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.String(length=100), nullable=False),
        sa.Column('appointment_id', sa.Integer(), nullable=False),
        sa.Column('coach_id', sa.Integer(), nullable=False),
        sa.Column('client_user_id', sa.Integer(), nullable=True),
        sa.Column('client_name', sa.String(length=255), nullable=False),
        sa.Column('client_email', sa.String(length=255), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('scheduled_date', sa.DateTime(), nullable=False),
        sa.Column('duration', sa.Integer(), nullable=True),
        sa.Column('session_type', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('ended_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('recording_url', sa.String(length=500), nullable=True, comment='Storage path/key for session recording'),
        sa.Column('recording_status', sa.String(length=50), nullable=True, comment='Recording status: pending, processing, completed, failed'),
        sa.Column('recording_uploaded_at', sa.DateTime(), nullable=True, comment='When recording was successfully stored'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['appointment_id'], ['appointments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['coach_id'], ['coach_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['client_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_id'),
        sa.UniqueConstraint('appointment_id')
    )
    op.create_index(op.f('ix_coach_appointment_sessions_id'), 'coach_appointment_sessions', ['id'], unique=False)
    op.create_index(op.f('ix_coach_appointment_sessions_session_id'), 'coach_appointment_sessions', ['session_id'], unique=True)
    op.create_index(op.f('ix_coach_appointment_sessions_appointment_id'), 'coach_appointment_sessions', ['appointment_id'], unique=True)


def downgrade() -> None:
    # Drop coach_appointment_sessions table
    op.drop_index(op.f('ix_coach_appointment_sessions_appointment_id'), table_name='coach_appointment_sessions')
    op.drop_index(op.f('ix_coach_appointment_sessions_session_id'), table_name='coach_appointment_sessions')
    op.drop_index(op.f('ix_coach_appointment_sessions_id'), table_name='coach_appointment_sessions')
    op.drop_table('coach_appointment_sessions')
