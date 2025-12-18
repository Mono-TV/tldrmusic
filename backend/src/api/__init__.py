"""
API Module
"""
from .routes import (
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
    curated_router,
)

__all__ = [
    "auth_router",
    "charts_router",
    "charts_v1_router",
    "songs_router",
    "artists_router",
    "library_router",
    "search_router",
    "rank_history_router",
    "regional_router",
    "global_router",
    "curated_router",
]
