"""
Library Service - User favorites, history, playlists
"""
from typing import List, Optional
from datetime import datetime
import uuid

from ..models import (
    UserLibrary,
    FavoriteEntry,
    HistoryEntry,
    QueueEntry,
    Playlist,
    PlaylistCreate,
    PlaylistUpdate,
    PlaylistSummary,
    PlaySource,
    LibrarySyncRequest,
    LibrarySyncResponse,
)
from ..config import Database
from .song import SongService


class LibraryService:
    """
    Handles user library operations
    """

    @classmethod
    async def get_user_library(cls, user_id: str) -> UserLibrary:
        """Get complete user library"""
        # In production, would query MongoDB
        # For now, return empty library
        return UserLibrary(user_id=user_id)

    @classmethod
    async def sync_library(
        cls,
        user_id: str,
        request: LibrarySyncRequest
    ) -> LibrarySyncResponse:
        """Sync library from client"""
        # Merge client data with server
        # For now, just accept client data
        library = UserLibrary(
            user_id=user_id,
            favorites=request.favorites,
            history=request.history,
            queue=request.queue,
            sync_version=request.client_version + 1,
            last_synced_at=datetime.utcnow(),
        )

        return LibrarySyncResponse(
            server_version=library.sync_version,
            library=library,
            conflicts=[],
        )

    # ============== Favorites ==============

    @classmethod
    async def get_favorites(
        cls,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[FavoriteEntry]:
        """Get user's favorites"""
        # In production, would query MongoDB
        return []

    @classmethod
    async def add_favorite(cls, user_id: str, song_id: str) -> bool:
        """Add song to favorites"""
        song = await SongService.get_song_by_id(song_id)
        if not song:
            return False

        # Create favorite entry
        artists_map = await SongService._load_artists_map()
        snapshot = SongService._to_snapshot(song, artists_map)

        favorite = FavoriteEntry(
            song_id=song_id,
            added_at=datetime.utcnow(),
            song_snapshot=snapshot,
        )

        # In production, would insert into MongoDB
        return True

    @classmethod
    async def remove_favorite(cls, user_id: str, song_id: str):
        """Remove song from favorites"""
        # In production, would delete from MongoDB
        pass

    @classmethod
    async def is_favorite(cls, user_id: str, song_id: str) -> bool:
        """Check if song is favorited"""
        # In production, would query MongoDB
        return False

    # ============== History ==============

    @classmethod
    async def get_history(cls, user_id: str, limit: int = 50) -> List[HistoryEntry]:
        """Get listening history"""
        # In production, would query MongoDB
        return []

    @classmethod
    async def add_to_history(
        cls,
        user_id: str,
        song_id: str,
        duration_played_ms: int = 0,
        completed: bool = False,
        source: str = "chart"
    ):
        """Add song to history"""
        song = await SongService.get_song_by_id(song_id)
        if not song:
            return

        artists_map = await SongService._load_artists_map()
        snapshot = SongService._to_snapshot(song, artists_map)

        entry = HistoryEntry(
            id=str(uuid.uuid4()),
            song_id=song_id,
            played_at=datetime.utcnow(),
            duration_played_ms=duration_played_ms,
            completed=completed,
            source=PlaySource(source) if source in PlaySource.__members__.values() else PlaySource.CHART,
            song_snapshot=snapshot,
        )

        # In production, would insert into MongoDB
        # Also update user stats

    @classmethod
    async def clear_history(cls, user_id: str):
        """Clear listening history"""
        # In production, would delete from MongoDB
        pass

    # ============== Playlists ==============

    @classmethod
    async def get_user_playlists(cls, user_id: str) -> List[PlaylistSummary]:
        """Get user's playlists"""
        # In production, would query MongoDB
        return []

    @classmethod
    async def create_playlist(
        cls,
        user_id: str,
        data: PlaylistCreate
    ) -> Playlist:
        """Create new playlist"""
        playlist = Playlist(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=data.name,
            description=data.description,
            visibility=data.visibility,
            song_ids=data.song_ids,
            total_tracks=len(data.song_ids),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        # In production, would insert into MongoDB
        return playlist

    @classmethod
    async def get_playlist(
        cls,
        playlist_id: str,
        user_id: str
    ) -> Optional[Playlist]:
        """Get playlist by ID"""
        # In production, would query MongoDB
        # Check ownership or public visibility
        return None

    @classmethod
    async def update_playlist(
        cls,
        playlist_id: str,
        user_id: str,
        data: PlaylistUpdate
    ) -> Optional[Playlist]:
        """Update playlist"""
        # In production, would update MongoDB
        return None

    @classmethod
    async def delete_playlist(cls, playlist_id: str, user_id: str) -> bool:
        """Delete playlist"""
        # In production, would delete from MongoDB
        return False

    @classmethod
    async def add_song_to_playlist(
        cls,
        playlist_id: str,
        song_id: str,
        user_id: str
    ) -> bool:
        """Add song to playlist"""
        # In production, would update MongoDB
        return False

    @classmethod
    async def remove_song_from_playlist(
        cls,
        playlist_id: str,
        song_id: str,
        user_id: str
    ):
        """Remove song from playlist"""
        # In production, would update MongoDB
        pass
