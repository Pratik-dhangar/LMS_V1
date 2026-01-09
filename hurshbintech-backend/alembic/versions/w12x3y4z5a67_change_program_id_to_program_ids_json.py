"""Change program_id to program_ids JSON array

Revision ID: w12x3y4z5a67
Revises: u0v1w2x3y4z5
Create Date: 2026-01-08 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'w12x3y4z5a67'
down_revision = 'u0v1w2x3y4z5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new program_ids column as JSON
    op.add_column('program_assignments', sa.Column('program_ids', sa.JSON(), nullable=True))
    
    # Migrate data from program_id to program_ids
    # Convert each program_id to a list with single element
    op.execute("""
        UPDATE program_assignments 
        SET program_ids = json_build_array(program_id)
        WHERE program_id IS NOT NULL
    """)
    
    # Make program_ids NOT NULL after migration
    op.alter_column('program_assignments', 'program_ids', nullable=False)
    
    # Drop the foreign key constraint on program_id
    op.drop_constraint('program_assignments_program_id_fkey', 'program_assignments', type_='foreignkey')
    
    # Drop the old program_id column
    op.drop_column('program_assignments', 'program_id')


def downgrade() -> None:
    # Add back program_id column
    op.add_column('program_assignments', sa.Column('program_id', sa.INTEGER(), nullable=True))
    
    # Migrate data back (use first program_id from array)
    op.execute("""
        UPDATE program_assignments 
        SET program_id = (program_ids->0)::integer
        WHERE program_ids IS NOT NULL AND json_array_length(program_ids) > 0
    """)
    
    # Add back the foreign key constraint
    op.create_foreign_key(
        'program_assignments_program_id_fkey',
        'program_assignments',
        'learning_goals',
        ['program_id'],
        ['id'],
        ondelete='CASCADE'
    )
    
    # Drop program_ids column
    op.drop_column('program_assignments', 'program_ids')
