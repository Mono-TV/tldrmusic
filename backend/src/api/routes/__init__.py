"""
API Routes
"""
from .auth import router as auth_router
from .charts import router as charts_router, v1_router as charts_v1_router
from .songs import router as songs_router
from .artists import router as artists_router
from .library import router as library_router
from .search import router as search_router
from .rank_history import router as rank_history_router
from .regional import router as regional_router
from .global_chart import router as global_router
from .curated import router as curated_router
from .seo import router as seo_router

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
    "seo_router",
]
