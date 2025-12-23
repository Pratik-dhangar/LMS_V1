"""add content status tracking

Revision ID: l1m2n3o4p5q6
Revises: k0l1m2n3o4p5
Create Date: 2025-12-23

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'l1m2n3o4p5q6'
down_revision: Union[str, Sequence[str], None] = 'k0l1m2n3o4p5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum type
    op.execute("""
        CREATE TYPE contentcompletionstatus AS ENUM (
            'NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'LATE_SUBMITTED', 'REVIEWED'
        )
    """)
    
    # Add new columns to learner_content_assignments table
    op.add_column('learner_content_assignments',
        sa.Column('completion_status', sa.Enum('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'LATE_SUBMITTED', 'REVIEWED', name='contentcompletionstatus'), nullable=False, server_default='NOT_STARTED')
    )
    op.add_column('learner_content_assignments',
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column('learner_content_assignments',
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column('learner_content_assignments',
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column('learner_content_assignments',
        sa.Column('reviewed_by_head', sa.Integer(), nullable=True)
    )
    
    # Add foreign key constraint
    op.create_foreign_key(
        'fk_learner_content_assignments_reviewed_by_head',
        'learner_content_assignments',
        'users',
        ['reviewed_by_head'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    # Remove foreign key
    op.drop_constraint('fk_learner_content_assignments_reviewed_by_head', 'learner_content_assignments', type_='foreignkey')
    
    # Drop columns
    op.drop_column('learner_content_assignments', 'reviewed_by_head')
    op.drop_column('learner_content_assignments', 'reviewed_at')
    op.drop_column('learner_content_assignments', 'submitted_at')
    op.drop_column('learner_content_assignments', 'started_at')
    op.drop_column('learner_content_assignments', 'completion_status')
    
    # Drop enum type
    op.execute("DROP TYPE contentcompletionstatus")
