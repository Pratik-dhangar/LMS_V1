"""
FastAPI Application Entry Point
Main application setup with CORS, routers
"""

import logging
import os
from pathlib import Path

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
from app.api.endpoints.admin import router as admin_router
from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.booking import router as booking_router
from app.api.endpoints.coach import router as coach_router
from app.api.endpoints.head import router as head_endpoint_router
from app.api.endpoints.health import router as health_router
from app.api.endpoints.learning_content import router as learning_content_router
from app.api.endpoints.learning_content_assignments import (
    router as learning_content_assignments_router,
)
from app.api.endpoints.learning_goals import router as learning_goals_router
from app.api.endpoints.learning_program_assignments import head_router as head_lp_router
from app.api.endpoints.learning_program_assignments import learner_router
from app.api.endpoints.profile import router as profile_router
from app.api.endpoints.session_reports import router as session_reports_router
from app.api.endpoints.sessions import router as sessions_router
from app.api.endpoints.session_notes import router as session_notes_router
from app.api.endpoints.vlogs import router as vlogs_router
from app.api.endpoints.websocket import router as websocket_router
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.core.request_logging import RequestLoggingMiddleware

# Setup logging first
setup_logging()
logger = logging.getLogger(__name__)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Initialize FastAPI app
app = FastAPI(
    title="HurshBinTech API",
    version="1.0.0",
    description="User management system with role-based authentication",
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
    print(f"Validation Error on {request.url}")
    print(f"Errors: {exc.errors()}")
    print(f"Body: {exc.body}")
    return JSONResponse(status_code=422, content={"detail": exc.errors(), "body": str(exc.body)})


# ✅ CORS Configuration
# If BACKEND_CORS_ORIGINS is empty, use sensible defaults for development & PWA
allowed_origins = (
    settings.BACKEND_CORS_ORIGINS
    if settings.BACKEND_CORS_ORIGINS
    else [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://hurshbin.lumesoftai.in:3001",  # ✅ PWA Frontend (Domain)
        "https://hurshbin.lumesoftai.in:8001",  # ✅ PWA Backend (Domain)
        "https://43.204.218.16:3001",            # IP Access (Backup)
        "https://43.204.218.16:8001",            # IP Access (Backup)
    ]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
app.include_router(auth_router, prefix="/api")
app.include_router(booking_router, prefix="/api/booking")
app.include_router(admin_router, prefix="/api")
app.include_router(head_endpoint_router, prefix="/api")
app.include_router(coach_router, prefix="/api")
app.include_router(profile_router, prefix="/api")
app.include_router(sessions_router, prefix="/api")
app.include_router(session_notes_router, prefix="/api")
app.include_router(learning_goals_router, prefix="/api")
app.include_router(learning_content_router, prefix="/api/content")
app.include_router(learning_content_assignments_router, prefix="/api")
app.include_router(vlogs_router, prefix="/api/vlogs", tags=["vlogs"])
app.include_router(session_reports_router, prefix="/api/session-reports", tags=["session-reports"])

# ✅ Learning Program routers (correct)
app.include_router(head_lp_router, prefix="/api")  # Already has prefix="/api/head"
app.include_router(learner_router, prefix="/api")  # Already has prefix="/api/learner"

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
