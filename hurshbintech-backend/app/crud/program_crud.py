"""
Program CRUD Operations

Rules:
  - goal_ids are set at creation and NEVER modified after that.
  - content_ids can be updated freely via update_program_content().
  - Programs are soft-deleted (is_active = False) to preserve session history.
"""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.program_model import Program
from app.schemas.program_schema import ProgramCreate, ProgramUpdateContent


async def create_program(
    db: AsyncSession,
    head_id: int,
    data: ProgramCreate,
) -> Program:
    """Create a new program. goal_ids and skills are frozen at this point."""
    resolved_skill = data.skill if data.skill is not None else data.description
    program = Program(
        name=data.name,
        skill=resolved_skill,
        head_id=head_id,
        learner_id=data.learner_id,
        goal_ids=data.goal_ids or [],
        content_ids=data.content_ids or [],
        skills=[skill.model_dump() if hasattr(skill, 'model_dump') else skill for skill in (data.skills or [])],
        is_active=True,
    )
    db.add(program)
    await db.commit()
    await db.refresh(program)
    return program


async def get_programs_by_head(
    db: AsyncSession,
    head_id: int,
    learner_id: Optional[int] = None,
) -> List[Program]:
    """
    Return all active programs owned by this head.
    Pass learner_id to narrow the list for the scheduling dropdown.
    """
    query = select(Program).where(
        Program.head_id == head_id,
        Program.is_active == True,  # noqa: E712
    )
    if learner_id is not None:
        query = query.where(Program.learner_id == learner_id)
    query = query.order_by(Program.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


async def get_program_by_id(
    db: AsyncSession,
    program_id: int,
    head_id: int,
) -> Program:
    """
    Fetch a single program by PK, enforcing that it belongs to the requesting head.
    Raises 404 if not found or not owned.
    """
    result = await db.execute(
        select(Program).where(
            Program.id == program_id,
            Program.head_id == head_id,
        )
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Program {program_id} not found or not accessible",
        )
    return program


async def update_program_content(
    db: AsyncSession,
    program_id: int,
    head_id: int,
    data: ProgramUpdateContent,
) -> Program:
    """
    Update a program's name, skill, and/or content_ids.
    goal_ids are intentionally NOT touched here — they are locked at creation.
    """
    program = await get_program_by_id(db, program_id, head_id)

    if data.name is not None:
        program.name = data.name
    resolved_skill = data.skill if data.skill is not None else data.description
    if resolved_skill is not None:
        program.skill = resolved_skill
    if data.content_ids is not None:
        program.content_ids = data.content_ids

    program.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    await db.refresh(program)
    return program


async def soft_delete_program(
    db: AsyncSession,
    program_id: int,
    head_id: int,
) -> bool:
    """
    Soft-delete a program (is_active = False).
    Sessions that already reference this program still keep their program_id intact
    because the row is not removed.
    """
    program = await get_program_by_id(db, program_id, head_id)
    program.is_active = False
    program.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()
    return True
