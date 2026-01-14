"""CRUD operations for Assigned Training
"""
from typing import List, Optional, Dict, Any
from datetime import datetime

from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.assigned_training_model import AssignedTraining, AssignedTrainingUser
from app.models.user_model import User, UserRole


class AssignedTrainingCRUD:
    """CRUD operations for admin-created assigned trainings"""

    async def create_assigned_training(
        self,
        db: AsyncSession,
        title: str,
        description: Optional[str],
        custom_content: Optional[str],
        training_ref_ids: Optional[List[int]],
        target_roles: List[str],
        assigned_by_admin: int,
        active: bool = True,
        featured_image_url: Optional[str] = None,
        training_files: Optional[List[Dict[str, Any]]] = None,
        training_folder: Optional[str] = None,
        custom_metadata: Optional[Dict[str, Any]] = None,
    ) -> AssignedTraining:
        """Create a new assigned training"""
        db_training = AssignedTraining(
            title=title,
            description=description,
            custom_content=custom_content,
            training_ref_ids=training_ref_ids or [],
            target_roles=target_roles,  # Should be normalized to lowercase
            assigned_by_admin=assigned_by_admin,
            featured_image_url=featured_image_url,
            training_files=training_files or [],
            training_folder=training_folder,
            active=active,
            custom_metadata=custom_metadata or {},
        )
        db.add(db_training)
        await db.commit()
        await db.refresh(db_training)
        await db.refresh(db_training, ["assigned_by"])
        return db_training

    async def get_assigned_training(self, db: AsyncSession, training_id: int) -> Optional[AssignedTraining]:
        """Get assigned training by ID"""
        result = await db.execute(
            select(AssignedTraining)
            .options(selectinload(AssignedTraining.assigned_by))
            .filter(AssignedTraining.id == training_id)
        )
        return result.scalar_one_or_none()

    async def get_assigned_trainings(
        self,
        db: AsyncSession,
        skip: int = 0,
        limit: int = 10,
        active_only: bool = False,
        search: Optional[str] = None,
    ) -> tuple[List[AssignedTraining], int]:
        """Get paginated assigned trainings with optional filters"""
        query = select(AssignedTraining).options(selectinload(AssignedTraining.assigned_by))
        
        if active_only:
            query = query.filter(AssignedTraining.active == True)
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    AssignedTraining.title.ilike(search_term),
                    AssignedTraining.description.ilike(search_term),
                )
            )
        
        # Get total count
        count_result = await db.execute(select(func.count(AssignedTraining.id)).select_from(query.froms[0]))
        total = count_result.scalar()
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        trainings = result.scalars().all()
        
        return trainings, total

    async def update_assigned_training(
        self,
        db: AsyncSession,
        training_id: int,
        **kwargs,
    ) -> Optional[AssignedTraining]:
        """Update an assigned training"""
        training = await self.get_assigned_training(db, training_id)
        if not training:
            return None
        
        # Map of allowed fields
        allowed_fields = {
            "title", "description", "custom_content",
            "training_ref_ids", "target_roles", "active", "custom_metadata",
            "featured_image_url", "training_files", "training_folder"
        }
        
        for field, value in kwargs.items():
            if field in allowed_fields and value is not None:
                setattr(training, field, value)
        
        training.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(training)
        await db.refresh(training, ["assigned_by"])
        return training

    async def delete_assigned_training(self, db: AsyncSession, training_id: int) -> bool:
        """Delete an assigned training (soft or hard delete)"""
        training = await self.get_assigned_training(db, training_id)
        if not training:
            return False
        
        # Hard delete
        await db.delete(training)
        await db.commit()
        return True

    async def get_trainings_for_user(
        self,
        db: AsyncSession,
        user_role: str,
        skip: int = 0,
        limit: int = 10,
        active_only: bool = True,
    ) -> tuple[List[AssignedTraining], int]:
        """Get trainings visible to a user based on their role"""
        # Normalize role to lowercase
        normalized_role = user_role.lower()
        
        # Query trainings where user's role is in target_roles or 'all' is in target_roles
        # Using PostgreSQL JSON operators for array containment
        from sqlalchemy import literal, func as sql_func, cast, String
        
        query = select(AssignedTraining).options(selectinload(AssignedTraining.assigned_by))
        
        if active_only:
            query = query.filter(AssignedTraining.active == True)
        
        # Filter by role: target_roles contains user's role OR target_roles contains 'all'
        # PostgreSQL: use the @> operator to check if JSON array contains a value
        # target_roles is an array, so we check if it contains the role value
        query = query.filter(
            or_(
                # Check if the JSON array contains the user's role
                cast(AssignedTraining.target_roles, String).contains(f'"{normalized_role}"'),
                # Check if the JSON array contains 'all'
                cast(AssignedTraining.target_roles, String).contains('"all"'),
            )
        )
        
        # Get total count
        count_result = await db.execute(
            select(func.count(AssignedTraining.id)).filter(
                or_(
                    cast(AssignedTraining.target_roles, String).contains(f'"{normalized_role}"'),
                    cast(AssignedTraining.target_roles, String).contains('"all"'),
                )
            )
        )
        total = count_result.scalar() or 0
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        trainings = result.scalars().all()
        
        return trainings, total


