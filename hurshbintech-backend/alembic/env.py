"""
Alembic migration environment configuration
"""
from logging.config import fileConfig
from sqlalchemy import pool
from alembic import context
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

# Import your app's settings and models
from app.core.config import settings
from app.db.session import Base
from app.models import (
    user_model, 
    learning_content_model, 
    learning_goals_model,
    session_model
)
from app.models.learning_content_assignment_model import LearningContentAssignment
from app.models.learning_goal_assignment_model import LearningGoalAssignment
from app.models.vlog_model import Vlog
from app.models.session_report_model import SessionReport


# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set the SQLAlchemy URL from settings instead of alembic.ini
config.set_main_option('sqlalchemy.url', settings.DATABASE_URI)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(
        settings.DATABASE_URI,
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())