"""
Pytest configuration and shared fixtures
Provides database session, test client, and authentication helpers
"""

import asyncio
import pytest
import os
from typing import AsyncGenerator, Generator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import NullPool
from httpx import AsyncClient
from slowapi.errors import RateLimitExceeded

# Set testing environment variable to disable rate limiting
os.environ["TESTING"] = "1"

from app.db.session import Base, get_db
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from main import app

# Test database URL (use separate test database)
TEST_DATABASE_URL = settings.DATABASE_URI.replace(settings.DB_NAME, f"{settings.DB_NAME}_test")

# Create test engine
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    poolclass=NullPool,  # Disable connection pooling for tests
)

# Create test session factory
TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Create a fresh database session for each test
    Rolls back after each test to ensure isolation
    """
    async with test_engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session
        await session.rollback()

    async with test_engine.begin() as conn:
        # Drop all tables after test
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    Create a test client with database session override
    """

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    # Disable rate limiter for tests by removing the middleware
    from main import limiter

    original_enabled = limiter.enabled
    limiter.enabled = False

    # Remove rate limit exception handler temporarily
    original_handlers = app.exception_handlers.copy()
    if RateLimitExceeded in app.exception_handlers:
        del app.exception_handlers[RateLimitExceeded]

    # Use ASGI transport for newer httpx versions
    from httpx import ASGITransport

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as test_client:
        yield test_client

    # Restore original state
    limiter.enabled = original_enabled
    app.exception_handlers = original_handlers
    app.dependency_overrides.clear()


@pytest.fixture
def admin_token() -> str:
    """Generate a valid admin JWT token for testing"""
    return create_access_token(data={"sub": "1", "role": "admin"})


@pytest.fixture
def head_token() -> str:
    """Generate a valid head JWT token for testing"""
    return create_access_token(data={"sub": "2", "role": "head"})


@pytest.fixture
def trainer_token() -> str:
    """Generate a valid trainer JWT token for testing"""
    return create_access_token(data={"sub": "3", "role": "trainer"})


@pytest.fixture
def learner_token() -> str:
    """Generate a valid learner JWT token for testing"""
    return create_access_token(data={"sub": "4", "role": "learner"})


@pytest.fixture
def sample_user_data() -> dict:
    """Sample user data for testing"""
    return {
        "name": "Test User",
        "email": "test@example.com",
        "passcode": "123456",
        "phone": "1234567890",
        "is_active": True,
    }


@pytest.fixture
def hashed_password() -> str:
    """Return a hashed password for testing"""
    return hash_password("123456")
