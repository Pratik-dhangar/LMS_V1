"""
Application configuration settings
Loads environment variables from .env file using Pydantic
Loads environment variables from .env.production file using Pydantic
Handles database connection string with password encoding
"""

import os
import json
from typing import List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):

    # Database configuration - either use DATABASE_URL or individual fields
    DATABASE_URL: Optional[str] = None
    DB_USER: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_HOST: Optional[str] = None
    DB_PORT: Optional[int] = None
    DB_NAME: Optional[str] = None

    # Security JWT settings
    SECRET_KEY: str = (
        "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"  # Default for testing
    )
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # Default 30 minutes
    ALGORITHM: Optional[str] = "HS256"
    
    # Encryption key for passcode storage (Fernet key - must be 32 url-safe base64-encoded bytes)
    ENCRYPTION_KEY: str = ""  # MUST be set in .env for production

    # Database settings
    DB_ECHO: bool = False  # Disable SQL logging in production

    # CORS for backend origin settings
    # Accepts any of these formats:
    #   JSON array:        ["https://example.com","https://example.com:3001"]
    #   Comma-separated:   https://example.com,https://example.com:3001
    #   Single URL:        https://example.com
    BACKEND_CORS_ORIGINS: List[str] = []

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return []
            # Try JSON array first
            if v.startswith("["):
                try:
                    return json.loads(v)
                except json.JSONDecodeError:
                    pass
            # Fall back to comma-separated
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v
    
    # Frontend URL for email links (environment-specific)
    FRONTEND_URL: str = "http://localhost:3000"  # Default to local port 3000
    # Can be overridden with FRONTEND_URL env var
    # Examples:
    # - Local: http://localhost:3000
    # - EC2: http://your-ec2-domain:3001 or https://your-ec2-domain
    # - Production: https://hurshbintech.com

    # Environment
    ENVIRONMENT: Optional[str] = "development"

    # AWS S3 Configuration
    USE_S3: bool = False
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "ap-south-1"
    S3_BUCKET_NAME: str = "hurshbintech-media-bucket"
    S3_ENDPOINT_URL: Optional[str] = None  # For S3-compatible services (e.g., Neev Cloud)
    
    # Recording Storage Configuration
    # Options: "local" (stores in /var/recordings) or "s3" (uploads to S3)
    RECORDING_STORAGE_MODE: str = "local"  # local | s3
    # Optional: base directory for local recording storage. If empty, factory will
    # default to backend `uploads/recordings` directory.
    RECORDINGS_BASE_DIR: Optional[str] = ""

    # Email Configuration (Brevo API)
    BREVO_API_KEY: Optional[str] = None  # Brevo API key
    SENDER_NAME: str = "Hurshbintech"
    SENDER_EMAIL: str = "noreply@hurshbintech.com"
    ENABLE_EMAIL: bool = True  # Toggle email sending on/off

    # Subscription Management Configuration
    SUBSCRIPTION_GRACE_PERIOD_DAYS: int = 7
    MAX_PAUSE_DURATION_DAYS: int = 90
    MAX_FREEZE_DURATION_DAYS: int = 180
    MAX_SESSION_ADJUSTMENT_AMOUNT: int = 10
    MAX_ADJUSTMENTS_PER_SUBSCRIPTION_HEAD: int = 3
    RENEWAL_REMINDER_DAYS: List[int] = [14, 7, 3]

    # Redis Cache Configuration
    REDIS_ENABLED: bool = False  # Enable/disable Redis caching
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None  # Set in production

    @property
    def DATABASE_URI(self) -> str:
        if self.DATABASE_URL:
            # Use DATABASE_URL if provided, convert to asyncpg
            return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
        # Otherwise build from individual fields
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    class Config:

        env_file = ".env.production" if os.getenv("ENVIRONMENT") == "production" else ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields like CORS_ORIGINS


# Global settings instance
# Import this in other modules: from app.core.config import settings
settings = Settings()

# Validate SECRET_KEY strength in production
if settings.ENVIRONMENT == "production" and len(settings.SECRET_KEY) < 32:
    raise ValueError(
        "SECRET_KEY must be at least 32 characters long in production. "
        "Generate a strong key using: openssl rand -hex 32"
    )
