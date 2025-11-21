from fastapi import APIRouter
from app.api.endpoints import auth, admin, head, sessions, websocket, vlogs

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(head.router, prefix="/head", tags=["head"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
api_router.include_router(websocket.router, tags=["websocket"])
api_router.include_router(vlogs.router, prefix="/vlogs", tags=["vlogs"])


