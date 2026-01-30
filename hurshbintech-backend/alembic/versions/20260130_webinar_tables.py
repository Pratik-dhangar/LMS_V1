"""Create webinar tables

Revision ID: 20260130_webinar
Revises: 20260121_chat_system
Create Date: 2026-01-30

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260130_webinar'
down_revision = '20260121_chat_system'
branch_labels = None
depends_on = None


def upgrade():
    # Create webinars table
    op.execute(sa.text("""
        CREATE TABLE webinars (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            meeting_link VARCHAR(500) NOT NULL,
            scheduled_date DATE NOT NULL,
            scheduled_time TIME NOT NULL,
            created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP DEFAULT now() NOT NULL,
            updated_at TIMESTAMP DEFAULT now() NOT NULL
        )
    """))
    
    op.execute(sa.text("CREATE INDEX ix_webinars_id ON webinars (id)"))
    op.execute(sa.text("CREATE INDEX ix_webinars_created_by_user_id ON webinars (created_by_user_id)"))
    
    # Create webinar_participants table
    op.execute(sa.text("""
        CREATE TABLE webinar_participants (
            id SERIAL PRIMARY KEY,
            webinar_id INTEGER NOT NULL REFERENCES webinars(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            unregistered_email VARCHAR(255),
            invitation_sent BOOLEAN DEFAULT FALSE,
            invitation_sent_at TIMESTAMP,
            invited_at TIMESTAMP DEFAULT now() NOT NULL
        )
    """))
    
    op.execute(sa.text("CREATE INDEX ix_webinar_participants_id ON webinar_participants (id)"))
    op.execute(sa.text("CREATE INDEX ix_webinar_participants_webinar_id ON webinar_participants (webinar_id)"))
    op.execute(sa.text("CREATE INDEX ix_webinar_participants_user_id ON webinar_participants (user_id)"))


def downgrade():
    op.execute(sa.text("DROP TABLE IF EXISTS webinar_participants"))
    op.execute(sa.text("DROP TABLE IF EXISTS webinars"))
