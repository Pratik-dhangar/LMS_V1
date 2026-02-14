"""create_contacts_table

Revision ID: 202602141430
Revises: 202602091500
Create Date: 2026-02-14 14:30:00.000000

This migration creates the contacts table for managing contact form submissions:
1. Creates contacts table with fields for storing contact information
2. Adds status enum for tracking contact state (new, read, replied, archived)
3. Creates indexes for common queries (status, is_resolved, created_at)
4. Allows admin to track and respond to contact submissions
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '202602141430'
down_revision: Union[str, Sequence[str], None] = '202602091500'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Create contacts table"""
    
    # Check if table already exists, if not create it
    op.execute("""
        DO $$
        BEGIN
            -- Try to create the enum if it doesn't exist
            CREATE TYPE contactstatus AS ENUM ('new', 'read', 'replied', 'archived');
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Create contacts table if it doesn't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS contacts (
            id SERIAL PRIMARY KEY,
            parent_name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(20),
            message TEXT NOT NULL,
            status contactstatus NOT NULL DEFAULT 'new',
            admin_notes TEXT,
            is_resolved BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create indexes for better query performance (if they don't exist)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_contacts_parent_name ON contacts(parent_name)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_contacts_email ON contacts(email)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_contacts_status ON contacts(status)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_contacts_is_resolved ON contacts(is_resolved)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_contacts_created_at ON contacts(created_at)
    """)


def downgrade() -> None:
    """Downgrade schema - Drop contacts table"""
    
    # Drop indexes
    op.execute("DROP INDEX IF EXISTS ix_contacts_created_at")
    op.execute("DROP INDEX IF EXISTS ix_contacts_is_resolved")
    op.execute("DROP INDEX IF EXISTS ix_contacts_status")
    op.execute("DROP INDEX IF EXISTS ix_contacts_email")
    op.execute("DROP INDEX IF EXISTS ix_contacts_parent_name")
    
    # Drop table
    op.execute("DROP TABLE IF EXISTS contacts")
    
    # Drop enum type
    op.execute("DROP TYPE IF EXISTS contactstatus")
