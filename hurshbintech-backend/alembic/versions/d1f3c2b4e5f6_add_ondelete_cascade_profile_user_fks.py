"""Add ON DELETE CASCADE to profile -> users foreign keys

Revision ID: d1f3c2b4e5f6
Revises: b32f14640083
Create Date: 2025-12-03 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd1f3c2b4e5f6'
down_revision = 'b32f14640083'
branch_labels = None
depends_on = None


def upgrade():
    # Drop existing FK constraints and recreate with ON DELETE CASCADE
    op.drop_constraint('head_profiles_user_id_fkey', 'head_profiles', type_='foreignkey')
    op.create_foreign_key(
        'head_profiles_user_id_fkey', 'head_profiles', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )

    op.drop_constraint('trainer_profiles_user_id_fkey', 'trainer_profiles', type_='foreignkey')
    op.create_foreign_key(
        'trainer_profiles_user_id_fkey', 'trainer_profiles', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )

    op.drop_constraint('consultant_profiles_user_id_fkey', 'consultant_profiles', type_='foreignkey')
    op.create_foreign_key(
        'consultant_profiles_user_id_fkey', 'consultant_profiles', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )

    op.drop_constraint('learner_profiles_user_id_fkey', 'learner_profiles', type_='foreignkey')
    op.create_foreign_key(
        'learner_profiles_user_id_fkey', 'learner_profiles', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )


def downgrade():
    # Recreate original constraints without ON DELETE CASCADE
    op.drop_constraint('head_profiles_user_id_fkey', 'head_profiles', type_='foreignkey')
    op.create_foreign_key('head_profiles_user_id_fkey', 'head_profiles', 'users', ['user_id'], ['id'])

    op.drop_constraint('trainer_profiles_user_id_fkey', 'trainer_profiles', type_='foreignkey')
    op.create_foreign_key('trainer_profiles_user_id_fkey', 'trainer_profiles', 'users', ['user_id'], ['id'])

    op.drop_constraint('consultant_profiles_user_id_fkey', 'consultant_profiles', type_='foreignkey')
    op.create_foreign_key('consultant_profiles_user_id_fkey', 'consultant_profiles', 'users', ['user_id'], ['id'])

    op.drop_constraint('learner_profiles_user_id_fkey', 'learner_profiles', type_='foreignkey')
    op.create_foreign_key('learner_profiles_user_id_fkey', 'learner_profiles', 'users', ['user_id'], ['id'])
