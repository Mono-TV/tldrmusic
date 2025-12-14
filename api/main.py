"""
TLDR Music API - FastAPI Backend
Serves music chart data from MongoDB
"""

from fastapi import FastAPI, HTTPException, Query, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from typing import Optional, List, Dict
import os

from database import Database, set_og_worker_ref
from models import (
    ChartResponse,
    SongResponse,
    RegionalResponse,
    SearchResponse,
    WeekListResponse,
    UploadChartRequest
)
from auth import (
    verify_google_token,
    create_access_token,
    create_refresh_token,
    verify_token,
    get_current_user,
    get_optional_user
)
from user_models import (
    GoogleLoginRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserProfile,
    SyncRequest,
    SyncResponse,
    FavoritesUpdate,
    HistoryUpdate,
    QueueUpdate,
    UserPreferences,
    SuccessResponse,
    UserInfo
)
from playlist_models import (
    PlaylistCreate,
    PlaylistUpdate,
    Playlist,
    PlaylistSummary,
    PlaylistListResponse,
    PlaylistResponse,
    AddSongRequest,
    RemoveSongsRequest,
    ReorderSongsRequest,
    PublishRequest,
    DiscoverPlaylistsResponse,
    SuccessResponse as PlaylistSuccessResponse
)
from og_image_models import (
    RegenerateOGImageRequest,
    OGImageStatusResponse
)
from og_image_worker import get_og_worker, stop_og_worker

# Initialize database
db = Database()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    await db.connect()
    # Start OG image worker and set reference for triggers
    og_worker = await get_og_worker(db)
    set_og_worker_ref(og_worker)
    yield
    # Stop OG image worker
    await stop_og_worker()
    set_og_worker_ref(None)
    await db.disconnect()


