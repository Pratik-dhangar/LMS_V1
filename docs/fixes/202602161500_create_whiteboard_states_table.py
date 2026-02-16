"""create_whiteboard_states_table

Revision ID: 202602161500
Revises: 202602141430
Create Date: 2026-02-16 15:00:00.000000

This migration creates the whiteboard_states table for persisting whiteboard canvas state across reconnections:
1. Creates whiteboard_states table with JSONB storage for flexible data structure
2. Links to training_sessions via session_id foreign key
3. Supports both drawing strokes and canvas items (images, text, buckets, etc.)
4. Uses soft deletes via is_active flag for efficient canvas clearing
5. Creates composite indexes for optimal query performance
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '202602161500'
down_revision: Union[str, Sequence[str], None] = '202602141430'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Create whiteboard_states table"""
    
    # Create whiteboard_states table
    op.execute("""
        CREATE TABLE IF NOT EXISTS whiteboard_states (
            id SERIAL PRIMARY KEY,
            session_id VARCHAR(100) NOT NULL,
            state_type VARCHAR(20) NOT NULL,
            item_id VARCHAR(100) NOT NULL,
            data JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE,
            is_active BOOLEAN NOT NULL DEFAULT true,
            CONSTRAINT fk_whiteboard_session 
                FOREIGN KEY (session_id) 
                REFERENCES training_sessions(session_id) 
                ON DELETE CASCADE
        )
    """)
    
    # Create indexes for optimal query performance
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_whiteboard_states_id 
        ON whiteboard_states(id)
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_whiteboard_states_session_id 
        ON whiteboard_states(session_id)
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_whiteboard_states_item_id 
        ON whiteboard_states(item_id)
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_whiteboard_states_is_active 
        ON whiteboard_states(is_active)
    """)
    
    # Create composite indexes for efficient filtering queries
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_whiteboard_session_active 
        ON whiteboard_states(session_id, is_active)
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_whiteboard_session_type 
        ON whiteboard_states(session_id, state_type, is_active)
    """)


def downgrade() -> None:
    """Downgrade schema - Drop whiteboard_states table"""
    
    # Drop composite indexes
    op.execute("DROP INDEX IF EXISTS ix_whiteboard_session_type")
    op.execute("DROP INDEX IF EXISTS ix_whiteboard_session_active")
    
    # Drop single column indexes
    op.execute("DROP INDEX IF EXISTS ix_whiteboard_states_is_active")
    op.execute("DROP INDEX IF EXISTS ix_whiteboard_states_item_id")
    op.execute("DROP INDEX IF EXISTS ix_whiteboard_states_session_id")
    op.execute("DROP INDEX IF EXISTS ix_whiteboard_states_id")
    
    # Drop table
    op.execute("DROP TABLE IF EXISTS whiteboard_states")
