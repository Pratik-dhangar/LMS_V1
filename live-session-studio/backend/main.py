"""
Main FastAPI application for Live Session Studio.
Independent of the LMS runtime.
"""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: ensure upload dirs exist and seed demo profiles."""
    Path(settings.UPLOADS_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.RECORDINGS_DIR).mkdir(parents=True, exist_ok=True)
    Path(settings.UPLOADS_DIR + "/materials").mkdir(parents=True, exist_ok=True)
    Path(settings.UPLOADS_DIR + "/chat").mkdir(parents=True, exist_ok=True)

    # Seed demo profiles idempotently
    try:
        from app.db.session import AsyncSessionLocal
        from app.models.demo_profiles import DemoProfile
        from sqlalchemy import select

        SEED_PROFILES = [
            {"id": 1, "role": "trainer", "name": "Trainer Demo"},
            {"id": 2, "role": "learner", "name": "Learner One"},
            {"id": 3, "role": "learner", "name": "Learner Two"},
        ]
        async with AsyncSessionLocal() as db:
            for p in SEED_PROFILES:
                r = await db.execute(select(DemoProfile).where(DemoProfile.id == p["id"]))
                existing = r.scalar_one_or_none()
                if not existing:
                    db.add(DemoProfile(**p))
            await db.commit()
        logger.info("Demo profiles seeded.")
    except Exception as e:
        logger.warning(f"Profile seed skipped (DB may not be migrated yet): {e}")

    yield
    logger.info("Shutting down Live Session Studio backend.")


app = FastAPI(
    title="Live Session Studio",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
from app.api.endpoints import demo, rooms, materials, uploads, notes, recordings, chat, websocket

app.include_router(demo.router, prefix="/api/demo", tags=["demo"])
app.include_router(rooms.router, prefix="/api", tags=["rooms"])
app.include_router(materials.router, prefix="/api", tags=["materials"])
app.include_router(uploads.router, prefix="/api", tags=["uploads"])
app.include_router(notes.router, prefix="/api", tags=["notes"])
app.include_router(recordings.router, prefix="/api", tags=["recordings"])
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(websocket.router, tags=["websocket"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "live-session-studio"}


@app.get("/api/ice-servers")
async def ice_servers():
    return {"ice_servers": settings.ICE_SERVERS}
