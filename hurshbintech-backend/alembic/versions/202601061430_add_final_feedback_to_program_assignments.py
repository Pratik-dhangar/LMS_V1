"""add_final_feedback_to_program_assignments

Revision ID: 202601061430
Revises: t9u0v1w2x3y4
Create Date: 2026-01-06 14:30:00.000000

This migration adds final feedback fields to program_assignments table to support
Head's final rating and remarks for completed program assignments.

Changes:
- Add final_feedback_rating (1-5 stars) to program_assignments table
- Add final_feedback_remarks text field to program_assignments table
- Add final_feedback_given_at timestamp to program_assignments table

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '202601061430'
down_revision: Union[str, Sequence[str], None] = 't9u0v1w2x3y4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add final feedback fields to program_assignments"""
    
    # Add final feedback columns to program_assignments table
    op.add_column('program_assignments', 
        sa.Column('final_feedback_rating', sa.Integer(), nullable=True)
    )
    op.add_column('program_assignments', 
        sa.Column('final_feedback_remarks', sa.Text(), nullable=True)
    )
    op.add_column('program_assignments', 
        sa.Column('final_feedback_given_at', sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema - Remove final feedback fields from program_assignments"""
    
    # Remove final feedback columns from program_assignments table
    op.drop_column('program_assignments', 'final_feedback_given_at')
    op.drop_column('program_assignments', 'final_feedback_remarks')
    op.drop_column('program_assignments', 'final_feedback_rating')
