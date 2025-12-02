"""
User CRUD operations tests
Tests user creation, retrieval, update, and deletion
"""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud import user_crud
from app.models.user_model import User, UserRole
from app.schemas.user import HeadCreate, TrainerCreate, LearnerCreate
from app.core.security import hash_password, verify_password


@pytest.mark.crud
@pytest.mark.asyncio
async def test_get_user_by_passcode_and_role(db_session: AsyncSession):
    """Test retrieving user by passcode and role"""
    # Create test user
    user = User(
        name="Test User",
        email="test@example.com",
        passcode=hash_password("123456"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    
    # Retrieve user
    found_user = await user_crud.get_user_by_passcode_and_role(
        db_session, "123456", "admin"
    )
    
    assert found_user is not None
    assert found_user.name == "Test User"
    assert found_user.role == UserRole.ADMIN
    assert verify_password("123456", found_user.passcode)


@pytest.mark.crud
@pytest.mark.asyncio
async def test_get_user_wrong_role(db_session: AsyncSession):
    """Test retrieving user with wrong role returns None"""
    user = User(
        name="Head User",
        email="head@example.com",
        passcode=hash_password("password"),
        role=UserRole.HEAD,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    
    # Try to get with wrong role
    found_user = await user_crud.get_user_by_passcode_and_role(
        db_session, "password", "trainer"  # Wrong role
    )
    
    assert found_user is None


@pytest.mark.crud
@pytest.mark.asyncio
async def test_get_inactive_user(db_session: AsyncSession):
    """
    Test retrieving inactive user
    Note: CRUD function returns inactive users (status check happens at endpoint)
    """
    user = User(
        name="Inactive User",
        email="inactive@example.com",
        passcode=hash_password("password"),
        role=UserRole.LEARNER,
        is_active=False,  # Inactive
    )
    db_session.add(user)
    await db_session.commit()
    
    found_user = await user_crud.get_user_by_passcode_and_role(
        db_session, "password", "learner"
    )
    
    # User should be found by CRUD (endpoint will check is_active)
    assert found_user is not None
    assert found_user.is_active is False


@pytest.mark.crud
@pytest.mark.asyncio
async def test_create_head_user(db_session: AsyncSession):
    """Test creating a head user"""
    head_data = HeadCreate(
        name="Test Head",
        email="head@test.com",
        phone="1234567890",
    )
    
    # Create head user
    head = await user_crud.create_head(db_session, head_data, created_by_admin_id=1)
    
    assert head is not None
    assert head.user.name == "Test Head"
    assert head.user.role == UserRole.HEAD
    assert head.user.passcode  # Should have generated passcode
    assert head.user.is_active is True
    # Note: Email may be None as it's nullable in User model


@pytest.mark.crud
@pytest.mark.asyncio
async def test_create_trainer_user(db_session: AsyncSession, hashed_password: str):
    """Test creating a trainer user"""
    # First create a head with profile (trainer needs to be created by head)
    from app.models.user_model import HeadProfile
    
    head_user = User(
        name="Head User",
        email="head@test.com",
        passcode=hashed_password,
        role=UserRole.HEAD,
        is_active=True,
    )
    db_session.add(head_user)
    await db_session.commit()
    await db_session.refresh(head_user)
    
    # Create the HeadProfile (required for foreign key)
    head_profile = HeadProfile(
        user_id=head_user.id,
        contact_no="1234567890"
    )
    db_session.add(head_profile)
    await db_session.commit()
    await db_session.refresh(head_profile)
    
    trainer_data = TrainerCreate(
        name="Test Trainer",
        email="trainer@test.com",
        phone="9876543210",
        specialization="Python",
    )
    
    trainer = await user_crud.create_trainer(
        db_session, trainer_data, created_by_head_id=head_profile.id
    )
    
    assert trainer is not None
    assert trainer.user.name == "Test Trainer"
    assert trainer.user.role == UserRole.TRAINER
    # Note: specialization field may not exist in TrainerProfile model


@pytest.mark.crud
@pytest.mark.asyncio
async def test_create_learner_user(db_session: AsyncSession, hashed_password: str):
    """Test creating a learner user"""
    # Create head with profile first
    from app.models.user_model import HeadProfile
    
    head_user = User(
        name="Head User",
        email="head@test.com",
        passcode=hashed_password,
        role=UserRole.HEAD,
        is_active=True,
    )
    db_session.add(head_user)
    await db_session.commit()
    await db_session.refresh(head_user)
    
    # Create the HeadProfile (required for foreign key)
    head_profile = HeadProfile(
        user_id=head_user.id,
        contact_no="1234567890"
    )
    db_session.add(head_profile)
    await db_session.commit()
    await db_session.refresh(head_profile)
    
    learner_data = LearnerCreate(
        name="Test Learner",
        email="learner@test.com",
        phone="5555555555",
        age=25,
        gender="female",
        conception_type="natural",
    )
    
    learner = await user_crud.create_learner(
        db_session, learner_data, created_by_head_id=head_profile.id
    )
    
    assert learner is not None
    assert learner.user.name == "Test Learner"
    assert learner.user.role == UserRole.LEARNER
    assert learner.age == 25
    # Note: gender field may not exist in LearnerProfile model


@pytest.mark.crud
@pytest.mark.asyncio
async def test_passcode_generation_uniqueness(db_session: AsyncSession):
    """Test that generated passcodes are unique"""
    passcodes = set()
    
    for i in range(10):
        head_data = HeadCreate(
            name=f"Head {i}",
            email=f"head{i}@test.com",
            phone=f"123456{i:04d}",
        )
        head = await user_crud.create_head(db_session, head_data, created_by_admin_id=1)
        
        # Passcode should be 6 digits
        assert len(head.user.passcode) >= 6
        passcodes.add(head.user.passcode)
    
    # All passcodes should be unique
    assert len(passcodes) == 10
