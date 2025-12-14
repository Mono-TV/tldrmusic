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
    SongSnapshot,
    LibrarySyncRequest,
    LibrarySyncResponse,
)
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


@router.post("/library/sync", response_model=LibrarySyncResponse)
async def sync_library(
    request: LibrarySyncRequest,
    user: User = Depends(get_current_user_required)
):
    """
    Sync library from client

    Merges client-side changes with server state.
    Used when coming back online after offline usage.
    """
    response = await LibraryService.sync_library(user.id, request)
    return response


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


@router.delete("/history")
async def clear_history(user: User = Depends(get_current_user_required)):
    """
    Clear listening history
    """
    await LibraryService.clear_history(user.id)
    return {"message": "History cleared"}


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
