"""
FastAPI Application Entry Point
Main application setup with CORS, routers
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from fastapi.staticfiles import StaticFiles

# Initialize FastAPI app
app = FastAPI(
    title="HurshBinTech API",
    version="1.0.0",
    description="User management system with role-based authentication"
)

# ✅ CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "http://43.204.218.16:3000",  
        "http://43.204.218.16:8000", 
        "http://43.204.218.16",       
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],
    expose_headers=["*"],
)

# ✅ STATIC FILES
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ✅ IMPORT ALL ROUTERS HERE - Import directly from module files to avoid circular imports
from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.admin import router as admin_router
from app.api.endpoints.head import router as head_endpoint_router
from app.api.endpoints.profile import router as profile_router
from app.api.endpoints.sessions import router as sessions_router
from app.api.endpoints.learning_content import router as learning_content_router
from app.api.endpoints.learning_goals import router as learning_goals_router
from app.api.endpoints.learning_content_assignments import router as learning_content_assignments_router
from app.api.endpoints.vlogs import router as vlogs_router
from app.api.endpoints.websocket import router as websocket_router

# ✅ Import Learning Program routers
from app.api.endpoints.learning_program_assignments import head_router as head_lp_router, learner_router

# ✅ Include routers WITH prefix
app.include_router(auth_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(head_endpoint_router, prefix="/api")
app.include_router(profile_router, prefix="/api")
app.include_router(sessions_router, prefix="/api")
app.include_router(learning_goals_router, prefix="/api")
app.include_router(learning_content_router, prefix="/api/content")
app.include_router(learning_content_assignments_router, prefix="/api")
app.include_router(vlogs_router, prefix="/api/vlogs", tags=["vlogs"])

# ✅ Learning Program routers (correct)
app.include_router(head_lp_router, prefix="/api")        # Already has prefix="/api/head"
app.include_router(learner_router, prefix="/api")     # Already has prefix="/api/learner"

# ✅ WebSocket should NOT have /api prefix
app.include_router(websocket_router)
