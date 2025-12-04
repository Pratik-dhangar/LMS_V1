"""fix user foreign keys across related tables

Revision ID: e7a9b8c6d5f4
Revises: d4e6f7a8c9b0_ensure_training_sessions_fks_cascade
Create Date: 2025-12-03 00:20:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = 'e7a9b8c6d5f4'
down_revision = 'd4e6f7a8c9b0'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # learning_contents: created_by_admin_id, updated_by_id -> SET NULL
    conn.execute(sa.text("""
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'learning_contents') THEN
        -- ensure created_by_admin_id can be set NULL on delete
        BEGIN
          ALTER TABLE learning_contents ALTER COLUMN created_by_admin_id DROP NOT NULL;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;

        ALTER TABLE learning_contents DROP CONSTRAINT IF EXISTS learning_contents_created_by_admin_id_fkey;
        ALTER TABLE learning_contents ADD CONSTRAINT learning_contents_created_by_admin_id_fkey
          FOREIGN KEY (created_by_admin_id) REFERENCES users(id) ON DELETE SET NULL;

        ALTER TABLE learning_contents DROP CONSTRAINT IF EXISTS learning_contents_updated_by_id_fkey;
        ALTER TABLE learning_contents ADD CONSTRAINT learning_contents_updated_by_id_fkey
          FOREIGN KEY (updated_by_id) REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END$$;
    """))

    # learning_goal_assignments: learner_id -> CASCADE, assigned_by_head -> SET NULL
    conn.execute(sa.text("""
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'learning_goal_assignments') THEN
        ALTER TABLE learning_goal_assignments DROP CONSTRAINT IF EXISTS learning_goal_assignments_learner_id_fkey;
        ALTER TABLE learning_goal_assignments ADD CONSTRAINT learning_goal_assignments_learner_id_fkey
          FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE;

        ALTER TABLE learning_goal_assignments DROP CONSTRAINT IF EXISTS learning_goal_assignments_assigned_by_head_fkey;
        ALTER TABLE learning_goal_assignments ADD CONSTRAINT learning_goal_assignments_assigned_by_head_fkey
          FOREIGN KEY (assigned_by_head) REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END$$;
    """))

    # learning_content_assignments: learner_id -> CASCADE, assigned_by_head -> SET NULL
    conn.execute(sa.text("""
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'learning_content_assignments') THEN
        -- ensure assigned_by_head can be set NULL on delete
        BEGIN
          ALTER TABLE learning_content_assignments ALTER COLUMN assigned_by_head DROP NOT NULL;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;

        ALTER TABLE learning_content_assignments DROP CONSTRAINT IF EXISTS learning_content_assignments_learner_id_fkey;
        ALTER TABLE learning_content_assignments ADD CONSTRAINT learning_content_assignments_learner_id_fkey
          FOREIGN KEY (learner_id) REFERENCES users(id) ON DELETE CASCADE;

        ALTER TABLE learning_content_assignments DROP CONSTRAINT IF EXISTS learning_content_assignments_assigned_by_head_fkey;
        ALTER TABLE learning_content_assignments ADD CONSTRAINT learning_content_assignments_assigned_by_head_fkey
          FOREIGN KEY (assigned_by_head) REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END$$;
    """))


def downgrade():
    conn = op.get_bind()
    # Recreate without cascades (best-effort)
    conn.execute(sa.text("""
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'learning_contents') THEN
        ALTER TABLE learning_contents DROP CONSTRAINT IF EXISTS learning_contents_created_by_admin_id_fkey;
        ALTER TABLE learning_contents ADD CONSTRAINT learning_contents_created_by_admin_id_fkey
          FOREIGN KEY (created_by_admin_id) REFERENCES users(id);

        ALTER TABLE learning_contents DROP CONSTRAINT IF EXISTS learning_contents_updated_by_id_fkey;
        ALTER TABLE learning_contents ADD CONSTRAINT learning_contents_updated_by_id_fkey
          FOREIGN KEY (updated_by_id) REFERENCES users(id);
      END IF;

      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'learning_goal_assignments') THEN
        ALTER TABLE learning_goal_assignments DROP CONSTRAINT IF EXISTS learning_goal_assignments_learner_id_fkey;
        ALTER TABLE learning_goal_assignments ADD CONSTRAINT learning_goal_assignments_learner_id_fkey
          FOREIGN KEY (learner_id) REFERENCES users(id);

        ALTER TABLE learning_goal_assignments DROP CONSTRAINT IF EXISTS learning_goal_assignments_assigned_by_head_fkey;
        ALTER TABLE learning_goal_assignments ADD CONSTRAINT learning_goal_assignments_assigned_by_head_fkey
          FOREIGN KEY (assigned_by_head) REFERENCES users(id);
      END IF;

      IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'learning_content_assignments') THEN
        ALTER TABLE learning_content_assignments DROP CONSTRAINT IF EXISTS learning_content_assignments_learner_id_fkey;
        ALTER TABLE learning_content_assignments ADD CONSTRAINT learning_content_assignments_learner_id_fkey
          FOREIGN KEY (learner_id) REFERENCES users(id);

        ALTER TABLE learning_content_assignments DROP CONSTRAINT IF EXISTS learning_content_assignments_assigned_by_head_fkey;
        ALTER TABLE learning_content_assignments ADD CONSTRAINT learning_content_assignments_assigned_by_head_fkey
          FOREIGN KEY (assigned_by_head) REFERENCES users(id);
      END IF;
    END$$;
    """))
