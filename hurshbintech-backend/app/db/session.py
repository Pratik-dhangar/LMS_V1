"""
Database session configuration
Sets up async SQLAlchemy engine, session factory, and database dependency
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import settings

# Create async database engine
# This establishes the connection pool to PostgreSQL using asyncpg driver
engine = create_async_engine(
    settings.DATABASE_URI,
    echo=settings.DB_ECHO,  # Controlled by environment variable
    future=True,
    pool_pre_ping=True,  # Verify connections before using
    pool_size=20,  # Increased from 10 - number of persistent connections
    max_overflow=40,  # Increased from 20 - additional connections under load
    pool_timeout=30,  # Seconds to wait before timeout on getting connection
    pool_recycle=3600,  # Recycle connections after 1 hour to prevent stale connections
    echo_pool=False,  # Set to True for connection pool debugging
)

# Create async session factory
# This factory creates new database sessions for each request
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for all ORM models
# All database models inherit from this
Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def get_db_session():
    """Get database session for background tasks (same as get_db but for direct use)"""
    async with AsyncSessionLocal() as session:
        yield session
