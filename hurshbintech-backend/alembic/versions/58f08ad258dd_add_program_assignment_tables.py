"""add_program_assignment_tables

Revision ID: 58f08ad258dd
Revises: 7953f9e69f8f
Create Date: 2025-12-19 23:32:26.488789

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '58f08ad258dd'
down_revision: Union[str, Sequence[str], None] = '7953f9e69f8f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create program_assignments table
    op.create_table('program_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('learner_id', sa.Integer(), nullable=False),
        sa.Column('program_id', sa.Integer(), nullable=False),
        sa.Column('assigned_by_head', sa.Integer(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('duration_days', sa.Integer(), nullable=True),
        sa.Column('head_notes', sa.Text(), nullable=True),
        sa.Column('learner_notes', sa.Text(), nullable=True),
        sa.Column('completion_status', sa.Enum('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', name='completionstatus'), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('notification_sent', sa.Boolean(), nullable=False),
        sa.Column('assigned_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['assigned_by_head'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['learner_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['program_id'], ['learning_goals.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_program_assignments_completion_status'), 'program_assignments', ['completion_status'], unique=False)
    op.create_index(op.f('ix_program_assignments_id'), 'program_assignments', ['id'], unique=False)
    op.create_index(op.f('ix_program_assignments_learner_id'), 'program_assignments', ['learner_id'], unique=False)
    op.create_index(op.f('ix_program_assignments_program_id'), 'program_assignments', ['program_id'], unique=False)

    # Create program_learning_contents table
    op.create_table('program_learning_contents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('program_id', sa.Integer(), nullable=False),
        sa.Column('content_id', sa.Integer(), nullable=False),
        sa.Column('sequence_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['content_id'], ['learning_contents.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['program_id'], ['learning_goals.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_program_learning_contents_content_id'), 'program_learning_contents', ['content_id'], unique=False)
    op.create_index(op.f('ix_program_learning_contents_id'), 'program_learning_contents', ['id'], unique=False)
    op.create_index(op.f('ix_program_learning_contents_program_id'), 'program_learning_contents', ['program_id'], unique=False)

    # Create program_assignment_attachments table
    op.create_table('program_assignment_attachments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('assignment_id', sa.Integer(), nullable=False),
        sa.Column('uploaded_by', sa.Integer(), nullable=True),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('file_type', sa.Enum('IMAGE', 'VIDEO', 'PDF', name='attachmenttype'), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('thumbnail_url', sa.String(length=500), nullable=True),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['assignment_id'], ['program_assignments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_program_assignment_attachments_assignment_id'), 'program_assignment_attachments', ['assignment_id'], unique=False)
    op.create_index(op.f('ix_program_assignment_attachments_id'), 'program_assignment_attachments', ['id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop program_assignment_attachments
    op.drop_index(op.f('ix_program_assignment_attachments_id'), table_name='program_assignment_attachments')
    op.drop_index(op.f('ix_program_assignment_attachments_assignment_id'), table_name='program_assignment_attachments')
    op.drop_table('program_assignment_attachments')

    # Drop program_learning_contents
    op.drop_index(op.f('ix_program_learning_contents_program_id'), table_name='program_learning_contents')
    op.drop_index(op.f('ix_program_learning_contents_id'), table_name='program_learning_contents')
    op.drop_index(op.f('ix_program_learning_contents_content_id'), table_name='program_learning_contents')
    op.drop_table('program_learning_contents')

    # Drop program_assignments
    op.drop_index(op.f('ix_program_assignments_program_id'), table_name='program_assignments')
    op.drop_index(op.f('ix_program_assignments_learner_id'), table_name='program_assignments')
    op.drop_index(op.f('ix_program_assignments_id'), table_name='program_assignments')
    op.drop_index(op.f('ix_program_assignments_completion_status'), table_name='program_assignments')
    op.drop_table('program_assignments')

    # Drop ENUMs
    op.execute('DROP TYPE IF EXISTS completionstatus')
    op.execute('DROP TYPE IF EXISTS attachmenttype')
