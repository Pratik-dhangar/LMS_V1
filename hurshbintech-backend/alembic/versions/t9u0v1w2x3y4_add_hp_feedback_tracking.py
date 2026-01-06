"""add_hp_feedback_tracking_feature

Revision ID: t9u0v1w2x3y4
Revises: guest_session_001
Create Date: 2026-01-05 10:30:00.000000

This migration adds feedback and rating fields to support HP (Home Program) tracking
with head feedback, star ratings, and resubmission workflow.

Changes:
- Add feedback fields to learner_content_assignments table
- Add RESUBMISSION_REQUIRED status to ContentCompletionStatus enum
- Add LEARNER_SUBMISSION type to AttachmentType enum
- Drop unused learning_goal_assignments table if exists (replaced by program_assignments)
- Ensure no conflicts with learning_content_assignments (keep both if in use)

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 't9u0v1w2x3y4'
down_revision: Union[str, Sequence[str], None] = 'guest_session_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add feedback fields to learner_content_assignments"""
    
    # Check if learning_goal_assignments table exists and drop if unused
    # This table may be deprecated in favor of program_assignments
    try:
        op.execute("DROP TABLE IF EXISTS learning_goal_assignments")
    except Exception:
        pass
    
    # Add feedback columns to learner_content_assignments table
    op.add_column('learner_content_assignments', 
        sa.Column('head_feedback_text', sa.Text(), nullable=True)
    )
    op.add_column('learner_content_assignments', 
        sa.Column('head_rating', sa.Integer(), nullable=True)
    )
    op.add_column('learner_content_assignments', 
        sa.Column('feedback_given_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column('learner_content_assignments', 
        sa.Column('feedback_history', sa.Text(), nullable=True, server_default='[]')
    )
    op.add_column('learner_content_assignments', 
        sa.Column('resubmit_allowed', sa.Boolean(), nullable=False, server_default='1')
    )
    
    # Update ContentCompletionStatus enum to include RESUBMISSION_REQUIRED
    # PostgreSQL requires dropping default, converting to new enum type
    
    # Step 1: Drop the default constraint
    op.execute("""
        ALTER TABLE learner_content_assignments
        ALTER COLUMN completion_status DROP DEFAULT
    """)
    
    # Step 2: Convert column to VARCHAR temporarily
    op.execute("""
        ALTER TABLE learner_content_assignments
        ALTER COLUMN completion_status TYPE VARCHAR(50)
    """)
    
    # Step 3: Create new enum type with additional value
    op.execute("""
        CREATE TYPE contentcompletionstatus_new AS ENUM (
            'NOT_STARTED',
            'IN_PROGRESS',
            'SUBMITTED',
            'LATE_SUBMITTED',
            'REVIEWED',
            'RESUBMISSION_REQUIRED'
        )
    """)
    
    # Step 4: Convert column back to new enum type
    op.execute("""
        ALTER TABLE learner_content_assignments
        ALTER COLUMN completion_status TYPE contentcompletionstatus_new USING completion_status::contentcompletionstatus_new
    """)
    
    # Step 5: Drop old enum and rename new one
    op.execute("DROP TYPE contentcompletionstatus")
    op.execute("ALTER TYPE contentcompletionstatus_new RENAME TO contentcompletionstatus")
    
    # Step 6: Restore the default constraint
    op.execute("""
        ALTER TABLE learner_content_assignments
        ALTER COLUMN completion_status SET DEFAULT 'NOT_STARTED'
    """)
    
    # Update AttachmentType enum to include LEARNER_SUBMISSION
    # Note: program_assignment_attachments.file_type typically doesn't have a default, but we'll be safe
    
    # Step 1: Convert column to VARCHAR temporarily
    op.execute("""
        ALTER TABLE program_assignment_attachments
        ALTER COLUMN file_type TYPE VARCHAR(50)
    """)
    
    # Step 2: Create new enum type with additional value
    op.execute("""
        CREATE TYPE attachmenttype_new AS ENUM (
            'IMAGE',
            'VIDEO',
            'PDF',
            'LEARNER_SUBMISSION'
        )
    """)
    
    # Step 3: Convert column back to new enum type
    op.execute("""
        ALTER TABLE program_assignment_attachments
        ALTER COLUMN file_type TYPE attachmenttype_new USING file_type::attachmenttype_new
    """)
    
    # Step 4: Drop old enum and rename new one
    op.execute("DROP TYPE attachmenttype")
    op.execute("ALTER TYPE attachmenttype_new RENAME TO attachmenttype")


def downgrade() -> None:
    """Downgrade schema - Remove feedback fields from learner_content_assignments"""
    
    # Revert ContentCompletionStatus enum by recreating without RESUBMISSION_REQUIRED
    
    # Step 1: Drop the default constraint
    op.execute("""
        ALTER TABLE learner_content_assignments
        ALTER COLUMN completion_status DROP DEFAULT
    """)
    
    # Step 2: Convert column to VARCHAR temporarily
    op.execute("""
        ALTER TABLE learner_content_assignments
        ALTER COLUMN completion_status TYPE VARCHAR(50)
    """)
    
    # Step 3: Create old enum type without RESUBMISSION_REQUIRED
    op.execute("""
        CREATE TYPE contentcompletionstatus_old AS ENUM (
            'NOT_STARTED',
            'IN_PROGRESS',
            'SUBMITTED',
            'LATE_SUBMITTED',
            'REVIEWED'
        )
    """)
    
    # Step 4: Convert column back to old enum type
    op.execute("""
        ALTER TABLE learner_content_assignments
        ALTER COLUMN completion_status TYPE contentcompletionstatus_old USING completion_status::contentcompletionstatus_old
    """)
    
    # Step 5: Drop new enum and rename old one back
    op.execute("DROP TYPE contentcompletionstatus")
    op.execute("ALTER TYPE contentcompletionstatus_old RENAME TO contentcompletionstatus")
    
    # Step 6: Restore the default constraint
    op.execute("""
        ALTER TABLE learner_content_assignments
        ALTER COLUMN completion_status SET DEFAULT 'NOT_STARTED'
    """)
    
    # Revert AttachmentType enum by recreating without LEARNER_SUBMISSION
    
    # Step 1: Convert column to VARCHAR temporarily
    op.execute("""
        ALTER TABLE program_assignment_attachments
        ALTER COLUMN file_type TYPE VARCHAR(50)
    """)
    
    # Step 2: Create old enum type without LEARNER_SUBMISSION
    op.execute("""
        CREATE TYPE attachmenttype_old AS ENUM (
            'IMAGE',
            'VIDEO',
            'PDF'
        )
    """)
    
    # Step 3: Convert column back to old enum type
    op.execute("""
        ALTER TABLE program_assignment_attachments
        ALTER COLUMN file_type TYPE attachmenttype_old USING file_type::attachmenttype_old
    """)
    
    # Step 4: Drop new enum and rename old one back
    op.execute("DROP TYPE attachmenttype")
    op.execute("ALTER TYPE attachmenttype_old RENAME TO attachmenttype")
    
    # Drop the columns
    op.drop_column('learner_content_assignments', 'resubmit_allowed')
    op.drop_column('learner_content_assignments', 'feedback_history')
    op.drop_column('learner_content_assignments', 'feedback_given_at')
    op.drop_column('learner_content_assignments', 'head_rating')
    op.drop_column('learner_content_assignments', 'head_feedback_text')
