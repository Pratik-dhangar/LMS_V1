"""rename_learner_reference_data_file_type_to_data_type

Revision ID: f6dd5023749e
Revises: n3o4p5q6r7s8
Create Date: 2025-12-26 13:04:09.529831

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6dd5023749e'
down_revision: Union[str, Sequence[str], None] = 'n3o4p5q6r7s8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Rename file_type column to data_type in learner_reference_data table
    op.alter_column('learner_reference_data', 'file_type', new_column_name='data_type')


def downgrade() -> None:
    """Downgrade schema."""
    # Rename data_type column back to file_type in learner_reference_data table
    op.alter_column('learner_reference_data', 'data_type', new_column_name='file_type')
