"""add_mode_of_expression_to_training_sessions

Revision ID: 20260602_01
Revises: 20260602
Create Date: 2026-06-02 16:20:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "20260602_01"
down_revision: Union[str, Sequence[str], None] = "20260602"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	"""Upgrade schema."""
    
	# 1. Create the ENUM type if it doesn't exist
	op.execute(
		"""
		DO $$
		BEGIN
			IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mode_of_expression_enum') THEN
				CREATE TYPE mode_of_expression_enum AS ENUM (
					'Identify', 'Point', 'Show', 'Vocalize', 'Name', 
					'Sign', 'Communicate', 'Write', 'Type'
				);
			END IF;
		END
		$$;
		"""
	)
    
	# 2. Add the column to the table
	op.execute(
		"""
		DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_name = 'training_sessions'
				  AND column_name = 'mode_of_expression'
			) THEN
				ALTER TABLE training_sessions
				ADD COLUMN mode_of_expression mode_of_expression_enum[] NULL;
			END IF;
		END
		$$;
		"""
	)


def downgrade() -> None:
	"""Downgrade schema."""
    
	# 1. Drop the column from the table
	op.execute(
		"""
		DO $$
		BEGIN
			IF EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_name = 'training_sessions'
				  AND column_name = 'mode_of_expression'
			) THEN
				ALTER TABLE training_sessions
				DROP COLUMN mode_of_expression;
			END IF;
		END
		$$;
		"""
	)
    
	# 2. Drop the ENUM type
	op.execute(
		"""
		DO $$
		BEGIN
			IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mode_of_expression_enum') THEN
				DROP TYPE mode_of_expression_enum;
			END IF;
		END
		$$;
		"""
	)

