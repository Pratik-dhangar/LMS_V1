"""remove_program_type_from_learning_goals

Revision ID: n3o4p5q6r7s8
Revises: m2n3o4p5q6r7
Create Date: 2025-12-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'n3o4p5q6r7s8'
down_revision: Union[str, Sequence[str], None] = 'm2n3o4p5q6r7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove program_type column from learning_goals table."""
    # Drop the program_type column
    op.drop_column('learning_goals', 'program_type')
    
    # Drop the programtype enum type
    op.execute("DROP TYPE IF EXISTS programtype")


def downgrade() -> None:
    """Restore program_type column to learning_goals table."""
    # Recreate the enum type
    op.execute("CREATE TYPE programtype AS ENUM ('IIP', 'HOME')")
    
    # Add program_type column back with default value
    op.add_column('learning_goals', 
        sa.Column('program_type', sa.Enum('IIP', 'HOME', name='programtype'), 
                  nullable=False, server_default='IIP')
    )
