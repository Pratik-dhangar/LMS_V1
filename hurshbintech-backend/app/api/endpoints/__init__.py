# Export all endpoint modules for import
from . import (
    auth,
    admin,
    head,
    profile,
    sessions,
    learning_content,
    learning_goals,
    learning_content_assignments,
    vlogs,
    websocket,
)

__all__ = [
    "auth",
    "admin",
    "head",
    "profile",
    "sessions",
    "learning_content",
    "learning_goals",
    "learning_content_assignments",
    "vlogs",
    "websocket",
]
