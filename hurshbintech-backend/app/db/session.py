"""
Database session configuration
Sets up async SQLAlchemy engine, session factory, and database dependency
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.core.config import settings

# Create async database engine
# This establishes the connection pool to MySQL using aiomysql driver
engine = create_async_engine(
    settings.DATABASE_URI,
    echo=True,  
    future=True,  
    pool_pre_ping=True,  
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
