"""
FastAPI Application Entry Point
Main application setup with CORS, routers
"""

import logging
import os
from pathlib import Path
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# Import all routers
from app.api.endpoints.media import router as media_router
from app.api.endpoints.about_us import router as about_us_router
from app.api.endpoints.admin import router as admin_router
from app.api.endpoints.assigned_trainings import router as assigned_trainings_router
from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.blogs import router as blogs_router
from app.api.endpoints.booking import router as booking_router
from app.api.endpoints.contact import router as contact_router
from app.api.endpoints.coach import router as coach_router
from app.api.endpoints.coach_appointment_sessions import router as coach_sessions_router
from app.api.endpoints.guest_sessions import router as guest_sessions_router
from app.api.endpoints.head import router as head_endpoint_router
from app.api.endpoints.head_session_notes import router as head_session_notes_router
from app.api.endpoints.health import router as health_router
from app.api.endpoints.learning_content import router as learning_content_router
from app.api.endpoints.learning_goals import router as learning_goals_router
# NOTE: Old learning_program_assignments replaced by program_assignments
# from app.api.endpoints.learning_program_assignments import head_router as head_lp_router
# from app.api.endpoints.learning_program_assignments import learner_router
from app.api.endpoints.program_assignments import router as program_assignments_router
from app.api.endpoints.programs import router as programs_router
from app.api.endpoints.profile import router as profile_router
from app.api.endpoints.session_reports import router as session_reports_router
from app.api.endpoints.sessions import router as sessions_router
from app.api.endpoints.session_notes import router as session_notes_router
from app.api.endpoints.vlogs import router as vlogs_router
from app.api.endpoints.websocket import router as websocket_router
from app.api.endpoints.products import router as products_router
from app.api.endpoints.store import router as store_router
from app.api.endpoints.cart import router as cart_router
from app.api.endpoints.ecommerce import router as ecommerce_router
from app.api.endpoints.subscription_inquiry import router as subscription_inquiry_router
from app.api.endpoints.Chat.chat import router as chat_router
from app.api.endpoints.Communication.webinar import router as webinar_router
from app.api.endpoints.vendors import router as vendors_router
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.core.request_logging import RequestLoggingMiddleware

# Setup logging first
setup_logging()
logger = logging.getLogger(__name__)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# ✅ Background Task Scheduler for Auto-Cleanup Jobs
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.workers.chat_message_cleanup import cleanup_old_messages
from app.workers.subscription_tasks import process_ended_sessions_task
from app.services.cache_service import cache_service

scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup and shutdown logic for the application.
    Manages the background scheduler lifecycle and Redis cache connection.
    """
    # STARTUP
    try:
        # Initialize Redis cache
        await cache_service.connect()
        
        if not scheduler.running:
            # Schedule chat message cleanup daily at 3 AM
            scheduler.add_job(cleanup_old_messages, 'cron', hour=3, minute=0, id='chat_cleanup', replace_existing=True)
            # Schedule session processing every 1 minute to handle subscription session counting (for immediate updates)
            scheduler.add_job(process_ended_sessions_task, 'interval', minutes=1, id='session_processing', replace_existing=True)
            scheduler.start()
            logger.info("✅ Background scheduler started")
            logger.info("   - Chat message cleanup: Daily at 3 AM")
            logger.info("   - Session processing: Every 1 minute")
    except Exception as e:
        logger.error(f"Failed to start scheduler: {str(e)}")
    
    yield
    
    # SHUTDOWN
    try:
        # Disconnect Redis
        await cache_service.disconnect()
        
        if scheduler.running:
            scheduler.shutdown(wait=False)
            logger.info("✅ Background scheduler shut down gracefully")
    except Exception as e:
        logger.error(f"Error during scheduler shutdown: {str(e)}")

# Initialize FastAPI app with lifespan
app = FastAPI(
    title="HurshBinTech API",
    version="1.0.0",
    description="User management system with role-based authentication",
    lifespan=lifespan
)

# Add rate limiter to app state only if not in testing mode
app.state.limiter = limiter
if not os.getenv("TESTING"):
    app.add_exception_handler(
        RateLimitExceeded, _rate_limit_exceeded_handler
    )  # ✅ Add custom validation error handler


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    """Custom handler for validation errors to provide detailed debugging info"""
    logger.error(f"Validation Error on {request.url}")
    logger.error(f"Errors: {exc.errors()}")
    logger.error(f"Body: {exc.body}")
    return JSONResponse(status_code=422, content={"detail": exc.errors(), "body": str(exc.body)})


# ✅ CORS Configuration
# Always allow FRONTEND_URL + any explicit BACKEND_CORS_ORIGINS.
# This ensures the frontend origin (e.g. :3001) can always reach the backend (:8001),
# regardless of which deployment environment is active (local, EC2, Neev Cloud).
import re

_cors_origins: list[str] = []

# Add explicit production origins from settings
if settings.BACKEND_CORS_ORIGINS:
    _cors_origins.extend(settings.BACKEND_CORS_ORIGINS)
    logger.info(f"CORS: added BACKEND_CORS_ORIGINS: {settings.BACKEND_CORS_ORIGINS}")

# Always add FRONTEND_URL so the PWA frontend can reach the API regardless of port
if settings.FRONTEND_URL and settings.FRONTEND_URL not in _cors_origins:
    _cors_origins.append(settings.FRONTEND_URL)
    logger.info(f"CORS: added FRONTEND_URL: {settings.FRONTEND_URL}")

# Development / no-config fallback — allow localhost on common ports
if not _cors_origins:
    _cors_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:8000",
        "*",
    ]
    logger.info("CORS: no origins configured — using development fallback (localhost + *)")

logger.info(f"CORS final allowed origins: {_cors_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
# ✅ REQUEST LOGGING
# Log all requests with timing and correlation IDs
app.add_middleware(RequestLoggingMiddleware)

# ✅ GZIP COMPRESSION
# Compress responses > 1000 bytes for better performance
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ✅ STATIC FILES
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ✅ Include routers WITH prefix
app.include_router(health_router, prefix="/api")  # Health check endpoint
app.include_router(media_router, prefix="/api")  # Generic S3 media proxy
app.include_router(auth_router, prefix="/api")
app.include_router(booking_router, prefix="/api/booking")
app.include_router(guest_sessions_router, prefix="/api")  # Public guest session endpoints
app.include_router(admin_router, prefix="/api")
app.include_router(assigned_trainings_router)  # Already has /api prefix in router
app.include_router(head_endpoint_router, prefix="/api")
app.include_router(head_session_notes_router, prefix="/api")
app.include_router(coach_router, prefix="/api")
app.include_router(coach_sessions_router, prefix="/api")
app.include_router(profile_router, prefix="/api")
app.include_router(sessions_router, prefix="/api")
app.include_router(session_notes_router, prefix="/api")
app.include_router(learning_goals_router, prefix="/api")
app.include_router(learning_content_router, prefix="/api/content")
app.include_router(vlogs_router, prefix="/api/vlogs", tags=["vlogs"])
app.include_router(blogs_router, prefix="/api", tags=["blogs"])
app.include_router(about_us_router, prefix="/api", tags=["about-us"])
app.include_router(contact_router, prefix="/api", tags=["contact"])
app.include_router(session_reports_router, prefix="/api/session-reports", tags=["session-reports"])

# NOTE: Old learning_program_assignments routes removed - replaced by program_assignments
# app.include_router(head_lp_router, prefix="/api")
# app.include_router(learner_router, prefix="/api")

# ✅ Program Assignments router (new - replaces old learning_program_assignments)
app.include_router(program_assignments_router, prefix="/api")

# ✅ Programs router (session-scoped goal+content containers)
app.include_router(programs_router, prefix="/api")

# ✅ E-Commerce routers
app.include_router(products_router, prefix="/api")  # Admin product management
app.include_router(store_router, prefix="/api")  # Public catalog browsing
app.include_router(cart_router, prefix="/api")  # Cart management
app.include_router(ecommerce_router, prefix="/api")  # Orders & payments
app.include_router(subscription_inquiry_router, prefix="/api")  # Public subscription inquiry form

# ✅ Vendor Management routers
app.include_router(vendors_router, prefix="/api")

# ✅ Chat router (REST + WebSocket)
app.include_router(chat_router)  # Chat has its own /api/chat prefix

# ✅ Communication routers (Webinar)
app.include_router(webinar_router, prefix="/api/communication", tags=["communication", "webinar"])

# ✅ WebSocket should NOT have /api prefix
app.include_router(websocket_router)


if __name__ == "__main__":
    environment = os.getenv("ENVIRONMENT", "local")

    if environment == "production":
        # HTTPS for EC2 - use ssl_keyfile and ssl_certfile
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=8000,
            ssl_keyfile="/app/certs/key.pem",
            ssl_certfile="/app/certs/cert.pem",
        )
    else:
        # HTTP for localhost
        uvicorn.run(app, host="0.0.0.0", port=8000)
