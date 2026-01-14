"""Update completion status enum values from NOT_STARTED to NEW

Revision ID: x13y4z5a67b8
Revises: w12x3y4z5a67
Create Date: 2026-01-12 17:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'x13y4z5a67b8'
down_revision = 'w12x3y4z5a67'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # First, change the column type from enum to varchar to allow NEW value
    op.execute("""
        ALTER TABLE program_assignments 
        ALTER COLUMN completion_status TYPE varchar(50) USING completion_status::text
    """)
    
    op.execute("""
        ALTER TABLE learner_content_assignments 
        ALTER COLUMN completion_status TYPE varchar(50) USING completion_status::text
    """)
    
    # Now update all existing NOT_STARTED values to NEW in the database
    op.execute("""
        UPDATE program_assignments 
        SET completion_status = 'NEW' 
        WHERE completion_status = 'NOT_STARTED'
    """)
    
    op.execute("""
        UPDATE learner_content_assignments 
        SET completion_status = 'NEW' 
        WHERE completion_status = 'NOT_STARTED'
    """)
    
    # Drop the old enum types since they're no longer needed
    op.execute("DROP TYPE IF EXISTS completionstatus CASCADE")
    op.execute("DROP TYPE IF EXISTS contentcompletionstatus CASCADE")


def downgrade() -> None:
    # Recreate old enum types
    op.execute("""
        CREATE TYPE completionstatus AS ENUM (
            'NOT_STARTED',
            'IN_PROGRESS',
            'COMPLETED'
        )
    """)
    
    op.execute("""
        CREATE TYPE contentcompletionstatus AS ENUM (
            'NOT_STARTED',
            'IN_PROGRESS',
            'SUBMITTED',
            'LATE_SUBMITTED',
            'REVIEWED',
            'RESUBMISSION_REQUIRED'
        )
    """)
    
    # Convert back to enum types
    op.execute("""
        UPDATE program_assignments 
        SET completion_status = 'NOT_STARTED' 
        WHERE completion_status = 'NEW'
    """)
    
    op.execute("""
        UPDATE learner_content_assignments 
        SET completion_status = 'NOT_STARTED' 
        WHERE completion_status = 'NEW'
    """)
    
    op.execute("""
        ALTER TABLE program_assignments 
        ALTER COLUMN completion_status TYPE completionstatus USING completion_status::completionstatus
    """)
    
    op.execute("""
        ALTER TABLE learner_content_assignments 
        ALTER COLUMN completion_status TYPE contentcompletionstatus USING completion_status::contentcompletionstatus
    """)
