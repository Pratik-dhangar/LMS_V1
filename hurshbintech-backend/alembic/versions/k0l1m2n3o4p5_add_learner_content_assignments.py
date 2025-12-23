"""add learner_content_assignments table

Revision ID: k0l1m2n3o4p5
Revises: j9k0l1m2n3o4
Create Date: 2025-12-23 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'k0l1m2n3o4p5'
down_revision: Union[str, Sequence[str], None] = 'j9k0l1m2n3o4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create learner_content_assignments table
    op.create_table('learner_content_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('learner_id', sa.Integer(), nullable=False),
        sa.Column('content_id', sa.Integer(), nullable=False),
        sa.Column('assigned_by_head', sa.Integer(), nullable=True),
        sa.Column('program_assignment_id', sa.Integer(), nullable=True),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['assigned_by_head'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['content_id'], ['learning_contents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['learner_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['program_assignment_id'], ['program_assignments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_learner_content_assignments_content_id'), 'learner_content_assignments', ['content_id'], unique=False)
    op.create_index(op.f('ix_learner_content_assignments_learner_id'), 'learner_content_assignments', ['learner_id'], unique=False)
    op.create_index(op.f('ix_learner_content_assignments_program_assignment_id'), 'learner_content_assignments', ['program_assignment_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_learner_content_assignments_program_assignment_id'), table_name='learner_content_assignments')
    op.drop_index(op.f('ix_learner_content_assignments_learner_id'), table_name='learner_content_assignments')
    op.drop_index(op.f('ix_learner_content_assignments_content_id'), table_name='learner_content_assignments')
    op.drop_table('learner_content_assignments')
