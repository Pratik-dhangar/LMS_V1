"""
Application configuration settings
Loads environment variables from .env file using Pydantic
Handles database connection string with password encoding
"""
from pydantic_settings import BaseSettings
from typing import List, Optional



class Settings(BaseSettings):
    
    # Database configuration - either use DATABASE_URL or individual fields
    DATABASE_URL: Optional[str] = None
    DB_USER: Optional[str] = None
    DB_PASSWORD: Optional[str] = None
    DB_HOST: Optional[str] = None
    DB_PORT: Optional[int] = None
    DB_NAME: Optional[str] = None

    # Security JWT settings
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    
    # CORS for backend origin settings
    BACKEND_CORS_ORIGINS: List[str]
    
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
        
        env_file = ".env"  
        case_sensitive = True 


# Global settings instance
# Import this in other modules: from app.core.config import settings
settings = Settings()