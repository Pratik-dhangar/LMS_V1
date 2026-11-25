"""Initial schema for Live Session Studio

Revision ID: 0001_initial
Revises: 
Create Date: 2026-11-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # demo_profiles
    op.create_table(
        'demo_profiles',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('role', sa.String(20), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    # rooms
    op.create_table(
        'rooms',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('session_id', sa.String(100), nullable=False, unique=True, index=True),
        sa.Column('trainer_id', sa.Integer(), sa.ForeignKey('demo_profiles.id'), nullable=False),
        sa.Column('learner_id', sa.Integer(), sa.ForeignKey('demo_profiles.id'), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, default='active', index=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # room_memberships
    op.create_table(
        'room_memberships',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('room_id', sa.Integer(), sa.ForeignKey('rooms.id', ondelete='CASCADE'), nullable=False),
        sa.Column('learner_id', sa.Integer(), sa.ForeignKey('demo_profiles.id'), nullable=False),
        sa.Column('state', sa.String(30), nullable=False, default='invited', index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('room_id', 'learner_id', name='uq_room_learner'),
    )
    op.create_index('ix_room_memberships_room_id', 'room_memberships', ['room_id'])
    op.create_index('ix_room_memberships_learner_id', 'room_memberships', ['learner_id'])

    # whiteboard_states (from COPY_BASELINE - adapting Base reference)
    op.create_table(
        'whiteboard_states',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('session_id', sa.String(100), nullable=False, index=True),
        sa.Column('state_type', sa.String(20), nullable=False),
        sa.Column('item_id', sa.String(100), nullable=False, index=True),
        sa.Column('data', JSONB, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
    )
    op.create_index('ix_whiteboard_session_active', 'whiteboard_states', ['session_id', 'is_active'])
    op.create_index('ix_whiteboard_session_type', 'whiteboard_states', ['session_id', 'state_type', 'is_active'])

    # materials
    op.create_table(
        'materials',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('trainer_id', sa.Integer(), sa.ForeignKey('demo_profiles.id'), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('content_type', sa.String(50), nullable=False),
        sa.Column('file_key', sa.String(500), nullable=True),
        sa.Column('external_url', sa.String(1000), nullable=True),
        sa.Column('original_filename', sa.String(500), nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('file_size', sa.BigInteger(), nullable=True),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_materials_trainer_id', 'materials', ['trainer_id'])

    # session_notes
    op.create_table(
        'session_notes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('room_id', sa.Integer(), sa.ForeignKey('rooms.id', ondelete='CASCADE'), nullable=False),
        sa.Column('trainer_id', sa.Integer(), sa.ForeignKey('demo_profiles.id'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_session_notes_room_id', 'session_notes', ['room_id'])

    # session_feedback
    op.create_table(
        'session_feedback',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('room_id', sa.Integer(), sa.ForeignKey('rooms.id', ondelete='CASCADE'), nullable=False),
        sa.Column('participant_id', sa.Integer(), sa.ForeignKey('demo_profiles.id'), nullable=False),
        sa.Column('rating', sa.SmallInteger(), nullable=False),
        sa.Column('remark', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_session_feedback_room_id', 'session_feedback', ['room_id'])

    # recordings
    op.create_table(
        'recordings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('room_id', sa.Integer(), sa.ForeignKey('rooms.id', ondelete='SET NULL'), nullable=True),
        sa.Column('session_str_id', sa.String(100), nullable=True, index=True),
        sa.Column('file_key', sa.String(500), nullable=True),
        sa.Column('status', sa.String(30), nullable=False, default='pending'),
        sa.Column('duration', sa.Float(), nullable=True),
        sa.Column('chunk_count', sa.Integer(), nullable=True),
        sa.Column('total_size', sa.Integer(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_recordings_room_id', 'recordings', ['room_id'])

    # room_messages
    op.create_table(
        'room_messages',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('room_id', sa.Integer(), sa.ForeignKey('rooms.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sender_id', sa.Integer(), sa.ForeignKey('demo_profiles.id'), nullable=False),
        sa.Column('message_type', sa.String(20), nullable=False, default='text'),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('file_key', sa.String(500), nullable=True),
        sa.Column('file_name', sa.String(500), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('is_read', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_room_messages_room_id', 'room_messages', ['room_id'])


def downgrade() -> None:
    op.drop_table('room_messages')
    op.drop_table('recordings')
    op.drop_table('session_feedback')
    op.drop_table('session_notes')
    op.drop_table('materials')
    op.drop_table('whiteboard_states')
    op.drop_table('room_memberships')
    op.drop_table('rooms')
    op.drop_table('demo_profiles')
