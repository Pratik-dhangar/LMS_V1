"""add session_reports table

Revision ID: session_reports_001
Revises: d4e6f7a8c9b0
Create Date: 2025-12-09 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = 'session_reports_001'
down_revision = 'd4e6f7a8c9b0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'session_reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('learner_id', sa.Integer(), nullable=False),
        sa.Column('program_id', sa.Integer(), nullable=True),
        sa.Column('program_name', sa.String(length=500), nullable=False),
        sa.Column('prompt_meter', sa.String(length=10), nullable=False),
        sa.Column('reinforcement_meter', sa.String(length=10), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['training_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['learner_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['program_id'], ['learning_goals.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_session_reports_session_id'), 'session_reports', ['session_id'], unique=False)
    op.create_index(op.f('ix_session_reports_learner_id'), 'session_reports', ['learner_id'], unique=False)
    op.create_index(op.f('ix_session_reports_program_id'), 'session_reports', ['program_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_session_reports_program_id'), table_name='session_reports')
    op.drop_index(op.f('ix_session_reports_learner_id'), table_name='session_reports')
    op.drop_index(op.f('ix_session_reports_session_id'), table_name='session_reports')
    op.drop_table('session_reports')
