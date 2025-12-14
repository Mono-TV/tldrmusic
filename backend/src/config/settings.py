"""
Application Settings and Configuration
"""
import os
from typing import Optional, List
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables
    """
    # Application
    APP_NAME: str = "TLDR Music API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development, staging, production

    # API
    API_PREFIX: str = "/api"  # Unified API (no version prefix)
    CORS_ORIGINS: List[str] = ["http://localhost:8000", "http://localhost:3000", "http://localhost:8002", "http://127.0.0.1:8002"]

    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "tldrmusic"

    # Redis (for caching & rate limiting)
    REDIS_URL: Optional[str] = None

    # JWT Authentication
    JWT_SECRET_KEY: str = "your-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Phone Authentication (Twilio or similar)
    PHONE_AUTH_PROVIDER: str = "twilio"  # twilio, firebase, msg91
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_VERIFY_SERVICE_SID: Optional[str] = None

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    # Firebase (alternative for phone auth)
    FIREBASE_PROJECT_ID: Optional[str] = None
    FIREBASE_PRIVATE_KEY: Optional[str] = None
    FIREBASE_CLIENT_EMAIL: Optional[str] = None

    # YouTube API
    YOUTUBE_API_KEY: Optional[str] = None

    # Typesense (search)
    TYPESENSE_HOST: str = "localhost"
    TYPESENSE_PORT: int = 8108
    TYPESENSE_PROTOCOL: str = "http"
    TYPESENSE_API_KEY: Optional[str] = None

    # Storage (for artwork, user uploads)
    STORAGE_PROVIDER: str = "local"  # local, gcs, s3
    STORAGE_BUCKET: Optional[str] = None
    GCS_CREDENTIALS_PATH: Optional[str] = None

    # Rate Limiting
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60

    # Lyrics Provider
    LYRICS_PROVIDER: str = "lrclib"  # lrclib, musixmatch, genius

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance
    """
    return Settings()


# Convenience function
settings = get_settings()
