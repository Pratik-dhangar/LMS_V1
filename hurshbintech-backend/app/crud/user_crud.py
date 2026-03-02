"""
CRUD operations for all user types
"""

import enum
import logging
import random
import time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.user_model import (
    Admin,
    CoachProfile,
    HeadProfile,
    LearnerProfile,
    TrainerProfile,
    User,
    UserRole,
)
from app.schemas.user import (
    CoachCreate,
    CoachUpdate,
    HeadCreate,
    HeadUpdate,
    LearnerCreate,
    LearnerUpdate,
    TrainerCreate,
    TrainerUpdate,
    AdminUpdate,
)
from app.core.security import hash_password, verify_password, encrypt_passcode

# Get logger for this module
logger = logging.getLogger(__name__)


# ============ PASSCODE GENERATOR ============
# Generate a unique 6-digit passcode
def generate_passcode(role: str, name: str) -> str:

    random_number = random.randint(100000, 999999)
    return str(random_number)


# ============ CENTRALIZED USER AUTHENTICATION ============


# Get user by ID with relationships loaded
async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    """Get user by ID with all profile relationships loaded"""
    result = await db.execute(
        select(User)
        .options(
            joinedload(User.head_profile),
            joinedload(User.trainer_profile),
            joinedload(User.coach_profile),
            joinedload(User.learner_profile),
        )
        .where(User.id == user_id)
    )
    return result.scalar_one_or_none()


# Get user by passcode and role (for login)
async def get_user_by_passcode_and_role(db: AsyncSession, passcode: str, role: str) -> User | None:
    """
    Query User table by role and verify passcode hash
    Uses index on role for fast filtering
    Supports: admin, head, trainer, coach, learner
    
    Note: Cannot index on passcode because it's Fernet-encrypted in DB
    Must verify bcrypt hash (passcode_hash) in application code
    """
    start_time = time.time()
    logger.info(f"[CRUD_AUTH_START] Querying User table for role={role}, passcode={passcode[:3]}***")

    try:
        # Convert string role to UserRole enum
        role_enum_map = {
            "admin": UserRole.ADMIN,
            "head": UserRole.HEAD,
            "trainer": UserRole.TRAINER,
            "coach": UserRole.COACH,
            "learner": UserRole.LEARNER,
        }

        role_enum = role_enum_map.get(role.lower())
        if not role_enum:
            logger.warning(f"Invalid role: {role}")
            return None

        # Query all users with this role (uses role index for fast filtering)
        logger.info(f"[DB_SELECT_START] Executing SELECT query filtering by role")
        query_start = time.time()
        
        result = await db.execute(
            select(User).where(User.role == role_enum)
        )
        
        query_duration = time.time() - query_start
        logger.info(f"[DB_SELECT_END] SELECT query completed in {query_duration:.3f}s")
        
        users = result.scalars().all()
        
        if not users:
            total_duration = time.time() - start_time
            logger.info(f"[AUTH_FAILED] No users found with role={role_enum.value}. Total time: {total_duration:.3f}s")
            return None

        # Verify password hash for each user with matching role
        logger.info(f"[PASSWORD_VERIFY_START] Verifying password hash for {len(users)} users")
        verify_start = time.time()
        
        for user in users:
            if verify_password(passcode, user.passcode_hash):
                verify_duration = time.time() - verify_start
                total_duration = time.time() - start_time
                logger.info(
                    f"[PASSWORD_MATCH] Password matched for user: ID={user.id}, name={user.name}, role={user.role.value}, active={user.is_active}, Verify time: {verify_duration:.3f}s, Total time: {total_duration:.3f}s"
                )
                return user
        
        verify_duration = time.time() - verify_start
        total_duration = time.time() - start_time
        logger.info(f"[PASSWORD_NO_MATCH] Password hash verification failed. Verify time: {verify_duration:.3f}s, Total time: {total_duration:.3f}s")
        return None
            
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"[CRUD_AUTH_ERROR] Error during authentication: {str(e)}, Duration: {duration:.3f}s", exc_info=True)
        raise


# ============ ADMIN CRUD ============


# Get admin by passcode
async def get_admin_by_passcode(db: AsyncSession, passcode: str) -> Admin | None:
    logger.debug("Querying admin by passcode")
    result = await db.execute(select(Admin).where(Admin.passcode == passcode))
    admin = result.scalar_one_or_none()
    if admin:
        logger.debug(f"Found admin with ID: {admin.id}")
    else:
        logger.debug("No admin found with provided passcode")
    return admin