app = FastAPI(
    title="TLDR Music API",
    description="India's Top 25 Music Chart API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for OG images (local development)
og_images_path = os.getenv("LOCAL_STORAGE_PATH", "/tmp/og-images")
os.makedirs(og_images_path, exist_ok=True)
app.mount("/og-images", StaticFiles(directory=og_images_path), name="og-images")


# API Key verification for admin endpoints
async def verify_admin_key(x_api_key: str = Header(None)):
    """Verify admin API key for protected endpoints."""
    admin_key = os.environ.get("ADMIN_API_KEY", "dev-key-change-me")
    if x_api_key != admin_key:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return True


# ============================================================
# CHART ENDPOINTS
# ============================================================

@app.get("/", tags=["Info"])
async def root():
    """API health check and info."""
    return {
        "name": "TLDR Music API",
        "version": "1.0.0",
        "status": "healthy",
        "endpoints": {
            "current_chart": "/chart/current",
            "historical_chart": "/chart/{week}",
            "available_weeks": "/chart/history",
            "search": "/search",
            "regional": "/regional",
            "regional_by_name": "/regional/{region}"
        }
    }


@app.get("/chart/current", response_model=ChartResponse, tags=["Charts"])
async def get_current_chart():
    """Get the current week's chart."""
    chart = await db.get_current_chart()
    if not chart:
        raise HTTPException(status_code=404, detail="No chart data available")
    return chart


@app.get("/chart/history", response_model=WeekListResponse, tags=["Charts"])
async def get_chart_history():
    """Get list of all available chart weeks."""
    weeks = await db.get_available_weeks()
    return {"weeks": weeks, "total": len(weeks)}


@app.get("/chart/{week}", response_model=ChartResponse, tags=["Charts"])
async def get_chart_by_week(week: str):
    """
    Get chart for a specific week.

    Week format: YYYY-Www (e.g., 2025-W50)
    """
    chart = await db.get_chart_by_week(week)
    if not chart:
        raise HTTPException(status_code=404, detail=f"No chart found for week {week}")
    return chart


# ============================================================
# SEARCH ENDPOINTS
# ============================================================

@app.get("/search", response_model=SearchResponse, tags=["Search"])
async def search_songs(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
    include_regional: bool = Query(True, description="Include regional charts")
):
    """
    Search songs by title or artist.

    Searches across all historical charts and regional data.
    """
    results = await db.search_songs(q, limit, include_regional)
    return {
        "query": q,
        "results": results,
        "total": len(results)
    }


@app.get("/song/{song_id}", response_model=SongResponse, tags=["Search"])
async def get_song_by_id(song_id: str):
    """Get a specific song by its ID."""
    song = await db.get_song_by_id(song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return song


# ============================================================
# REGIONAL ENDPOINTS
# ============================================================

@app.get("/regional", response_model=RegionalResponse, tags=["Regional"])
async def get_all_regional():
    """Get all regional charts from the current week."""
    regional = await db.get_regional_charts()
    if not regional:
        raise HTTPException(status_code=404, detail="No regional data available")
    return {"regions": regional}


@app.get("/regional/{region}", tags=["Regional"])
async def get_regional_by_name(region: str):
    """
    Get a specific regional chart.

    Available regions: telugu, punjabi, bhojpuri, haryanvi, hindi, tamil, bengali, marathi, kannada, malayalam, gujarati
    """
    data = await db.get_regional_by_name(region.lower())
    if not data:
        raise HTTPException(status_code=404, detail=f"Regional chart '{region}' not found")
    return data


# ============================================================
# GLOBAL ENDPOINTS
# ============================================================

@app.get("/global", tags=["Global"])
async def get_global_chart():
    """Get the consolidated global Top 25 chart."""
    global_chart = await db.get_global_chart()
    if not global_chart:
        raise HTTPException(status_code=404, detail="No global chart data available")
    return {"chart": global_chart, "total": len(global_chart)}


# ============================================================
# ADMIN ENDPOINTS (Protected)
# ============================================================

@app.post("/admin/upload", tags=["Admin"], dependencies=[Depends(verify_admin_key)])
async def upload_chart(chart_data: UploadChartRequest):
    """
    Upload new chart data to the database.

    Requires X-API-Key header with admin key.
    """
    result = await db.save_chart(chart_data.model_dump())
    return {"success": True, "week": chart_data.week, "message": "Chart uploaded successfully"}


@app.post("/admin/sync", tags=["Admin"], dependencies=[Depends(verify_admin_key)])
async def sync_from_json():
    """
    Sync current.json file to database.

    Useful for initial data migration.
    """
    import json
    json_path = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'current.json')

    if not os.path.exists(json_path):
        raise HTTPException(status_code=404, detail="current.json not found")

    with open(json_path, 'r', encoding='utf-8') as f:
        chart_data = json.load(f)

    result = await db.save_chart(chart_data)
    return {
        "success": True,
        "week": chart_data.get("week"),
        "songs_count": len(chart_data.get("chart", [])),
        "regional_count": len(chart_data.get("regional", {}))
    }


@app.delete("/admin/chart/{week}", tags=["Admin"], dependencies=[Depends(verify_admin_key)])
async def delete_chart(week: str):
    """Delete a chart by week."""
    result = await db.delete_chart(week)
    if not result:
        raise HTTPException(status_code=404, detail=f"Chart for week {week} not found")
    return {"success": True, "message": f"Chart {week} deleted"}


# ============================================================
# AUTHENTICATION ENDPOINTS
# ============================================================

@app.post("/auth/google/login", response_model=TokenResponse, tags=["Auth"])
async def google_login(request: GoogleLoginRequest):
    """
    Exchange Google ID token for TLDR access/refresh tokens.

    On first login, merges any local data (favorites, history, queue) with cloud.
    """
    # Verify Google token
    google_data = await verify_google_token(request.google_token)

    # Check if user exists
    user = await db.get_user_by_google_id(google_data["google_id"])

    if user:
        # Existing user - update last login
        await db.update_user_login(user["_id"])
        user_id = user["_id"]
    else:
        # New user - create account with optional local data
        local_data = None
        if request.local_data:
            local_data = {
                "favorites": [f.model_dump() for f in request.local_data.favorites],
                "history": [h.model_dump() for h in request.local_data.history],
                "queue": [q.model_dump() for q in request.local_data.queue],
                "preferences": request.local_data.preferences.model_dump() if request.local_data.preferences else {"shuffle": False, "repeat": "off"}
            }
        user = await db.create_user(google_data, local_data)
        user_id = user["_id"]

    # Generate tokens
    access_token = create_access_token(user_id, google_data)
    refresh_token = create_refresh_token(user_id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="Bearer",
        expires_in=900,
        user=UserInfo(
            id=user_id,
            email=google_data["email"],
            name=google_data["name"],
            picture=google_data.get("picture")
        )
    )


@app.post("/auth/refresh", response_model=TokenResponse, tags=["Auth"])
async def refresh_token(request: RefreshTokenRequest):
    """Refresh access token using refresh token."""
    payload = verify_token(request.refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type - expected refresh token")

    user_id = payload["sub"]
    user = await db.get_user_by_id(user_id)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    access_token = create_access_token(user_id, {
        "email": user["email"],
        "name": user["name"],
        "picture": user.get("picture", "")
    })

    return TokenResponse(
        access_token=access_token,
        expires_in=900
    )


@app.post("/auth/logout", tags=["Auth"])
async def logout(current_user: Dict = Depends(get_current_user)):
    """
    Logout user (client should discard tokens).

    Note: For enhanced security, implement token blacklisting.
    """
    return {"success": True, "message": "Logged out successfully"}


# ============================================================
# USER DATA ENDPOINTS
# ============================================================

@app.get("/user/profile", response_model=UserProfile, tags=["User"])
async def get_profile(current_user: Dict = Depends(get_current_user)):
    """Get current user's profile and synced data."""
    user = await db.get_user_by_id(current_user["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserProfile(
        id=user["_id"],
        email=user["email"],
        name=user["name"],
        picture=user.get("picture"),
        favorites=user.get("favorites", []),
        history=user.get("history", []),
        queue=user.get("queue", []),
        preferences=user.get("preferences", {"shuffle": False, "repeat": "off"})
    )


@app.put("/user/favorites", response_model=SuccessResponse, tags=["User"])
async def update_favorites(
    request: FavoritesUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Sync favorites to cloud."""
    favorites = [f.model_dump() for f in request.favorites]
    await db.update_user_favorites(current_user["sub"], favorites)
    return SuccessResponse(success=True, count=len(favorites))


@app.put("/user/history", response_model=SuccessResponse, tags=["User"])
async def update_history(
    request: HistoryUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Sync play history to cloud (max 50 items)."""
    history = [h.model_dump() for h in request.history[:50]]
    await db.update_user_history(current_user["sub"], history)
    return SuccessResponse(success=True, count=len(history))


@app.put("/user/queue", response_model=SuccessResponse, tags=["User"])
async def update_queue(
    request: QueueUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Sync queue to cloud."""
    queue = [q.model_dump() for q in request.queue]
    await db.update_user_queue(current_user["sub"], queue)
    return SuccessResponse(success=True, count=len(queue))


@app.put("/user/preferences", response_model=SuccessResponse, tags=["User"])
async def update_preferences(
    preferences: UserPreferences,
    current_user: Dict = Depends(get_current_user)
):
    """Sync playback preferences."""
    await db.update_user_preferences(current_user["sub"], preferences.model_dump())
    return SuccessResponse(success=True)


@app.post("/user/sync", response_model=SyncResponse, tags=["User"])
async def sync_user_data(
    request: SyncRequest,
    current_user: Dict = Depends(get_current_user)
):
    """
    Full bidirectional sync - merges local and cloud data.

    Merge strategy:
    - Favorites: Deduplicate by title+artist, keep most recent
    - History: Combine and sort by playedAt, keep latest 50
    - Queue: Local queue takes priority (active session)
    - Preferences: Cloud takes priority if exists
    """
    user = await db.get_user_by_id(current_user["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get cloud data
    cloud_favorites = user.get("favorites", [])
    cloud_history = user.get("history", [])
    cloud_queue = user.get("queue", [])
    cloud_preferences = user.get("preferences", {"shuffle": False, "repeat": "off"})

    # Get local data
    local_favorites = [f.model_dump() for f in request.local_favorites]
    local_history = [h.model_dump() for h in request.local_history]
    local_queue = [q.model_dump() for q in request.local_queue]

    # Merge favorites (deduplicate by title+artist, keep most recent)
    merged_favorites = _merge_favorites(cloud_favorites, local_favorites)

    # Merge history (combine, sort by playedAt, keep latest 50)
    merged_history = _merge_history(cloud_history, local_history)

    # Queue: local takes priority (active session queue)
    merged_queue = local_queue if local_queue else cloud_queue

    # Preferences: cloud takes priority
    preferences = cloud_preferences

    # Save merged data
    await db.update_user_favorites(current_user["sub"], merged_favorites)
    await db.update_user_history(current_user["sub"], merged_history)
    await db.update_user_queue(current_user["sub"], merged_queue)

    return SyncResponse(
        merged_favorites=merged_favorites,
        merged_history=merged_history,
        merged_queue=merged_queue,
        preferences=preferences
    )


def _merge_favorites(cloud: List[Dict], local: List[Dict]) -> List[Dict]:
    """Merge favorites, deduplicating by title+artist, keeping most recent."""
    seen = {}
    for fav in cloud + local:
        key = f"{fav.get('title', '').lower()}-{fav.get('artist', '').lower()}"
        if key not in seen or fav.get('addedAt', 0) > seen[key].get('addedAt', 0):
            seen[key] = fav
    return sorted(seen.values(), key=lambda x: x.get('addedAt', 0), reverse=True)


def _merge_history(cloud: List[Dict], local: List[Dict]) -> List[Dict]:
    """Merge history, deduplicating and keeping most recent 50."""
    seen = {}
    for item in cloud + local:
        key = f"{item.get('title', '').lower()}-{item.get('artist', '').lower()}"
        if key not in seen or item.get('playedAt', 0) > seen[key].get('playedAt', 0):
            seen[key] = item
    sorted_history = sorted(seen.values(), key=lambda x: x.get('playedAt', 0), reverse=True)
    return sorted_history[:50]


# ============================================================
# PLAYLIST ENDPOINTS
# ============================================================

def _format_playlist(playlist: Dict, include_songs: bool = True) -> Dict:
    """Format playlist for response with id field."""
    result = {
        "id": playlist["_id"],
        "name": playlist.get("name", ""),
        "description": playlist.get("description", ""),
        "owner_id": playlist.get("owner_id"),
        "owner": playlist.get("owner"),
        "is_public": playlist.get("is_public", False),
        "published_at": playlist.get("published_at"),
        "cover_urls": playlist.get("cover_urls", []),
        "song_count": playlist.get("song_count", 0),
        "follower_count": playlist.get("follower_count", 0),
        "is_following": playlist.get("is_following", False),
        "is_owner": playlist.get("is_owner", False),
        "created_at": playlist.get("created_at", 0),
        "updated_at": playlist.get("updated_at", 0),
        "play_count": playlist.get("play_count", 0)
    }
    if include_songs:
        result["songs"] = playlist.get("songs", [])
    return result


def _format_playlist_summary(playlist: Dict) -> Dict:
    """Format playlist summary for list responses."""
    return _format_playlist(playlist, include_songs=False)


@app.post("/playlists", response_model=PlaylistResponse, tags=["Playlists"])
async def create_playlist(
    request: PlaylistCreate,
    current_user: Dict = Depends(get_current_user)
):
    """Create a new playlist (max 20 per user)."""
    user_id = current_user["sub"]

    # Check playlist limit
    count = await db.count_user_playlists(user_id)
    if count >= 20:
        raise HTTPException(status_code=400, detail="Maximum playlist limit reached (20)")

    playlist = await db.create_playlist(user_id, request.name, request.description)
    playlist["is_owner"] = True
    playlist["is_following"] = False
    return {"playlist": _format_playlist(playlist)}


@app.get("/playlists", response_model=PlaylistListResponse, tags=["Playlists"])
async def get_user_playlists(current_user: Dict = Depends(get_current_user)):
    """Get all playlists owned by the current user."""
    playlists = await db.get_user_playlists(current_user["sub"])
    return {
        "playlists": [_format_playlist_summary(p) for p in playlists],
        "total": len(playlists)
    }


@app.get("/playlists/following", response_model=PlaylistListResponse, tags=["Playlists"])
async def get_followed_playlists(current_user: Dict = Depends(get_current_user)):
    """Get playlists the user is following."""
    user_id = current_user["sub"]
    playlists = await db.get_followed_playlists(user_id)

    # Add owner info for each playlist
    for playlist in playlists:
        owner = await db.get_playlist_owner(playlist["owner_id"])
        playlist["owner"] = owner

    return {
        "playlists": [_format_playlist_summary(p) for p in playlists],
        "total": len(playlists)
    }


@app.get("/playlists/{playlist_id}", response_model=PlaylistResponse, tags=["Playlists"])
async def get_playlist(
    playlist_id: str,
    current_user: Optional[Dict] = Depends(get_optional_user)
):
    """Get a playlist by ID."""
    user_id = current_user["sub"] if current_user else None
    playlist = await db.get_playlist_by_id(playlist_id, user_id)

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # Check access - private playlists only visible to owner
    if not playlist.get("is_public") and not playlist.get("is_owner"):
        raise HTTPException(status_code=403, detail="Access denied")

    # Add owner info for public playlists
    if playlist.get("is_public") and not playlist.get("is_owner"):
        owner = await db.get_playlist_owner(playlist["owner_id"])
        playlist["owner"] = owner

    return {"playlist": _format_playlist(playlist)}


@app.put("/playlists/{playlist_id}", response_model=PlaylistSuccessResponse, tags=["Playlists"])
async def update_playlist(
    playlist_id: str,
    request: PlaylistUpdate,
    current_user: Dict = Depends(get_current_user)
):
    """Update playlist name/description (owner only)."""
    user_id = current_user["sub"]
    playlist = await db.get_playlist_by_id(playlist_id, user_id)

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if not playlist.get("is_owner"):
        raise HTTPException(status_code=403, detail="Access denied")

    updates = {}
    if request.name is not None:
        updates["name"] = request.name
    if request.description is not None:
        updates["description"] = request.description

    await db.update_playlist(playlist_id, updates)
    return {"success": True, "message": "Playlist updated"}


@app.delete("/playlists/{playlist_id}", response_model=PlaylistSuccessResponse, tags=["Playlists"])
async def delete_playlist(
    playlist_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Delete a playlist (owner only)."""
    user_id = current_user["sub"]
    playlist = await db.get_playlist_by_id(playlist_id, user_id)

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if not playlist.get("is_owner"):
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete_playlist(playlist_id)
    return {"success": True, "message": "Playlist deleted"}


@app.put("/playlists/{playlist_id}/publish", response_model=PlaylistSuccessResponse, tags=["Playlists"])
async def publish_playlist(
    playlist_id: str,
    request: PublishRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Publish or unpublish a playlist (owner only)."""
    user_id = current_user["sub"]
    playlist = await db.get_playlist_by_id(playlist_id, user_id)

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if not playlist.get("is_owner"):
        raise HTTPException(status_code=403, detail="Access denied")

    await db.publish_playlist(playlist_id, request.is_public)
    status = "published" if request.is_public else "unpublished"
    return {"success": True, "message": f"Playlist {status}"}


# ============================================================
# PLAYLIST SONG MANAGEMENT
# ============================================================

@app.post("/playlists/{playlist_id}/songs", response_model=PlaylistSuccessResponse, tags=["Playlists"])
async def add_song_to_playlist(
    playlist_id: str,
    request: AddSongRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Add a song to a playlist (owner only, max 100 songs)."""
    user_id = current_user["sub"]
    playlist = await db.get_playlist_by_id(playlist_id, user_id)

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if not playlist.get("is_owner"):
        raise HTTPException(status_code=403, detail="Access denied")

    song = await db.add_song_to_playlist(playlist_id, request.model_dump())
    if not song:
        raise HTTPException(status_code=400, detail="Maximum song limit reached (100)")

    return {"success": True, "message": "Song added"}


@app.delete("/playlists/{playlist_id}/songs", response_model=PlaylistSuccessResponse, tags=["Playlists"])
async def remove_songs_from_playlist(
    playlist_id: str,
    request: RemoveSongsRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Remove songs from a playlist by index (owner only)."""
    user_id = current_user["sub"]
    playlist = await db.get_playlist_by_id(playlist_id, user_id)

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if not playlist.get("is_owner"):
        raise HTTPException(status_code=403, detail="Access denied")

    await db.remove_songs_from_playlist(playlist_id, request.indexes)
    return {"success": True, "message": "Songs removed"}


@app.put("/playlists/{playlist_id}/songs/reorder", response_model=PlaylistSuccessResponse, tags=["Playlists"])
async def reorder_songs(
    playlist_id: str,
    request: ReorderSongsRequest,
    current_user: Dict = Depends(get_current_user)
):
    """Reorder songs in a playlist (owner only)."""
    user_id = current_user["sub"]
    playlist = await db.get_playlist_by_id(playlist_id, user_id)

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if not playlist.get("is_owner"):
        raise HTTPException(status_code=403, detail="Access denied")

    success = await db.reorder_songs_in_playlist(playlist_id, request.order)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid reorder request")

    return {"success": True, "message": "Songs reordered"}


# ============================================================
# PLAYLIST SOCIAL
# ============================================================

@app.post("/playlists/{playlist_id}/follow", response_model=PlaylistSuccessResponse, tags=["Playlists"])
async def follow_playlist(
    playlist_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Follow a public playlist."""
    user_id = current_user["sub"]
    playlist = await db.get_playlist_by_id(playlist_id, user_id)

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if not playlist.get("is_public"):
        raise HTTPException(status_code=403, detail="Cannot follow private playlist")
    if playlist.get("is_owner"):
        raise HTTPException(status_code=400, detail="Cannot follow your own playlist")

    await db.follow_playlist(playlist_id, user_id)
    return {"success": True, "message": "Playlist followed"}


@app.delete("/playlists/{playlist_id}/follow", response_model=PlaylistSuccessResponse, tags=["Playlists"])
async def unfollow_playlist(
    playlist_id: str,
    current_user: Dict = Depends(get_current_user)
):
    """Unfollow a playlist."""
    user_id = current_user["sub"]
    await db.unfollow_playlist(playlist_id, user_id)
    return {"success": True, "message": "Playlist unfollowed"}


# ============================================================
# PLAYLIST DISCOVERY
# ============================================================

@app.get("/discover/playlists", response_model=DiscoverPlaylistsResponse, tags=["Discovery"])
async def discover_playlists(current_user: Optional[Dict] = Depends(get_optional_user)):
    """Get trending, new, and popular playlists."""
    user_id = current_user["sub"] if current_user else None

    trending = await db.get_trending_playlists(10, user_id)
    new = await db.get_new_playlists(10, user_id)
    popular = await db.get_popular_playlists(10, user_id)

    # Add owner info for each playlist
    for playlist_list in [trending, new, popular]:
        for playlist in playlist_list:
            owner = await db.get_playlist_owner(playlist["owner_id"])
            playlist["owner"] = owner

    return {
        "trending": [_format_playlist_summary(p) for p in trending],
        "new": [_format_playlist_summary(p) for p in new],
        "popular": [_format_playlist_summary(p) for p in popular]
    }


@app.get("/discover/playlists/search", response_model=PlaylistListResponse, tags=["Discovery"])
async def search_playlists(
    q: str = Query(..., min_length=2),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    current_user: Optional[Dict] = Depends(get_optional_user)
):
    """Search public playlists by name or song."""
    user_id = current_user["sub"] if current_user else None
    playlists = await db.search_playlists(q, limit, offset, user_id)

    # Add owner info for each playlist
    for playlist in playlists:
        owner = await db.get_playlist_owner(playlist["owner_id"])
        playlist["owner"] = owner

    return {
        "playlists": [_format_playlist_summary(p) for p in playlists],
        "total": len(playlists)
    }


@app.get("/discover/playlists/browse", response_model=PlaylistListResponse, tags=["Discovery"])
async def browse_playlists(
    sort: str = Query("popular", regex="^(popular|new|trending)$"),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    current_user: Optional[Dict] = Depends(get_optional_user)
):
    """Browse public playlists with sorting options."""
    user_id = current_user["sub"] if current_user else None
    playlists = await db.browse_playlists(sort, limit, offset, user_id)

    # Add owner info for each playlist
    for playlist in playlists:
        owner = await db.get_playlist_owner(playlist["owner_id"])
        playlist["owner"] = owner

    return {
        "playlists": [_format_playlist_summary(p) for p in playlists],
        "total": len(playlists)
    }


# ============================================================
# OG IMAGE ENDPOINTS
# ============================================================

@app.post("/playlists/{playlist_id}/og-image/regenerate",
          response_model=PlaylistSuccessResponse,
          tags=["Playlists"])
async def regenerate_og_image(
    playlist_id: str,
    request: RegenerateOGImageRequest = RegenerateOGImageRequest(),
    current_user: Dict = Depends(get_current_user)
):
    """Manually trigger OG image regeneration (owner only)."""
    user_id = current_user["sub"]
    playlist = await db.get_playlist_by_id(playlist_id, user_id)

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if not playlist.get("is_owner"):
        raise HTTPException(status_code=403, detail="Access denied")
    if not playlist.get("is_public"):
        raise HTTPException(status_code=400, detail="OG images only available for public playlists")

    og_worker = await get_og_worker(db)
    await og_worker.enqueue(playlist_id, request.template or "default")

    return {"success": True, "message": "OG image regeneration queued"}


@app.get("/playlists/{playlist_id}/og-image/status",
         response_model=OGImageStatusResponse,
         tags=["Playlists"])
async def get_og_image_status(
    playlist_id: str,
    current_user: Optional[Dict] = Depends(get_optional_user)
):
    """Get current OG image generation status."""
    user_id = current_user["sub"] if current_user else None
    playlist = await db.get_playlist_by_id(playlist_id, user_id)

    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    return OGImageStatusResponse(
        status=playlist.get("og_image_status", "none"),
        og_image_url=playlist.get("og_image_url"),
        updated_at=playlist.get("og_image_updated_at"),
        template=playlist.get("og_image_template", "default"),
        error=playlist.get("og_image_error")
    )


# ============================================================
# SHARE ENDPOINTS (HTML with Open Graph meta tags)
# ============================================================

@app.get("/share/playlist/{playlist_id}", response_class=HTMLResponse, tags=["Share"])
async def share_playlist_page(playlist_id: str):
    """
    Returns an HTML page with Open Graph meta tags for rich link previews.
    Automatically redirects to the main app with the playlist.
    """
    # Fetch the playlist (public only)
    playlist = await db.get_playlist_by_id(playlist_id, None)

    if not playlist or not playlist.get("is_public"):
        # Return a generic page for invalid/private playlists
        return HTMLResponse(content=f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TLDR Music - India's Top 25</title>
    <meta name="description" content="Discover India's definitive music chart, aggregated from 7 major platforms.">
    <meta property="og:title" content="TLDR Music - India's Top 25">
    <meta property="og:description" content="Discover India's definitive music chart, aggregated from 7 major platforms.">
    <meta property="og:type" content="website">
    <meta property="og:image" content="https://tldrmusic.in/og-image.png">
    <meta name="twitter:card" content="summary_large_image">
    <script>window.location.href = '/';</script>
</head>
<body>
    <p>Redirecting to TLDR Music...</p>
</body>
</html>
        """, status_code=200)

    # Get playlist details
    name = playlist.get("name", "Playlist")
    description = playlist.get("description", "")
    song_count = playlist.get("song_count", 0)
    follower_count = playlist.get("follower_count", 0)
    cover_urls = playlist.get("cover_urls", [])

    # Get owner info
    owner = await db.get_playlist_owner(playlist["owner_id"])
    owner_name = owner.get("name", "Unknown") if owner else "Unknown"

    # Build description
    meta_description = f"A playlist by {owner_name} with {song_count} song{'s' if song_count != 1 else ''}"
    if description:
        meta_description = f"{description} • {meta_description}"

    # Use generated OG image if available and ready, otherwise fallback
    og_image_url = playlist.get("og_image_url")
    og_image_status = playlist.get("og_image_status")

    if og_image_url and og_image_status == "ready":
        og_image = og_image_url
    elif cover_urls:
        og_image = cover_urls[0]
    else:
        og_image = "https://tldrmusic.in/og-image.png"

    # Frontend URL (adjust based on deployment)
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
    redirect_url = f"{frontend_url}/?playlist={playlist_id}"

    html_content = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{name} - TLDR Music</title>
    <meta name="description" content="{meta_description}">

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="music.playlist">
    <meta property="og:url" content="{redirect_url}">
    <meta property="og:title" content="{name}">
    <meta property="og:description" content="{meta_description}">
    <meta property="og:image" content="{og_image}">
    <meta property="og:site_name" content="TLDR Music">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="{redirect_url}">
    <meta name="twitter:title" content="{name}">
    <meta name="twitter:description" content="{meta_description}">
    <meta name="twitter:image" content="{og_image}">

    <!-- Additional meta -->
    <meta name="author" content="{owner_name}">
    <meta name="robots" content="index, follow">

    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            text-align: center;
        }}
        .container {{
            padding: 2rem;
        }}
        h1 {{
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
        }}
        p {{
            color: rgba(255,255,255,0.7);
            margin: 0.5rem 0;
        }}
        .loading {{
            margin-top: 1rem;
            font-size: 0.9rem;
            color: rgba(255,255,255,0.5);
        }}
    </style>

    <script>
        // Redirect to main app
        setTimeout(function() {{
            window.location.href = '{redirect_url}';
        }}, 100);
    </script>
</head>
<body>
    <div class="container">
        <h1>{name}</h1>
        <p>by {owner_name} • {song_count} song{'s' if song_count != 1 else ''}</p>
        <p class="loading">Opening in TLDR Music...</p>
    </div>
</body>
</html>
    """

    return HTMLResponse(content=html_content, status_code=200)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