class AssignedTrainingUserCRUD:
    """CRUD operations for per-user assigned training progress"""

    async def create_or_get_user_assignment(
        self,
        db: AsyncSession,
        assigned_training_id: int,
        user_id: int,
    ) -> AssignedTrainingUser:
        """Get existing user assignment or create new one (lazy creation)"""
        result = await db.execute(
            select(AssignedTrainingUser).filter(
                and_(
                    AssignedTrainingUser.assigned_training_id == assigned_training_id,
                    AssignedTrainingUser.user_id == user_id,
                )
            )
        )
        user_assignment = result.scalar_one_or_none()
        
        if user_assignment:
            return user_assignment
        
        # Create new user assignment
        user_assignment = AssignedTrainingUser(
            assigned_training_id=assigned_training_id,
            user_id=user_id,
            status="NEW",
        )
        db.add(user_assignment)
        await db.commit()
        await db.refresh(user_assignment)
        return user_assignment

    async def update_user_assignment_status(
        self,
        db: AsyncSession,
        assigned_training_id: int,
        user_id: int,
        status: str,
        progress: Optional[Dict[str, Any]] = None,
        evidence: Optional[str] = None,
    ) -> Optional[AssignedTrainingUser]:
        """Update user training status and optional progress/evidence"""
        user_assignment = await db.execute(
            select(AssignedTrainingUser).filter(
                and_(
                    AssignedTrainingUser.assigned_training_id == assigned_training_id,
                    AssignedTrainingUser.user_id == user_id,
                )
            )
        )
        user_assignment = user_assignment.scalar_one_or_none()
        
        if not user_assignment:
            return None
        
        user_assignment.status = status
        if progress is not None:
            user_assignment.progress = progress
        if evidence is not None:
            user_assignment.evidence = evidence
        
        if status == "IN_PROGRESS" and not user_assignment.started_at:
            user_assignment.started_at = datetime.utcnow()
        elif status == "COMPLETED":
            user_assignment.completed_at = datetime.utcnow()
        
        user_assignment.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(user_assignment)
        return user_assignment

    async def get_user_assignment(
        self,
        db: AsyncSession,
        assigned_training_id: int,
        user_id: int,
    ) -> Optional[AssignedTrainingUser]:
        """Get specific user assignment"""
        result = await db.execute(
            select(AssignedTrainingUser).filter(
                and_(
                    AssignedTrainingUser.assigned_training_id == assigned_training_id,
                    AssignedTrainingUser.user_id == user_id,
                )
            )
        )
        return result.scalar_one_or_none()

    async def get_user_assignments_for_training(
        self,
        db: AsyncSession,
        assigned_training_id: int,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[List[AssignedTrainingUser], int]:
        """Get all user assignments for a training"""
        query = select(AssignedTrainingUser).filter(
            AssignedTrainingUser.assigned_training_id == assigned_training_id
        )
        
        count_result = await db.execute(
            select(func.count(AssignedTrainingUser.id)).select_from(query.froms[0])
        )
        total = count_result.scalar()
        
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        assignments = result.scalars().all()
        
        return assignments, total


# Create singleton instances
assigned_training_crud = AssignedTrainingCRUD()
assigned_training_user_crud = AssignedTrainingUserCRUD()
