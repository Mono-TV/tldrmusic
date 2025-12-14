"""
TLDR Music API - Main Application

FastAPI application for the full music service.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings, Database
from .api import (
    auth_router,
    charts_router,
    charts_v1_router,
    songs_router,
    artists_router,
    library_router,
    search_router,
    rank_history_router,
    regional_router,
    global_router,
)

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}")

    # Connect to database (optional for development)
    if settings.MONGODB_URL and "localhost" not in settings.MONGODB_URL:
        await Database.connect()

    yield

    # Shutdown
    logger.info("Shutting down...")
    await Database.disconnect()


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
    TLDR Music API - India's aggregated music chart service.

    ## Features

    - **Charts**: India Top 25, Global Top 25, Regional charts
    - **Songs**: Full song details with lyrics, audio sources
    - **Artists**: Artist profiles and discographies
    - **Search**: Full-text search across songs and artists
    - **Library**: User favorites, playlists, history (requires auth)

    ## Authentication

    - Phone OTP authentication
    - Google OAuth 2.0

    For authenticated endpoints, include the Bearer token in the Authorization header.
    """,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


# Unified API routes (no version prefix)
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(charts_router, prefix=settings.API_PREFIX)
app.include_router(charts_v1_router, prefix=settings.API_PREFIX)  # V1 compat: /chart/*
app.include_router(songs_router, prefix=settings.API_PREFIX)
app.include_router(artists_router, prefix=settings.API_PREFIX)
app.include_router(library_router, prefix=settings.API_PREFIX)
app.include_router(search_router, prefix=settings.API_PREFIX)
app.include_router(rank_history_router, prefix=settings.API_PREFIX)
app.include_router(regional_router, prefix=settings.API_PREFIX)
app.include_router(global_router, prefix=settings.API_PREFIX)


# Root redirect
@app.get("/", include_in_schema=False)
async def root():
    """Redirect to API docs"""
    return {
        "message": "TLDR Music API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
