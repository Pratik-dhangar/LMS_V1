"""
Programs Endpoints (Head and trainer read-only)

Base prefix: /api/head/programs and /api/trainer/programs

Rules:
  - Only the head who created a program can read, update, or delete it.
    - program structure (skills + sub-programs) and content can be updated.
  - Delete is a soft-delete (is_active = False) to keep historical session links intact.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_head, get_current_trainer
from app.crud import program_crud
from app.db.session import get_db
from app.models.user_model import HeadProfile, TrainerProfile
from app.schemas.program_schema import (
    ProgramCreate,
    ProgramListItem,
    ProgramResponse,
    ProgramUpdateContent,
)

logger = logging.getLogger(__name__)


async def _resolve_trainer_head_user_id(
    db: AsyncSession,
    current_trainer: TrainerProfile,
) -> Optional[int]:
    """Translate the trainer's head profile reference to the head user ID used by Program.head_id."""
    head_profile_id = getattr(current_trainer, "created_by_head_id", None)
    if not head_profile_id:
        return None

    result = await db.execute(select(HeadProfile).where(HeadProfile.id == head_profile_id))
    head_profile = result.scalar_one_or_none()
    if not head_profile:
        return None

    return head_profile.user_id

router = APIRouter(prefix="/head/programs", tags=["Programs"])


trainer_router = APIRouter(prefix="/trainer/programs", tags=["Trainer Programs"])


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
    Update a program's name, learner, skill/sub-program structure, and content.
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


@trainer_router.get("/", response_model=List[ProgramListItem])
async def list_programs_for_trainer(
    learner_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_trainer: TrainerProfile = Depends(get_current_trainer),
):
    """List active programs for the trainer's Head, optionally filtered by learner."""
    head_user_id = await _resolve_trainer_head_user_id(db, current_trainer)
    if not head_user_id:
        return []
    programs = await program_crud.get_programs_by_head(
        db, head_id=head_user_id, learner_id=learner_id
    )
    return programs


@trainer_router.get("/{program_id}", response_model=ProgramResponse)
async def get_program_for_trainer(
    program_id: int,
    db: AsyncSession = Depends(get_db),
    current_trainer: TrainerProfile = Depends(get_current_trainer),
):
    """Get full details for a single program belonging to the trainer's Head."""
    head_user_id = await _resolve_trainer_head_user_id(db, current_trainer)
    if not head_user_id:
        raise HTTPException(status_code=404, detail="Program not found")
    program = await program_crud.get_program_by_id(
        db, program_id, head_id=head_user_id
    )
    return program
