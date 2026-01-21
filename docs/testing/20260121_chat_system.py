"""add chat system tables

Revision ID: 20260121_chat_system
Revises: 
Create Date: 2026-01-21 10:15:28

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260121_chat_system'
down_revision = None  # Update this to your latest migration revision
branch_labels = None
depends_on = None


def upgrade():
    # Create ConversationType enum
    conversation_type_enum = postgresql.ENUM('DIRECT', 'GROUP', name='conversationtype', create_type=True)
    conversation_type_enum.create(op.get_bind(), checkfirst=True)
    
    # Create MessageType enum
    message_type_enum = postgresql.ENUM('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', name='messagetype', create_type=True)
    message_type_enum.create(op.get_bind(), checkfirst=True)
    
    # Create conversations table
    op.create_table(
        'conversations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('type', sa.Enum('DIRECT', 'GROUP', name='conversationtype'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_conversations_id'), 'conversations', ['id'], unique=False)
    
    # Create conversation_members table
    op.create_table(
        'conversation_members',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('conversation_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('joined_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('last_read_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_conversation_members_id'), 'conversation_members', ['id'], unique=False)
    op.create_index(op.f('ix_conversation_members_conversation_id'), 'conversation_members', ['conversation_id'], unique=False)
    op.create_index(op.f('ix_conversation_members_user_id'), 'conversation_members', ['user_id'], unique=False)
    
    # Create messages table
    op.create_table(
        'messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('conversation_id', sa.Integer(), nullable=False),
        sa.Column('sender_id', sa.Integer(), nullable=True),
        sa.Column('message_type', sa.Enum('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', name='messagetype'), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('file_url', sa.String(length=500), nullable=True),
        sa.Column('file_name', sa.String(length=255), nullable=True),
        sa.Column('file_size', sa.BigInteger(), nullable=True),
        sa.Column('mime_type', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_messages_id'), 'messages', ['id'], unique=False)
    op.create_index(op.f('ix_messages_conversation_id'), 'messages', ['conversation_id'], unique=False)
    op.create_index(op.f('ix_messages_sender_id'), 'messages', ['sender_id'], unique=False)
    op.create_index(op.f('ix_messages_created_at'), 'messages', ['created_at'], unique=False)
    
    # Create read_receipts table
    op.create_table(
        'read_receipts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('message_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('read_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['message_id'], ['messages.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_read_receipts_id'), 'read_receipts', ['id'], unique=False)
    op.create_index(op.f('ix_read_receipts_message_id'), 'read_receipts', ['message_id'], unique=False)
    op.create_index(op.f('ix_read_receipts_user_id'), 'read_receipts', ['user_id'], unique=False)


def downgrade():
    # Drop tables
    op.drop_index(op.f('ix_read_receipts_user_id'), table_name='read_receipts')
    op.drop_index(op.f('ix_read_receipts_message_id'), table_name='read_receipts')
    op.drop_index(op.f('ix_read_receipts_id'), table_name='read_receipts')
    op.drop_table('read_receipts')
    
    op.drop_index(op.f('ix_messages_created_at'), table_name='messages')
    op.drop_index(op.f('ix_messages_sender_id'), table_name='messages')
    op.drop_index(op.f('ix_messages_conversation_id'), table_name='messages')
    op.drop_index(op.f('ix_messages_id'), table_name='messages')
    op.drop_table('messages')
    
    op.drop_index(op.f('ix_conversation_members_user_id'), table_name='conversation_members')
    op.drop_index(op.f('ix_conversation_members_conversation_id'), table_name='conversation_members')
    op.drop_index(op.f('ix_conversation_members_id'), table_name='conversation_members')
    op.drop_table('conversation_members')
    
    op.drop_index(op.f('ix_conversations_id'), table_name='conversations')
    op.drop_table('conversations')
    
    # Drop enums
    sa.Enum(name='messagetype').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='conversationtype').drop(op.get_bind(), checkfirst=True)
