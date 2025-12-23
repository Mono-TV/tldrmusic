"""
User Library API Routes - Favorites, History, Queue, Playlists
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ...models import (
    User,
    UserLibrary,
    FavoriteEntry,
    HistoryEntry,
    QueueEntry,
    Playlist,
    PlaylistCreate,
    PlaylistUpdate,
    PlaylistSummary,
    PlaylistVisibility,
    SongSnapshot,
    LibrarySyncRequest,
    LibrarySyncResponse,
)
from ...config import Database
from ...services.library import LibraryService
from ..deps import get_current_user_required

router = APIRouter(prefix="/me", tags=["Library"])


# ============== Library Sync ==============

@router.get("/library", response_model=UserLibrary)
async def get_library(user: User = Depends(get_current_user_required)):
    """
    Get user's complete library

    Returns favorites, playlists, history, and queue.
    """
    library = await LibraryService.get_user_library(user.id)
    return library


@router.post("/library/sync")
async def sync_library(
    request: dict,
    user: User = Depends(get_current_user_required)
):
    """
    Sync library from client

    Merges client-side changes with server state.
    Used when coming back online after offline usage.

    Returns data in format expected by frontend:
    - merged_favorites, merged_history, merged_queue, merged_playlists
    - preferences
    """
    # Get server-side data
    library = await LibraryService.get_user_library(user.id)

    # Convert to format frontend expects
    # For now, just return server data (server wins in conflict)
    # Future: implement proper merge logic

    # Convert playlists to frontend format with songs array
    merged_playlists = []
    for playlist in library.playlists:
        # Get full playlist doc from DB for additional fields
        # Try multiple ID formats (id, client_id, _id)
        doc = await Database.playlists().find_one({"id": playlist.id})
        if not doc:
            doc = await Database.playlists().find_one({"client_id": playlist.id})
        if not doc:
            try:
                from bson import ObjectId
                if ObjectId.is_valid(playlist.id):
                    doc = await Database.playlists().find_one({"_id": ObjectId(playlist.id)})
            except:
                pass

        # Get artwork URL - custom_artwork is a boolean flag, artwork_url is the actual URL
        artwork_url = None
        if doc:
            # Check for custom artwork URL in the document
            if doc.get("artwork_url") and isinstance(doc.get("artwork_url"), str):
                artwork_url = doc.get("artwork_url")
            elif playlist.artwork_url:
                artwork_url = playlist.artwork_url
        else:
            artwork_url = playlist.artwork_url

        playlist_dict = {
            "id": playlist.id,
            "name": playlist.name,
            "description": playlist.description,
            "is_public": playlist.visibility == PlaylistVisibility.PUBLIC,
            "songs": [],  # Will be populated from song_snapshots
            "song_count": playlist.total_tracks,
            "cover_urls": [artwork_url] if artwork_url else [],
            "artwork_url": artwork_url,
            "custom_artwork": bool(doc.get("custom_artwork")) if doc else False,
            "created_at": playlist.created_at.timestamp() * 1000 if playlist.created_at else None,
            "updated_at": playlist.updated_at.timestamp() * 1000 if playlist.updated_at else None,
        }

        # Add song snapshots from DB doc
        if doc and doc.get("song_snapshots"):
            songs = []
            for snap in doc.get("song_snapshots", []):
                songs.append({
                    "videoId": snap.get("video_id", ""),
                    "title": snap.get("title", ""),
                    "artist": snap.get("artist", ""),
                    "artwork": snap.get("artwork_url", ""),
                })
            playlist_dict["songs"] = songs
            playlist_dict["song_count"] = len(songs)
        # Fallback: if no song_snapshots but we have song_ids, include them
        elif doc and doc.get("song_ids"):
            playlist_dict["song_ids"] = doc.get("song_ids", [])
            playlist_dict["song_count"] = len(doc.get("song_ids", []))

        merged_playlists.append(playlist_dict)

    # Convert favorites to frontend format
    merged_favorites = []
    for fav in library.favorites:
        if fav.song_snapshot:
            merged_favorites.append({
                "videoId": fav.song_snapshot.youtube_video_id or fav.song_snapshot.id,
                "title": fav.song_snapshot.title,
                "artist": fav.song_snapshot.artist,
                "artwork": fav.song_snapshot.artwork_url,
                "addedAt": fav.added_at.timestamp() * 1000 if fav.added_at else None,
            })

    # Convert history to frontend format
    merged_history = []
    for entry in library.history:
        if entry.song_snapshot:
            merged_history.append({
                "videoId": entry.song_snapshot.youtube_video_id or entry.song_snapshot.id,
                "title": entry.song_snapshot.title,
                "artist": entry.song_snapshot.artist,
                "artwork": entry.song_snapshot.artwork_url,
                "playedAt": entry.played_at.timestamp() * 1000 if entry.played_at else None,
            })

    # Convert queue to frontend format
    merged_queue = []
    for entry in library.queue:
        if entry.song_snapshot:
            merged_queue.append({
                "videoId": entry.song_snapshot.youtube_video_id or entry.song_snapshot.id,
                "title": entry.song_snapshot.title,
                "artist": entry.song_snapshot.artist,
                "artwork": entry.song_snapshot.artwork_url,
            })

    # Get preferences and recent searches from DB
    preferences = await LibraryService.get_preferences(user.id)
    recent_searches = await LibraryService.get_recent_searches(user.id)

    return {
        "merged_favorites": merged_favorites,
        "merged_history": merged_history,
        "merged_queue": merged_queue,
        "merged_playlists": merged_playlists,
        "preferences": preferences,
        "recent_searches": recent_searches,
    }


# ============== Favorites ==============

@router.get("/favorites", response_model=List[FavoriteEntry])
async def get_favorites(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user_required)
):
    """
    Get user's favorites

    Returns favorited songs, newest first.
    """
    favorites = await LibraryService.get_favorites(
        user.id,
        limit=limit,
        offset=offset
    )
    return favorites


@router.post("/favorites/{song_id}", status_code=status.HTTP_201_CREATED)
async def add_favorite(
    song_id: str,
    user: User = Depends(get_current_user_required)
):
    """
    Add song to favorites
    """
    success = await LibraryService.add_favorite(user.id, song_id)
    if not success:
        raise HTTPException(status_code=404, detail="Song not found")
    return {"message": "Added to favorites"}


@router.delete("/favorites/{song_id}")
async def remove_favorite(
    song_id: str,
    user: User = Depends(get_current_user_required)
):
    """
    Remove song from favorites
    """
    await LibraryService.remove_favorite(user.id, song_id)
    return {"message": "Removed from favorites"}


@router.get("/favorites/check/{song_id}", response_model=dict)
async def check_favorite(
    song_id: str,
    user: User = Depends(get_current_user_required)
):
    """
    Check if song is favorited
    """
    is_favorite = await LibraryService.is_favorite(user.id, song_id)
    return {"is_favorite": is_favorite}


@router.put("/favorites")
async def sync_favorites(
    data: dict,
    user: User = Depends(get_current_user_required)
):
    """
    Sync/replace favorites from client.
    Accepts { favorites: [...] } and syncs to server.
    """
    favorites_data = data.get("favorites", [])
    await LibraryService.sync_favorites(user.id, favorites_data)
    return {"message": "Favorites synced", "count": len(favorites_data)}


# ============== History ==============

@router.get("/history", response_model=List[HistoryEntry])
async def get_history(
    limit: int = Query(default=50, le=100),
    user: User = Depends(get_current_user_required)
):
    """
    Get listening history

    Returns recently played songs, newest first.
    """
    history = await LibraryService.get_history(user.id, limit=limit)
    return history


@router.post("/history")
async def add_to_history(
    song_id: str,
    duration_played_ms: int = 0,
    completed: bool = False,
    source: str = "chart",
    user: User = Depends(get_current_user_required)
):
    """
    Add song to history

    Called when a song is played. Updates play counts and stats.
    """
    await LibraryService.add_to_history(
        user.id,
        song_id,
        duration_played_ms=duration_played_ms,
        completed=completed,
        source=source
    )
    return {"message": "Added to history"}


@router.put("/history")
async def sync_history(
    data: dict,
    user: User = Depends(get_current_user_required)
):
    """
    Sync/replace listening history from client

    Accepts { history: [...] } and replaces server history.
    """
    history_items = data.get("history", [])
    await LibraryService.sync_history(user.id, history_items)
    return {"message": "History synced", "count": len(history_items)}


@router.delete("/history")
async def clear_history(user: User = Depends(get_current_user_required)):
    """
    Clear listening history
    """
    await LibraryService.clear_history(user.id)
    return {"message": "History cleared"}


# ============== Queue ==============

@router.get("/queue", response_model=List[QueueEntry])
async def get_queue(user: User = Depends(get_current_user_required)):
    """
    Get user's current queue

    Returns the saved queue for cross-device resume.
    """
    queue = await LibraryService.get_queue(user.id)
    return queue


@router.put("/queue")
async def save_queue(
    data: dict,
    user: User = Depends(get_current_user_required)
):
    """
    Save/sync queue to cloud

    Accepts { queue: [...], currentIndex: N } and saves for cross-device resume.
    """
    queue_items = data.get("queue", [])
    current_index = data.get("currentIndex", 0)

    # Add current index to first item for storage
    if queue_items:
        queue_items[0]["current_index"] = current_index

    await LibraryService.save_queue(user.id, queue_items)
    return {"message": "Queue saved", "count": len(queue_items)}


@router.delete("/queue")
async def clear_queue(user: User = Depends(get_current_user_required)):
    """
    Clear queue
    """
    await LibraryService.clear_queue(user.id)
    return {"message": "Queue cleared"}


# ============== Playlists ==============

@router.get("/playlists", response_model=List[PlaylistSummary])
async def get_playlists(user: User = Depends(get_current_user_required)):
    """
    Get user's playlists
    """
    playlists = await LibraryService.get_user_playlists(user.id)
    return playlists


@router.post("/playlists", response_model=Playlist, status_code=status.HTTP_201_CREATED)
async def create_playlist(
    data: PlaylistCreate,
    user: User = Depends(get_current_user_required)
):
    """
    Create new playlist
    """
    playlist = await LibraryService.create_playlist(user.id, data)
    return playlist


@router.put("/playlists")
async def sync_playlists(
    data: dict,
    user: User = Depends(get_current_user_required)
):
    """
    Sync/replace playlists from client.

    Accepts { playlists: [...] } and syncs to server.
    Returns the synced playlists with server-assigned IDs.
    """
    playlists_data = data.get("playlists", [])
    synced = await LibraryService.sync_playlists(user.id, playlists_data)
    return {"playlists": synced, "count": len(synced)}


@router.get("/playlists/{playlist_id}", response_model=Playlist)
async def get_playlist(
    playlist_id: str,
    user: User = Depends(get_current_user_required)
):
    """
    Get playlist details
    """
    playlist = await LibraryService.get_playlist(playlist_id, user.id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist


@router.patch("/playlists/{playlist_id}", response_model=Playlist)
async def update_playlist(
    playlist_id: str,
    data: PlaylistUpdate,
    user: User = Depends(get_current_user_required)
):
    """
    Update playlist
    """
    playlist = await LibraryService.update_playlist(playlist_id, user.id, data)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return playlist


@router.delete("/playlists/{playlist_id}")
async def delete_playlist(
    playlist_id: str,
    user: User = Depends(get_current_user_required)
):
    """
    Delete playlist
    """
    success = await LibraryService.delete_playlist(playlist_id, user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {"message": "Playlist deleted"}


@router.post("/playlists/{playlist_id}/songs/{song_id}")
async def add_song_to_playlist(
    playlist_id: str,
    song_id: str,
    user: User = Depends(get_current_user_required)
):
    """
    Add song to playlist
    """
    success = await LibraryService.add_song_to_playlist(playlist_id, song_id, user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Playlist or song not found")
    return {"message": "Song added to playlist"}


@router.delete("/playlists/{playlist_id}/songs/{song_id}")
async def remove_song_from_playlist(
    playlist_id: str,
    song_id: str,
    user: User = Depends(get_current_user_required)
):
    """
    Remove song from playlist
    """
    await LibraryService.remove_song_from_playlist(playlist_id, song_id, user.id)
    return {"message": "Song removed from playlist"}


# ============== AI Playlist Generation ==============

@router.post("/playlists/generate")
async def generate_playlist(
    data: dict,
    user: User = Depends(get_current_user_required)
):
    """
    Generate a playlist using AI based on user's prompt.

    Request body:
    - prompt: string (required) - User's description of desired playlist
    - song_count: int (optional, default 25) - Number of songs to include
    - language: string (optional) - Preferred language code (hi, en, ta, etc.)

    Returns generated playlist that user can preview and save.
    """
    from ...services.playlist_generator import PlaylistGeneratorService

    prompt = data.get("prompt", "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    song_count = data.get("song_count", 25)
    if song_count < 5:
        song_count = 5
    elif song_count > 50:
        song_count = 50

    language = data.get("language")

    try:
        result = await PlaylistGeneratorService.generate_playlist(
            prompt=prompt,
            user_id=user.id,
            song_count=song_count,
            language=language
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"AI playlist generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate playlist. Please try again.")


# ============== Preferences ==============

@router.get("/preferences")
async def get_preferences(user: User = Depends(get_current_user_required)):
    """
    Get user preferences (shuffle, repeat mode)
    """
    prefs = await LibraryService.get_preferences(user.id)
    return prefs


@router.put("/preferences")
async def save_preferences(
    data: dict,
    user: User = Depends(get_current_user_required)
):
    """
    Save user preferences
    """
    await LibraryService.save_preferences(
        user.id,
        shuffle=data.get("shuffle", False),
        repeat=data.get("repeat", "off")
    )
    return {"message": "Preferences saved"}


# ============== Recent Searches ==============

@router.get("/recent-searches")
async def get_recent_searches(user: User = Depends(get_current_user_required)):
    """
    Get user's recent searches
    """
    searches = await LibraryService.get_recent_searches(user.id)
    return {"searches": searches}


@router.put("/recent-searches")
async def save_recent_searches(
    data: dict,
    user: User = Depends(get_current_user_required)
):
    """
    Save user's recent searches
    """
    searches = data.get("searches", [])
    await LibraryService.save_recent_searches(user.id, searches)
    return {"message": "Recent searches saved", "count": len(searches)}


# ============== Session Management ==============

@router.post("/session/ping")
async def session_ping(
    user: User = Depends(get_current_user_required),
    data: Optional[dict] = None
):
    """
    Ping session to track active sessions.
    Returns whether user has multiple active sessions.
    Used to enable real-time sync only when needed.
    """
    session_id = None
    if data and isinstance(data, dict):
        session_id = data.get("session_id")
    result = await LibraryService.ping_session(user.id, session_id)
    return result
