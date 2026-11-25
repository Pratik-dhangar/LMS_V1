"""
All ORM models for Live Session Studio.
Import this in alembic env.py as the metadata target.
"""
from app.db.session import Base  # noqa: F401

# Import all models so SQLAlchemy / Alembic can discover them
from app.models.demo_profiles import DemoProfile  # noqa: F401
from app.models.rooms import Room  # noqa: F401
from app.models.memberships import RoomMembership  # noqa: F401
from app.models.whiteboard_state_model import WhiteboardState  # noqa: F401
from app.models.materials import Material  # noqa: F401
from app.models.session_notes_model import SessionNote  # noqa: F401
from app.models.session_feedback_model import SessionFeedback  # noqa: F401
from app.models.recording_model import Recording  # noqa: F401
from app.models.chat_model import RoomMessage  # noqa: F401
