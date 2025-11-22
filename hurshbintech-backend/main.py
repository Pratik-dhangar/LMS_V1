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
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],
    expose_headers=["*"],
)

# ✅ STATIC FILES
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# ✅ IMPORT ALL ROUTERS HERE
from app.api.endpoints import (
    auth,
    admin,
    head,
    profile,
    sessions,
    learning_content,
    learning_goals,
    learning_content_assignments,
    vlogs,
)
# Import websocket separately (not exported in __init__.py)
from app.api.endpoints import websocket

# ✅ Import Learning Program routers
from app.api.endpoints.learning_program_assignments import head_router, learner_router

# ✅ Include routers WITH prefix
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(head.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(learning_goals.router, prefix="/api")
app.include_router(learning_content.router, prefix="/api/content")
app.include_router(learning_content_assignments.router, prefix="/api")
app.include_router(vlogs.router, prefix="/api/vlogs", tags=["vlogs"])

# ✅ Learning Program routers (correct)
app.include_router(head_router, prefix="/api")        # Already has prefix="/api/head"
app.include_router(learner_router, prefix="/api")     # Already has prefix="/api/learner"

# ✅ WebSocket should NOT have /api prefix
app.include_router(websocket.router)
