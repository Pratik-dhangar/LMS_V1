"""add_program_type_to_learning_goals

Revision ID: d24a3be24e8f
Revises: 58f08ad258dd
Create Date: 2025-12-20 11:46:15.718747

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd24a3be24e8f'
down_revision: Union[str, Sequence[str], None] = '58f08ad258dd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create enum type if it doesn't exist
    op.execute("CREATE TYPE programtype AS ENUM ('IIP', 'HOME')")
    
    # Add program_type column with default value
    op.add_column('learning_goals', 
        sa.Column('program_type', sa.Enum('IIP', 'HOME', name='programtype'), 
                  nullable=False, server_default='IIP')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('learning_goals', 'program_type')
    op.execute("DROP TYPE programtype")
