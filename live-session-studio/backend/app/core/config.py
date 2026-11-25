"""
Standalone Live Session Studio - Settings
"""
import os
import secrets
from typing import List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings
import json


class Settings(BaseSettings):
    # Database - standalone independent DB
    DATABASE_URL: Optional[str] = None
    DB_USER: str = "lss_user"
    DB_PASSWORD: str = "lss_pass"
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 5432
    DB_NAME: str = "live_session_studio"

    # Security - generate a local secret; never reuse LMS key
    SECRET_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours for demo
    ALGORITHM: str = "HS256"

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:5174", "http://127.0.0.1:5174"]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                return json.loads(v)
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    # Storage paths (relative to backend root)
    UPLOADS_DIR: str = "uploads"
    RECORDINGS_DIR: str = "uploads/recordings"

    # FFmpeg
    FFMPEG_PATH: str = "ffmpeg"

    # Signed URL secret for file access (separate from JWT)
    FILE_SIGNING_SECRET: str = ""

    # ICE servers (JSON array of RTCIceServer dicts)
    ICE_SERVERS_JSON: str = '[{"urls": ["stun:stun.l.google.com:19302"]}]'

    @property
    def DATABASE_URI(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            if url.startswith("postgresql://") and "asyncpg" not in url:
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return url
        pw = self.DB_PASSWORD
        return f"postgresql+asyncpg://{self.DB_USER}:{pw}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def ICE_SERVERS(self) -> list:
        try:
            return json.loads(self.ICE_SERVERS_JSON)
        except Exception:
            return [{"urls": ["stun:stun.l.google.com:19302"]}]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()

# Auto-generate secrets if not set (first-run safety)
if not settings.SECRET_KEY:
    settings.SECRET_KEY = secrets.token_hex(32)
if not settings.FILE_SIGNING_SECRET:
    settings.FILE_SIGNING_SECRET = secrets.token_hex(32)
