from fastapi import APIRouter

from app.api.endpoints import (
    admin, auth, head, head_session_notes, sessions, vlogs, websocket, 
    booking, session_notes, program_assignments, about_us, coach_appointment_sessions,
    free_assessment
)
from app.api.endpoints.Communication import webinar

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(about_us.router, tags=["about-us"])
api_router.include_router(booking.router, prefix="/booking", tags=["booking"])
api_router.include_router(head.router, prefix="/head", tags=["head"])
api_router.include_router(head_session_notes.router, tags=["head-session-notes"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(coach_appointment_sessions.router, tags=["coach-appointment-sessions"])
api_router.include_router(free_assessment.router, tags=["free-assessment"])
api_router.include_router(websocket.router, tags=["websocket"])
api_router.include_router(vlogs.router, prefix="/vlogs", tags=["vlogs"])
api_router.include_router(program_assignments.router, tags=["program-assignments"])
api_router.include_router(webinar.router, prefix="/communication", tags=["communication", "webinar"])