# Get admin by ID
async def get_admin_by_id(db: AsyncSession, admin_id: int) -> Admin | None:
    logger.debug(f"Querying admin by ID: {admin_id}")
    result = await db.execute(select(Admin).where(Admin.id == admin_id))
    admin = result.scalar_one_or_none()
    if admin:
        logger.debug(f"Found admin with ID: {admin.id}")
    else:
        logger.debug(f"No admin found with ID: {admin_id}")
    return admin


# Update admin profile
async def update_admin_profile(db: AsyncSession, admin_id: int, update_data: "AdminUpdate") -> User | None:
    """Update admin user profile"""
    logger.debug(f"Updating admin profile: {admin_id}")
    
    # Get user with admin role
    result = await db.execute(
        select(User).where(User.id == admin_id, User.role == UserRole.ADMIN)
    )
    admin = result.scalar_one_or_none()
    
    if not admin:
        logger.warning(f"Admin not found: {admin_id}")
        return None
    
    # Check if new email already exists (if being changed)
    if update_data.email and update_data.email != admin.email:
        existing = await db.execute(select(User).where(User.email == update_data.email))
        if existing.scalar_one_or_none():
            raise ValueError(f"Email {update_data.email} already exists")
    
    # Check if new contact number already exists (if being changed)
    if update_data.contact_number and update_data.contact_number != admin.contact_number:
        existing = await db.execute(select(User).where(User.contact_number == update_data.contact_number))
        if existing.scalar_one_or_none():
            raise ValueError(f"Contact number {update_data.contact_number} already exists")
    
    # Update fields
    update_items = update_data.model_dump(exclude_unset=True)
    for field, value in update_items.items():
        if value is not None:
            setattr(admin, field, value)
    
    await db.commit()
    await db.refresh(admin)
    logger.info(f"Updated admin profile: {admin_id}")
    return admin


# ============ HEAD CRUD ============


async def get_head_by_id(db: AsyncSession, head_id: int):
    """Get head profile with user data and reference files by profile ID"""
    result = await db.execute(
        select(HeadProfile)
        .options(joinedload(HeadProfile.user), joinedload(HeadProfile.reference_data))
        .where(HeadProfile.id == head_id)
    )
    return result.unique().scalar_one_or_none()


async def get_head_by_passcode(db: AsyncSession, passcode: str):
    """Get head by passcode (from User table)"""
    result = await db.execute(
        select(User)
        .options(joinedload(User.head_profile))
        .where(User.passcode == passcode, User.role == UserRole.HEAD)
    )
    return result.scalar_one_or_none()


async def get_all_heads(db: AsyncSession):
    """Get all head profiles with user data"""
    result = await db.execute(
        select(HeadProfile)
        .options(joinedload(HeadProfile.user))
        .options(joinedload(HeadProfile.reference_data))
    )
    return list(result.scalars().unique().all())


