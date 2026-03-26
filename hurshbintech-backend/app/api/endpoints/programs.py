"""
Programs Endpoints (Head only)

Base prefix: /api/head/programs

Rules:
  - Only the head who created a program can read, update, or delete it.
  - goal_ids are set at creation and cannot be updated (enforced by ProgramUpdateContent schema).
  - content_ids are freely mutable.
  - Delete is a soft-delete (is_active = False) to keep historical session links intact.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_head
from app.crud import program_crud
from app.db.session import get_db
from app.models.user_model import HeadProfile
from app.schemas.program_schema import (
    ProgramCreate,
    ProgramListItem,
    ProgramResponse,
    ProgramUpdateContent,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/head/programs", tags=["Programs"])


@router.post(
    "/",
    response_model=ProgramResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_program(
    data: ProgramCreate,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """
    Create a new program for a learner.
    goal_ids are locked at creation — they cannot be changed afterwards.
    content_ids are optional and can be updated at any time.
    """
    logger.info(
        f"Head {current_head.user_id} creating program '{data.name}' for learner {data.learner_id}"
    )
    program = await program_crud.create_program(db, head_id=current_head.user_id, data=data)
    logger.info(f"Program {program.id} created successfully")
    return program


@router.get("/", response_model=List[ProgramListItem])
async def list_programs(
    learner_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """
    List all active programs for the current head.
    Pass ?learner_id= to filter by learner (used by the scheduling dropdown).
    """
    programs = await program_crud.get_programs_by_head(
        db, head_id=current_head.user_id, learner_id=learner_id
    )
    return programs


@router.get("/{program_id}", response_model=ProgramResponse)
async def get_program(
    program_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """Get full details for a single program (must belong to the requesting head)."""
    program = await program_crud.get_program_by_id(db, program_id, head_id=current_head.user_id)
    return program


@router.patch("/{program_id}", response_model=ProgramResponse)
async def update_program(
    program_id: int,
    data: ProgramUpdateContent,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """
    Update a program's name, description, and/or content_ids.
    goal_ids cannot be changed — they are locked at creation.
    To use different goals, create a new program.
    """
    logger.info(f"Head {current_head.user_id} updating program {program_id}")
    program = await program_crud.update_program_content(
        db, program_id, head_id=current_head.user_id, data=data
    )
    return program


@router.delete("/{program_id}", status_code=status.HTTP_200_OK)
async def delete_program(
    program_id: int,
    db: AsyncSession = Depends(get_db),
    current_head: HeadProfile = Depends(get_current_head),
):
    """
    Soft-delete a program (sets is_active = False).
    Existing sessions that reference this program are not affected.
    """
    logger.info(f"Head {current_head.user_id} soft-deleting program {program_id}")
    await program_crud.soft_delete_program(db, program_id, head_id=current_head.user_id)
    return {"message": f"Program {program_id} deleted successfully"}
