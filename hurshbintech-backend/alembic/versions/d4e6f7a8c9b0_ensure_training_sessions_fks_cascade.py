"""ensure training_sessions foreign keys use ON DELETE CASCADE

Revision ID: d4e6f7a8c9b0
Revises: c3f9a1b2d4e5_add_ondelete_cascade_training_sessions_fks
Create Date: 2025-12-03 00:10:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = 'd4e6f7a8c9b0'
down_revision = 'c3f9a1b2d4e5'
branch_labels = None
depends_on = None


def upgrade():
    # Drop known default-named constraints if they exist and recreate them with ON DELETE CASCADE
    conn = op.get_bind()

    # List of constraint names to normalize
    constraints = [
        ('training_sessions', 'training_sessions_trainer_id_fkey', 'trainer_id'),
        ('training_sessions', 'training_sessions_learner_id_fkey', 'learner_id'),
        ('training_sessions', 'training_sessions_created_by_id_fkey', 'created_by_id'),
    ]

    for table, conname, col in constraints:
        try:
            conn.execute(sa.text(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {conname};"))
        except Exception:
            # ignore
            pass

        # add the cascade constraint (named same as default for clarity)
        conn.execute(sa.text(
            f"ALTER TABLE {table} ADD CONSTRAINT {conname} FOREIGN KEY ({col}) REFERENCES users(id) ON DELETE CASCADE;"
        ))


def downgrade():
    conn = op.get_bind()
    constraints = [
        ('training_sessions', 'training_sessions_trainer_id_fkey', 'trainer_id'),
        ('training_sessions', 'training_sessions_learner_id_fkey', 'learner_id'),
        ('training_sessions', 'training_sessions_created_by_id_fkey', 'created_by_id'),
    ]

    for table, conname, col in constraints:
        try:
            conn.execute(sa.text(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {conname};"))
        except Exception:
            pass

        # recreate without cascade
        conn.execute(sa.text(
            f"ALTER TABLE {table} ADD CONSTRAINT {conname} FOREIGN KEY ({col}) REFERENCES users(id);"
        ))
