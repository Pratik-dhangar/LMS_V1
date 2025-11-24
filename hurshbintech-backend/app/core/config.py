"""
Application configuration settings
Loads environment variables from .env file using Pydantic
Handles database connection string with password encoding
"""
from pydantic_settings import BaseSettings
from typing import List



class Settings(BaseSettings):
    
    # Database configuration
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str

    # Security JWT settings
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    
    # CORS for backend origin settings
    BACKEND_CORS_ORIGINS: List[str]
    
    @property
    def DATABASE_URI(self) -> str:
       
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    class Config:
        
        env_file = ".env"  
        case_sensitive = True 


# Global settings instance
# Import this in other modules: from app.core.config import settings
settings = Settings()