async def create_head(db: AsyncSession, head_data: HeadCreate, created_by_admin_id: int):
    """Create a new head with User and HeadProfile records"""
    logger.debug(f"Creating new head with name: {head_data.name}")

    # Generate passcode if not provided
    passcode = head_data.passcode or generate_passcode("HEAD", head_data.name)
    logger.debug("Generated passcode for new head")

    # Encrypt passcode for storage, hash for verification
    encrypted_passcode = encrypt_passcode(passcode)
    passcode_hash = hash_password(passcode)

    # Create User record first
    new_user = User(
        name=head_data.name,
        email=head_data.email,
        passcode=encrypted_passcode,  # Store encrypted, not plaintext
        passcode_hash=passcode_hash,
        role=UserRole.HEAD,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()  # Get the user ID

    # Create HeadProfile record
    new_head_profile = HeadProfile(
        user_id=new_user.id,
        age=head_data.age,
        address=head_data.address,
        qualification=head_data.qualification,
        experience=head_data.experience,
        date_of_joining=head_data.date_of_joining,
        experience_with_hurshbin=head_data.experience_with_hurshbin,
        interest=head_data.interest,
        self_description=head_data.self_description,
        future_vision=head_data.future_vision,
        number_of_sessions_done=head_data.number_of_sessions_done or 0,
        head_description=head_data.head_description,
        learners_guardian_description=head_data.learners_guardian_description,
        input_at_hurshbin=head_data.input_at_hurshbin,
        note_box=head_data.note_box,
        message_box=head_data.message_box,
        created_by_admin_id=created_by_admin_id,
    )

    db.add(new_head_profile)
    await db.commit()
    await db.refresh(new_head_profile)
    await db.refresh(new_user)
    logger.info(f"Successfully created head with ID: {new_head_profile.id}")

    # Attach user to profile for convenience
    new_head_profile.user = new_user
    # Store plaintext passcode as temporary attribute for response
    new_head_profile.plaintext_passcode = passcode
    return new_head_profile


async def update_head(db: AsyncSession, head_id: int, head_update: HeadUpdate):
    """Update head profile"""
    head = await get_head_by_id(db, head_id)
    if not head:
        return None

    # Update only provided profile fields
    update_data = head_update.model_dump(exclude_unset=True)

    # Handle name and email separately if provided (update User table)
    if "name" in update_data:
        head.user.name = update_data.pop("name")
    
    if "email" in update_data:
        head.user.email = update_data.pop("email")

    # Update profile fields
    for field, value in update_data.items():
        setattr(head, field, value)

    await db.commit()
    await db.refresh(head)
    return head


async def delete_head(db: AsyncSession, head_id: int) -> str | bool:
    """Delete a head profile and associated user record"""
    head = await get_head_by_id(db, head_id)
    if not head:
        return False

    # Import necessary models
    from app.models.user_model import HeadReferenceData, LearnerProfile, TrainerProfile, Appointment
    from sqlalchemy import delete, update
    
    # Get the user_id before deleting
    user_id = head.user_id
    
    # 1. Delete all reference data associated with this head
    await db.execute(
        delete(HeadReferenceData).where(HeadReferenceData.head_id == head_id)
    )
    
    # 2. Set created_by_head_id to NULL for all learners created by this head
    # (This is safe because ondelete='SET NULL' in the model)
    await db.execute(
        update(LearnerProfile)
        .where(LearnerProfile.created_by_head_id == head_id)
        .values(created_by_head_id=None)
    )
    
    # 3. Set created_by_head_id to NULL for all trainers created by this head
    # (This is safe because ondelete='SET NULL' in the model)
    await db.execute(
        update(TrainerProfile)
        .where(TrainerProfile.created_by_head_id == head_id)
        .values(created_by_head_id=None)
    )
    
    # 4. Set user_id to NULL for all appointments associated with this head user
    await db.execute(
        update(Appointment)
        .where(Appointment.user_id == user_id)
        .values(user_id=None, user_role=None)
    )
    
    await db.flush()  # Ensure all updates are done before deleting
    
    # 5. Delete user (will cascade to head profile due to relationship)
    user = head.user
    await db.delete(user)
    await db.commit()
    return "Head deleted successfully"


# ============ TRAINER CRUD ============


async def get_trainer_by_id(db: AsyncSession, trainer_id: int):
    """Get trainer profile with user data and reference files by profile ID"""
    result = await db.execute(
        select(TrainerProfile)
        .options(joinedload(TrainerProfile.user), joinedload(TrainerProfile.reference_data))
        .where(TrainerProfile.id == trainer_id)
    )
    return result.unique().scalar_one_or_none()


async def get_trainer_by_passcode(db: AsyncSession, passcode: str):
    """Get trainer by passcode (from User table)"""
    result = await db.execute(
        select(User)
        .options(joinedload(User.trainer_profile))
        .where(User.passcode == passcode, User.role == UserRole.TRAINER)
    )
    return result.scalar_one_or_none()


async def get_trainers_by_head(db: AsyncSession, head_id: int):
    """Get all trainers created by a specific head"""
    result = await db.execute(
        select(TrainerProfile)
        .options(
            joinedload(TrainerProfile.user),
            joinedload(TrainerProfile.reference_data)
        )
        .where(TrainerProfile.created_by_head_id == head_id)
    )
    return list(result.scalars().unique().all())


async def create_trainer(db: AsyncSession, trainer_data: TrainerCreate, created_by_head_id: int):
    """Create a new trainer with User and TrainerProfile records"""
    # Check if email already exists
    existing_user = await db.execute(
        select(User).where(User.email == trainer_data.email)
    )
    if existing_user.scalar_one_or_none():
        raise ValueError(f"Email {trainer_data.email} is already registered")
    
    # Generate passcode if not provided
    passcode = trainer_data.passcode or generate_passcode("TRAINER", trainer_data.name)

    # Encrypt passcode for storage, hash for verification
    encrypted_passcode = encrypt_passcode(passcode)
    passcode_hash = hash_password(passcode)

    # Create User record first
    new_user = User(
        name=trainer_data.name, 
        email=trainer_data.email,
        passcode=encrypted_passcode, 
        passcode_hash=passcode_hash, 
        role=UserRole.TRAINER, 
        is_active=True
    )
    db.add(new_user)
    await db.flush()

    # Create TrainerProfile record
    new_trainer_profile = TrainerProfile(
        user_id=new_user.id,
        age=trainer_data.age,
        address=trainer_data.address,
        qualification=trainer_data.qualification,
        experience=trainer_data.experience,
        date_of_joining=trainer_data.date_of_joining,
        experience_with_hurshbin=trainer_data.experience_with_hurshbin,
        interest=trainer_data.interest,
        self_description=trainer_data.self_description,
        future_vision=trainer_data.future_vision,
        number_of_sessions_done=trainer_data.number_of_sessions_done or 0,
        head_description=trainer_data.head_description,
        learners_guardian_description=trainer_data.learners_guardian_description,
        input_at_hurshbin=trainer_data.input_at_hurshbin,
        note_box=trainer_data.note_box,
        message_box=trainer_data.message_box,
        created_by_head_id=created_by_head_id,
    )

    db.add(new_trainer_profile)
    await db.commit()
    await db.refresh(new_trainer_profile)
    await db.refresh(new_user)

    new_trainer_profile.user = new_user
    # Store plaintext passcode as temporary attribute for response
    new_trainer_profile.plaintext_passcode = passcode
    return new_trainer_profile


async def update_trainer(db: AsyncSession, trainer_id: int, trainer_update: TrainerUpdate):
    """Update trainer profile"""
    trainer = await get_trainer_by_id(db, trainer_id)
    if not trainer:
        return None

    # Update only provided fields
    update_data = trainer_update.model_dump(exclude_unset=True)

    # Handle name and email separately if provided
    if "name" in update_data:
        trainer.user.name = update_data.pop("name")
    
    if "email" in update_data:
        trainer.user.email = update_data.pop("email")

    for field, value in update_data.items():
        setattr(trainer, field, value)

    await db.commit()
    await db.refresh(trainer)
    return trainer


# Delete trainer
async def delete_trainer(db: AsyncSession, trainer_id: int) -> str | bool:
    trainer = await get_trainer_by_id(db, trainer_id)
    if not trainer:
        return False

    # Import necessary models
    from app.models.user_model import Appointment
    from sqlalchemy import update
    
    # Get the user_id before deleting
    user_id = trainer.user_id
    
    # Set user_id to NULL for all appointments associated with this trainer
    # (Appointments can exist without user_id for guest bookings)
    await db.execute(
        update(Appointment)
        .where(Appointment.user_id == user_id)
        .values(user_id=None, user_role=None)
    )
    
    await db.flush()  # Ensure all updates are done before deleting
    
    # Delete user (will cascade to trainer profile due to relationship)
    user = trainer.user
    await db.delete(user)
    await db.commit()
    return "Trainer deleted successfully"


# ============ COACH CRUD ============
# Get coach by ID
async def get_coach_by_id(db: AsyncSession, coach_id: int):
    """Get coach profile with user data and reference files by profile ID"""
    result = await db.execute(
        select(CoachProfile)
        .options(joinedload(CoachProfile.user), joinedload(CoachProfile.reference_data))
        .where(CoachProfile.id == coach_id)
    )
    return result.unique().scalar_one_or_none()


# Get coach by passcode
async def get_coach_by_passcode(db: AsyncSession, passcode: str):
    """Get coach by passcode (from User table)"""
    result = await db.execute(
        select(User)
        .options(joinedload(User.coach_profile))
        .where(User.passcode == passcode, User.role == UserRole.COACH)
    )
    return result.scalar_one_or_none()


# Get coaches by head
async def get_coaches_by_head(db: AsyncSession, head_id: int):
    """Get all coaches in the system (all heads can see all coaches)"""
    result = await db.execute(
        select(CoachProfile)
        .options(
            joinedload(CoachProfile.user),
            joinedload(CoachProfile.reference_data)
        )
        .order_by(CoachProfile.id)
    )
    return list(result.scalars().unique().all())


# Create coach
async def create_coach(
    db: AsyncSession, coach_data: CoachCreate
):
    """Create a new coach with User and CoachProfile records"""
    # Generate passcode if not provided
    passcode = coach_data.passcode or generate_passcode("COACH", coach_data.name)

    # Encrypt passcode for storage, hash for verification
    encrypted_passcode = encrypt_passcode(passcode)
    passcode_hash = hash_password(passcode)

    # Create User record first
    new_user = User(
        name=coach_data.name,
        email=coach_data.email,
        passcode=encrypted_passcode,  # Store encrypted, not plaintext
        passcode_hash=passcode_hash,
        role=UserRole.COACH,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()

    # Create CoachProfile record
    new_coach_profile = CoachProfile(
        user_id=new_user.id,
        age=coach_data.age,
        address=coach_data.address,
        qualification=coach_data.qualification,
        experience=coach_data.experience,
        date_of_joining=coach_data.date_of_joining,
        availability_days=coach_data.availability_days,
        time_slots=coach_data.time_slots,
        specialization=coach_data.specialization,
        profile_picture_url=coach_data.profile_picture_url,
    )

    db.add(new_coach_profile)
    await db.commit()
    await db.refresh(new_coach_profile)
    await db.refresh(new_user)

    new_coach_profile.user = new_user
    # Store plaintext passcode as temporary attribute for response
    new_coach_profile.plaintext_passcode = passcode
    return new_coach_profile


# Update coach profile
async def update_coach(
    db: AsyncSession, coach_id: int, coach_update: CoachUpdate
):
    """Update coach profile"""
    coach = await get_coach_by_id(db, coach_id)
    if not coach:
        return None

    # Update only provided fields
    update_data = coach_update.model_dump(exclude_unset=True)

    # Handle name and email separately if provided
    if "name" in update_data:
        coach.user.name = update_data.pop("name")
    
    if "email" in update_data:
        coach.user.email = update_data.pop("email")

    for field, value in update_data.items():
        setattr(coach, field, value)

    await db.commit()
    await db.refresh(coach)
    return coach


async def delete_coach(db: AsyncSession, coach_id: int) -> str | bool:
    """Delete a coach profile and associated user record"""
    coach = await get_coach_by_id(db, coach_id)
    if not coach:
        return False

    user = coach.user
    await db.delete(user)
    await db.commit()
    return "Coach deleted successfully"


# ============ LEARNER CRUD ============


async def get_learner_by_id(db: AsyncSession, learner_id: int):
    """Get learner profile with user data and reference files by profile ID"""
    result = await db.execute(
        select(LearnerProfile)
        .options(joinedload(LearnerProfile.user), joinedload(LearnerProfile.reference_data))
        .where(LearnerProfile.id == learner_id)
    )
    learner = result.unique().scalar_one_or_none()

    # Convert enum objects to string values for response
    if learner:
        if isinstance(learner.conception_type, enum.Enum):
            learner.conception_type = learner.conception_type.value
        if isinstance(learner.caesarean_type, enum.Enum):
            learner.caesarean_type = learner.caesarean_type.value

    return learner


async def get_learner_by_passcode(db: AsyncSession, passcode: str):
    """Get learner by passcode (from User table)"""
    result = await db.execute(
        select(User)
        .options(joinedload(User.learner_profile))
        .where(User.passcode == passcode, User.role == UserRole.LEARNER)
    )
    return result.scalar_one_or_none()


async def get_learner_by_name(db: AsyncSession, name: str):
    """Get learner by name (from User table)"""
    result = await db.execute(
        select(User)
        .options(joinedload(User.learner_profile))
        .where(User.name == name, User.role == UserRole.LEARNER)
    )
    return result.scalar_one_or_none()


async def get_learners_by_head(db: AsyncSession, head_id: int):
    """Get all learners created by a specific head"""
    result = await db.execute(
        select(LearnerProfile)
        .options(
            joinedload(LearnerProfile.user),
            joinedload(LearnerProfile.reference_data)
        )
        .where(LearnerProfile.created_by_head_id == head_id)
    )
    learners = list(result.scalars().unique().all())

    # Convert enum objects to string values for response
    for learner in learners:
        if isinstance(learner.conception_type, enum.Enum):
            learner.conception_type = learner.conception_type.value
        if isinstance(learner.caesarean_type, enum.Enum):
            learner.caesarean_type = learner.caesarean_type.value

    return learners


async def create_learner(db: AsyncSession, learner_data: LearnerCreate, created_by_head_id: int):
    """Create a new learner with User and LearnerProfile records"""
    # Check if email already exists
    existing_user = await db.execute(
        select(User).where(User.email == learner_data.email)
    )
    if existing_user.scalar_one_or_none():
        raise ValueError(f"Email {learner_data.email} is already registered")

    # Check if contact number already exists
    if learner_data.contact_number:
        existing_contact = await db.execute(
            select(User).where(User.contact_number == learner_data.contact_number)
        )
        if existing_contact.scalar_one_or_none():
            raise ValueError(f"Contact number {learner_data.contact_number} is already registered")

    # Generate passcode if not provided
    passcode = learner_data.passcode or generate_passcode("LEARNER", learner_data.name)

    # Encrypt passcode for storage, hash for verification
    encrypted_passcode = encrypt_passcode(passcode)
    passcode_hash = hash_password(passcode)

    # Create User record first
    new_user = User(
        name=learner_data.name, 
        email=learner_data.email,
        contact_number=learner_data.contact_number,
        passcode=encrypted_passcode, 
        passcode_hash=passcode_hash, 
        role=UserRole.LEARNER, 
        is_active=True
    )
    db.add(new_user)
    await db.flush()

    # Convert enum fields to their string values
    caesarean_type_value = (
        learner_data.caesarean_type.value
        if isinstance(learner_data.caesarean_type, enum.Enum)
        else learner_data.caesarean_type
    )
    conception_type_value = (
        learner_data.conception_type.value
        if isinstance(learner_data.conception_type, enum.Enum)
        else learner_data.conception_type
    )

    # Create LearnerProfile record
    new_learner_profile = LearnerProfile(
        user_id=new_user.id,
        age=learner_data.age,
        dob=learner_data.dob,
        date_of_assessment=learner_data.date_of_assessment,
        dlb_concerns_checklist=learner_data.dlb_concerns_checklist,
        personal_notes=learner_data.personal_notes,
        # --- Delivery History ---
        mother_bed_rest=learner_data.mother_bed_rest,
        mother_bed_rest_duration=learner_data.mother_bed_rest_duration,
        mother_depressed_fearful=learner_data.mother_depressed_fearful,
        ultrasounds_performed=learner_data.ultrasounds_performed,
        was_premature=learner_data.was_premature,
        premature_weeks=learner_data.premature_weeks,
        was_overdue=learner_data.was_overdue,
        overdue_duration=learner_data.overdue_duration,
        caesarean_delivery=learner_data.caesarean_delivery,
        caesarean_type=caesarean_type_value,
        forceps_delivery=learner_data.forceps_delivery,
        vacuum_delivery=learner_data.vacuum_delivery,
        very_fast_labor=learner_data.very_fast_labor,
        induced_delivery=learner_data.induced_delivery,
        very_long_slow_labor=learner_data.very_long_slow_labor,
        conception_type=conception_type_value,
        was_adopted=learner_data.was_adopted,
        adoption_age=learner_data.adoption_age,
        in_incubator=learner_data.in_incubator,
        incubator_reason=learner_data.incubator_reason,
        had_jaundice=learner_data.had_jaundice,
        delivery_other_details=learner_data.delivery_other_details,
        # --- Medical History ---
        screamed_as_baby=learner_data.screamed_as_baby,
        difficult_sleep_pattern=learner_data.difficult_sleep_pattern,
        struggled_changing_routines=learner_data.struggled_changing_routines,
        difficulties_shifting_food=learner_data.difficulties_shifting_food,
        physical_milestones_achieved=learner_data.physical_milestones_achieved,
        vocal_language_milestones_achieved=learner_data.vocal_language_milestones_achieved,
        major_illness_hospitalization=learner_data.major_illness_hospitalization,
        major_illness_details=learner_data.major_illness_details,
        specific_medical_details=learner_data.specific_medical_details,
        # --- Learning history ---
        years_school_attended=learner_data.years_school_attended,
        support_provided=learner_data.support_provided,
        current_grade=learner_data.current_grade,
        current_learning_scenario=learner_data.current_learning_scenario,
        # --- History of intervention ---
        intervention_duration=learner_data.intervention_duration,
        intervention_notes=learner_data.intervention_notes,
        # --- Assessment behaviour ---
        assessment_behaviour_notes=learner_data.assessment_behaviour_notes,
        # --- Detailed skill development assessment ---
        skill_development_assessment=learner_data.skill_development_assessment,
        created_by_head_id=created_by_head_id,
    )

    db.add(new_learner_profile)
    await db.commit()  # Commit learner immediately to ensure it exists in database
    await db.refresh(new_learner_profile)
    await db.refresh(new_user)

    new_learner_profile.user = new_user
    # Store plaintext passcode as temporary attribute for response
    new_learner_profile.plaintext_passcode = passcode
    return new_learner_profile


async def update_learner(db: AsyncSession, learner_id: int, learner_update: LearnerUpdate):
    """Update learner profile"""
    learner = await get_learner_by_id(db, learner_id)
    if not learner:
        return None

    # Update only provided fields
    update_data = learner_update.model_dump(exclude_unset=True)

    # Handle name and email separately if provided
    if "name" in update_data:
        learner.user.name = update_data.pop("name")
    
    if "email" in update_data:
        learner.user.email = update_data.pop("email")
    
    if "contact_number" in update_data:
        learner.user.contact_number = update_data.pop("contact_number")

    # Convert enum objects to their string values for database storage
    for field, value in update_data.items():
        if isinstance(value, enum.Enum):
            update_data[field] = value.value

    for field, value in update_data.items():
        setattr(learner, field, value)

    await db.commit()
    await db.refresh(learner)
    # Ensure user relationship is loaded after refresh
    await db.refresh(learner.user)
    return learner


# Delete learner
async def delete_learner(db: AsyncSession, learner_id: int) -> str | bool:
    learner = await get_learner_by_id(db, learner_id)
    if not learner:
        return False

    # Import necessary models
    from app.models.user_model import Appointment, LearnerReferenceData
    from app.models.program_assignment_model import ProgramAssignment
    from sqlalchemy import update, delete
    
    # Get the user_id before deleting
    user_id = learner.user_id
    
    # Delete all reference data associated with this learner
    await db.execute(
        delete(LearnerReferenceData).where(LearnerReferenceData.learner_id == learner_id)
    )
    
    # Set user_id to NULL for all appointments associated with this learner
    await db.execute(
        update(Appointment)
        .where(Appointment.user_id == user_id)
        .values(user_id=None, user_role=None)
    )
    # Delete any program assignments tied to this learner to avoid FK nullification
    await db.execute(
        delete(ProgramAssignment).where(ProgramAssignment.learner_id == learner_id)
    )
    
    # Expunge learner from session to prevent SQLAlchemy from tracking relationship cascades
    db.expunge_all()
    
    # Now delete the user and learner profile using raw SQL to avoid ORM cascading issues
    from sqlalchemy import text
    
    # Delete learner profile first
    await db.execute(
        text("DELETE FROM learner_profiles WHERE user_id = :user_id"),
        {"user_id": user_id}
    )
    
    # Delete user record
    await db.execute(
        text("DELETE FROM users WHERE id = :user_id"),
        {"user_id": user_id}
    )
    
    await db.commit()
    return "Learner deleted successfully"


# ============ ADMIN VIEW - SYSTEM-WIDE QUERIES ============


async def get_all_trainers_system_wide(db: AsyncSession):
    """Get all trainers across all heads (for admin view)"""
    logger.info("Fetching all trainers system-wide for admin")
    result = await db.execute(
        select(TrainerProfile)
        .options(
            joinedload(TrainerProfile.user),
            joinedload(TrainerProfile.reference_data)
        )
        .order_by(TrainerProfile.id)
    )
    trainers = result.scalars().unique().all()
    logger.info(f"Found {len(trainers)} trainers system-wide")
    return trainers


async def get_all_coaches_system_wide(db: AsyncSession):
    """Get all coaches across all heads (for admin view)"""
    logger.info("Fetching all coaches system-wide for admin")
    result = await db.execute(
        select(CoachProfile)
        .options(
            joinedload(CoachProfile.user),
            joinedload(CoachProfile.reference_data)
        )
        .order_by(CoachProfile.id)
    )
    coaches = result.scalars().unique().all()
    logger.info(f"Found {len(coaches)} coaches system-wide")
    return coaches


async def get_all_learners_system_wide(db: AsyncSession):
    """Get all learners across all heads (for admin view)"""
    logger.info("Fetching all learners system-wide for admin")
    result = await db.execute(
        select(LearnerProfile)
        .options(
            joinedload(LearnerProfile.user),
            joinedload(LearnerProfile.reference_data)
        )
        .order_by(LearnerProfile.id)
    )
    learners = result.scalars().unique().all()
    logger.info(f"Found {len(learners)} learners system-wide")
    return learners


async def create_head_reference_data(
    db: AsyncSession,
    head_id: int,
    file_url: str,
    file_type: str,
    description: str = None,
) -> "HeadReferenceData":
    """Create a new reference data entry for a head"""
    from app.models.user_model import ReferenceDataType, HeadReferenceData
    
    # Map file extensions to ReferenceDataType enum
    type_mapping = {
        'pdf': 'PDF',
        'doc': 'DOCX',
        'docx': 'DOCX',
        'jpg': 'IMAGE',
        'jpeg': 'IMAGE',
        'png': 'IMAGE',
        'gif': 'IMAGE',
        'mp4': 'VIDEO',
        'avi': 'VIDEO',
        'mov': 'VIDEO',
    }
    
    # Get enum value, default to the file type string
    enum_value = type_mapping.get(file_type.lower(), 'LINK')
    
    new_reference = HeadReferenceData(
        head_id=head_id,
        data_type=enum_value,
        file_path=file_url,
        file_name=description,
        description=description,
    )
    db.add(new_reference)
    await db.commit()
    await db.refresh(new_reference)
    logger.info(f"Created head reference data: {file_url}")
    return new_reference


async def create_trainer_reference_data(
    db: AsyncSession,
    trainer_id: int,
    file_url: str,
    file_type: str,
    description: str = None,
) -> "TrainerReferenceData":
    """Create a new reference data entry for a trainer"""
    from app.models.user_model import ReferenceDataType, TrainerReferenceData
    
    # Map file extensions to ReferenceDataType enum
    type_mapping = {
        'pdf': 'PDF',
        'doc': 'DOCX',
        'docx': 'DOCX',
        'jpg': 'IMAGE',
        'jpeg': 'IMAGE',
        'png': 'IMAGE',
        'gif': 'IMAGE',
        'mp4': 'VIDEO',
        'avi': 'VIDEO',
        'mov': 'VIDEO',
    }
    
    # Get enum value, default to the file type string
    enum_value = type_mapping.get(file_type.lower(), 'LINK')
    
    new_reference = TrainerReferenceData(
        trainer_id=trainer_id,
        data_type=enum_value,
        file_path=file_url,
        file_name=description,
        description=description,
    )
    db.add(new_reference)
    await db.commit()
    await db.refresh(new_reference)
    logger.info(f"Created trainer reference data: {file_url}")
    return new_reference


async def create_coach_reference_data(
    db: AsyncSession,
    coach_id: int,
    file_url: str,
    file_type: str,
    description: str = None,
) -> "CoachReferenceData":
    """Create a new reference data entry for a coach"""
    from app.models.user_model import ReferenceDataType, CoachReferenceData
    
    # Map file extensions to ReferenceDataType enum
    type_mapping = {
        'pdf': 'PDF',
        'doc': 'DOCX',
        'docx': 'DOCX',
        'jpg': 'IMAGE',
        'jpeg': 'IMAGE',
        'png': 'IMAGE',
        'gif': 'IMAGE',
        'mp4': 'VIDEO',
        'avi': 'VIDEO',
        'mov': 'VIDEO',
    }
    
    # Get enum value, default to the file type string
    enum_value = type_mapping.get(file_type.lower(), 'LINK')
    
    new_reference = CoachReferenceData(
        coach_id=coach_id,
        data_type=enum_value,
        file_path=file_url,
        file_name=description,
        description=description,
    )
    db.add(new_reference)
    await db.commit()
    await db.refresh(new_reference)
    logger.info(f"Created coach reference data: {file_url}")
    return new_reference


async def create_learner_reference_data(
    db: AsyncSession,
    learner_id: int,
    file_url: str,
    file_type: str,
    description: str = None,
) -> "LearnerReferenceData":
    """Create a new reference data entry for a learner"""
    from app.models.user_model import ReferenceDataType, LearnerReferenceData
    
    # Map file extensions to ReferenceDataType enum
    type_mapping = {
        'pdf': 'PDF',
        'doc': 'DOCX',
        'docx': 'DOCX',
        'jpg': 'IMAGE',
        'jpeg': 'IMAGE',
        'png': 'IMAGE',
        'gif': 'IMAGE',
        'mp4': 'VIDEO',
        'avi': 'VIDEO',
        'mov': 'VIDEO',
    }
    
    # Get enum value, default to the file type string
    enum_value = type_mapping.get(file_type.lower(), 'LINK')
    
    new_reference = LearnerReferenceData(
        learner_id=learner_id,
        data_type=enum_value,
        file_path=file_url,
        file_name=description,
        description=description,
    )
    db.add(new_reference)
    await db.commit()  # Commit reference data
    await db.refresh(new_reference)
    logger.info(f"Created learner reference data: {file_url}")
    return new_reference
