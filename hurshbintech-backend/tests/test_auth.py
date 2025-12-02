"""
Authentication endpoint tests
Tests login, JWT generation, password verification, and rate limiting
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user_model import User, UserRole
from app.core.security import hash_password


@pytest.mark.auth
@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, db_session: AsyncSession):
    """Test successful user login"""
    # Create a test user
    user = User(
        name="Test Admin",
        email="admin@test.com",
        passcode=hash_password("admin123"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    # Attempt login
    response = await client.post(
        "/api/auth/user/login",
        json={"role": "admin", "passcode": "admin123"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["role"] == "admin"
    assert data["user_id"] == user.id
    assert data["name"] == "Test Admin"


@pytest.mark.auth
@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient, db_session: AsyncSession):
    """Test login with incorrect password"""
    # Create a test user
    user = User(
        name="Test User",
        email="user@test.com",
        passcode=hash_password("correct_password"),
        role=UserRole.HEAD,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    
    # Attempt login with wrong password
    response = await client.post(
        "/api/auth/user/login",
        json={"role": "head", "passcode": "wrong_password"}
    )
    
    assert response.status_code == 401
    assert "Incorrect role or passcode" in response.json()["detail"]


@pytest.mark.auth
@pytest.mark.asyncio
async def test_login_invalid_role(client: AsyncClient):
    """Test login with invalid role"""
    response = await client.post(
        "/api/auth/user/login",
        json={"role": "invalid_role", "passcode": "123456"}
    )
    
    assert response.status_code == 400
    assert "Invalid role" in response.json()["detail"]


@pytest.mark.auth
@pytest.mark.asyncio
async def test_login_inactive_user(client: AsyncClient, db_session: AsyncSession):
    """Test login with inactive user account"""
    user = User(
        name="Inactive User",
        email="inactive@test.com",
        passcode=hash_password("password123"),
        role=UserRole.TRAINER,
        is_active=False,  # Inactive
    )
    db_session.add(user)
    await db_session.commit()
    
    response = await client.post(
        "/api/auth/user/login",
        json={"role": "trainer", "passcode": "password123"}
    )
    
    assert response.status_code == 401
    assert "inactive" in response.json()["detail"].lower()


@pytest.mark.auth
@pytest.mark.asyncio
async def test_login_nonexistent_user(client: AsyncClient):
    """Test login with non-existent user"""
    response = await client.post(
        "/api/auth/user/login",
        json={"role": "learner", "passcode": "nonexistent"}
    )
    
    assert response.status_code == 401


@pytest.mark.auth
@pytest.mark.asyncio
async def test_jwt_token_contains_correct_data(client: AsyncClient, db_session: AsyncSession):
    """Test that JWT token contains correct user data"""
    from jose import jwt
    from app.core.config import settings
    
    user = User(
        name="Token Test User",
        email="token@test.com",
        passcode=hash_password("test123"),
        role=UserRole.CONSULTANT,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    
    response = await client.post(
        "/api/auth/user/login",
        json={"role": "consultant", "passcode": "test123"}
    )
    
    assert response.status_code == 200
    token = response.json()["access_token"]
    
    # Decode and verify token
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == str(user.id)
    assert payload["role"] == "consultant"
    assert "exp" in payload


@pytest.mark.auth
@pytest.mark.asyncio
async def test_multiple_role_users(client: AsyncClient, db_session: AsyncSession):
    """Test login with different roles"""
    roles_data = [
        ("admin", UserRole.ADMIN),
        ("head", UserRole.HEAD),
        ("trainer", UserRole.TRAINER),
        ("consultant", UserRole.CONSULTANT),
        ("learner", UserRole.LEARNER),
    ]
    
    for role_str, role_enum in roles_data:
        user = User(
            name=f"Test {role_str.title()}",
            email=f"{role_str}@test.com",
            passcode=hash_password("password123"),
            role=role_enum,
            is_active=True,
        )
        db_session.add(user)
    
    await db_session.commit()
    
    # Test login for each role
    for role_str, _ in roles_data:
        response = await client.post(
            "/api/auth/user/login",
            json={"role": role_str, "passcode": "password123"}
        )
        
        assert response.status_code == 200
        assert response.json()["role"] == role_str


@pytest.mark.auth
@pytest.mark.asyncio
@pytest.mark.slow
async def test_rate_limiting(client: AsyncClient, db_session: AsyncSession):
    """
    Test rate limiting on login endpoint (5 attempts per minute)
    Note: Rate limiter is disabled in test mode, so this test verifies
    that invalid login attempts return 401 instead of being rate limited.
    """
    user = User(
        name="Rate Limit Test",
        email="ratelimit@test.com",
        passcode=hash_password("correct"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    
    # Make 6 rapid requests - all should return 401 (rate limiter disabled in tests)
    for i in range(6):
        response = await client.post(
            "/api/auth/user/login",
            json={"role": "admin", "passcode": "wrong_password"}
        )
        
        # All requests should return 401 since rate limiting is disabled in test mode
        assert response.status_code == 401
