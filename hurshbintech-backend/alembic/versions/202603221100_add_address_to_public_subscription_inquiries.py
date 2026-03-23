"""add_address_to_public_subscription_inquiries

Revision ID: 202603221100
Revises: 202603221000
Create Date: 2026-03-22 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "202603221100"
down_revision: Union[str, Sequence[str], None] = "202603221000"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	"""Upgrade schema."""
	op.execute(
		"""
		DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_name = 'public_subscription_inquiries'
				  AND column_name = 'address'
			) THEN
				ALTER TABLE public_subscription_inquiries
				ADD COLUMN address TEXT;
			END IF;
		END
		$$;
		"""
	)


def downgrade() -> None:
	"""Downgrade schema."""
	op.execute(
		"""
		DO $$
		BEGIN
			IF EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_name = 'public_subscription_inquiries'
				  AND column_name = 'address'
			) THEN
				ALTER TABLE public_subscription_inquiries
				DROP COLUMN address;
			END IF;
		END
		$$;
		"""
	)
