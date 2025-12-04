"""
Application configuration settings
Loads environment variables from .env file using Pydantic
Loads environment variables from .env.production file using Pydantic
Handles database connection string with password encoding
"""

import os
from typing import List, Optional

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
    BACKEND_CORS_ORIGINS: List[str] = []

    # Environment
    ENVIRONMENT: Optional[str] = "development"

    # AWS S3 Configuration
    USE_S3: bool = False
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "ap-south-1"
    S3_BUCKET_NAME: str = "hurshbintech-media-bucket"

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
