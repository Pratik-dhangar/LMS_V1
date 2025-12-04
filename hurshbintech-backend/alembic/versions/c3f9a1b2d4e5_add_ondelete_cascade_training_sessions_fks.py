"""add ondelete cascade to training_sessions->users foreign keys

Revision ID: c3f9a1b2d4e5
Revises: d1f3c2b4e5f6_add_ondelete_cascade_profile_user_fks
Create Date: 2025-12-03 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c3f9a1b2d4e5'
down_revision = 'd1f3c2b4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # For each FK on training_sessions referencing users (trainer_id, learner_id, created_by_id),
    # drop the existing FK constraint (if any) and recreate it with ON DELETE CASCADE.
    bind = op.get_bind()

    sql = """
    DO $$
    DECLARE
      col text;
      conname text;
      cols text[] := ARRAY['trainer_id','learner_id','created_by_id'];
    BEGIN
      FOREACH col IN ARRAY cols LOOP
        SELECT c.conname INTO conname
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        JOIN LATERAL (
          SELECT a.attname
          FROM unnest(c.conkey) WITH ORDINALITY as k(attnum, ord)
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
        ) as a_col ON true
        WHERE c.contype = 'f'
          AND t.relname = 'training_sessions'
          AND a_col.attname = col
        LIMIT 1;

        IF conname IS NOT NULL THEN
          EXECUTE format('ALTER TABLE training_sessions DROP CONSTRAINT %I', conname);
        END IF;

        -- create a new named constraint with ON DELETE CASCADE
        EXECUTE format(
          'ALTER TABLE training_sessions ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES users(id) ON DELETE CASCADE',
          'fk_training_sessions_' || col || '_users', col
        );

      END LOOP;
    END$$;
    """

    bind.execute(sa.text(sql))


def downgrade():
    # Reverse: drop the constraints we created and recreate them without ON DELETE CASCADE
    bind = op.get_bind()

    sql = """
    DO $$
    DECLARE
      col text;
      cols text[] := ARRAY['trainer_id','learner_id','created_by_id'];
    BEGIN
      FOREACH col IN ARRAY cols LOOP
        -- drop the cascade constraint if exists
        BEGIN
          EXECUTE format('ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS %I', 'fk_training_sessions_' || col || '_users');
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;

        -- recreate without ON DELETE CASCADE
        EXECUTE format(
          'ALTER TABLE training_sessions ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES users(id)',
          'fk_training_sessions_' || col || '_users', col
        );
      END LOOP;
    END$$;
    """

    bind.execute(sa.text(sql))
