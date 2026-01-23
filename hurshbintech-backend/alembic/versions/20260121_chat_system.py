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
down_revision = 'ab5c6d7e8f9g'
branch_labels = None
depends_on = None


def upgrade():
    # Create ConversationType enum (only if it doesn't exist)
    conn = op.get_bind()
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE conversationtype AS ENUM ('DIRECT', 'GROUP');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """))
    
    # Create MessageType enum (only if it doesn't exist)
    conn.execute(sa.text("""
        DO $$ BEGIN
            CREATE TYPE messagetype AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """))
    
    # Create conversations table using raw column type
    conn.execute(sa.text("""
        CREATE TABLE conversations (
            id SERIAL PRIMARY KEY,
            type conversationtype NOT NULL,
            name VARCHAR(255),
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT now() NOT NULL,
            updated_at TIMESTAMP DEFAULT now() NOT NULL
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_conversations_id ON conversations (id)"))
    
    # Create conversation_members table
    conn.execute(sa.text("""
        CREATE TABLE conversation_members (
            id SERIAL PRIMARY KEY,
            conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            joined_at TIMESTAMP DEFAULT now() NOT NULL,
            is_active BOOLEAN DEFAULT true NOT NULL,
            last_read_at TIMESTAMP
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_conversation_members_id ON conversation_members (id)"))
    conn.execute(sa.text("CREATE INDEX ix_conversation_members_conversation_id ON conversation_members (conversation_id)"))
    conn.execute(sa.text("CREATE INDEX ix_conversation_members_user_id ON conversation_members (user_id)"))
    
    # Create messages table
    conn.execute(sa.text("""
        CREATE TABLE messages (
            id SERIAL PRIMARY KEY,
            conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            message_type messagetype NOT NULL,
            content TEXT,
            file_url VARCHAR(500),
            file_name VARCHAR(255),
            file_size BIGINT,
            mime_type VARCHAR(100),
            created_at TIMESTAMP DEFAULT now() NOT NULL,
            updated_at TIMESTAMP DEFAULT now() NOT NULL,
            is_deleted BOOLEAN DEFAULT false NOT NULL
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_messages_id ON messages (id)"))
    conn.execute(sa.text("CREATE INDEX ix_messages_conversation_id ON messages (conversation_id)"))
    conn.execute(sa.text("CREATE INDEX ix_messages_sender_id ON messages (sender_id)"))
    conn.execute(sa.text("CREATE INDEX ix_messages_created_at ON messages (created_at)"))
    
    # Create read_receipts table
    conn.execute(sa.text("""
        CREATE TABLE read_receipts (
            id SERIAL PRIMARY KEY,
            message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            read_at TIMESTAMP DEFAULT now() NOT NULL
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_read_receipts_id ON read_receipts (id)"))
    conn.execute(sa.text("CREATE INDEX ix_read_receipts_message_id ON read_receipts (message_id)"))
    conn.execute(sa.text("CREATE INDEX ix_read_receipts_user_id ON read_receipts (user_id)"))


def downgrade():
    # Drop tables using raw SQL
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS read_receipts CASCADE;"))
    conn.execute(sa.text("DROP TABLE IF EXISTS messages CASCADE;"))
    conn.execute(sa.text("DROP TABLE IF EXISTS conversation_members CASCADE;"))
    conn.execute(sa.text("DROP TABLE IF EXISTS conversations CASCADE;"))
    
    # Drop enums
    conn.execute(sa.text("DROP TYPE IF EXISTS messagetype;"))
    conn.execute(sa.text("DROP TYPE IF EXISTS conversationtype;"))
