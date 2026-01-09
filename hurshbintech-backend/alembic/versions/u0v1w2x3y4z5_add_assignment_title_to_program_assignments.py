"""add_assignment_title_to_program_assignments

Revision ID: u0v1w2x3y4z5
Revises: 202601061430
Create Date: 2026-01-05 11:00:00.000000

This migration adds the assignment_title field to program_assignments table
to allow heads to provide custom names for program assignments.

Changes:
- Add assignment_title column to program_assignments table (VARCHAR 255, NOT NULL)

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'u0v1w2x3y4z5'
down_revision: Union[str, Sequence[str], None] = '202601061430'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add assignment_title to program_assignments"""
    
    # Add assignment_title column to program_assignments table
    op.add_column('program_assignments',
        sa.Column('assignment_title', sa.String(255), nullable=True)
    )
    
    # Set default value for existing records (use program name for now)
    # This will be updated later if needed
    op.execute("""
        UPDATE program_assignments 
        SET assignment_title = COALESCE(
            (SELECT goal FROM learning_goals WHERE id = program_assignments.program_id), 
            'Program Assignment'
        )
        WHERE assignment_title IS NULL
    """)
    
    # Make column NOT NULL after populating existing records
    op.alter_column('program_assignments', 'assignment_title',
               existing_type=sa.String(255),
               nullable=False)


def downgrade() -> None:
    """Downgrade schema - Remove assignment_title from program_assignments"""
    
    op.drop_column('program_assignments', 'assignment_title')
