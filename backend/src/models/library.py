"""
User Library Model - Favorites, Playlists, History, Queue
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum

from .song import SongSnapshot


class PlaySource(str, Enum):
    """Where a song was played from"""
    CHART = "chart"
    SEARCH = "search"
    PLAYLIST = "playlist"
    QUEUE = "queue"
    RADIO = "radio"
    FAVORITES = "favorites"
    ALBUM = "album"
    ARTIST = "artist"


class FavoriteEntry(BaseModel):
    """A favorited song"""
    song_id: str
    added_at: datetime = Field(default_factory=datetime.utcnow)

    # Denormalized for offline/quick access
    song_snapshot: SongSnapshot


class HistoryEntry(BaseModel):
    """A played song in history"""
    id: str  # Unique entry ID
    song_id: str
    played_at: datetime = Field(default_factory=datetime.utcnow)
    duration_played_ms: int = 0  # How much was actually played
    completed: bool = False  # Played >80%
    source: PlaySource

    # Denormalized
    song_snapshot: SongSnapshot


class QueueEntry(BaseModel):
    """A song in the queue"""
    id: str  # Unique entry ID for reordering
    song_id: str
    added_at: datetime = Field(default_factory=datetime.utcnow)
    source: str  # Description of where it was added from

    # Denormalized
    song_snapshot: SongSnapshot


class PlaylistVisibility(str, Enum):
    PUBLIC = "public"
    PRIVATE = "private"
    UNLISTED = "unlisted"  # Accessible via link


class Playlist(BaseModel):
    """
    User-created playlist
    """
    id: str = Field(..., description="Unique identifier")
    user_id: str
    name: str
    description: Optional[str] = None
    visibility: PlaylistVisibility = PlaylistVisibility.PRIVATE

    # Songs
    song_ids: List[str] = Field(default_factory=list)

    # Artwork (auto-generated mosaic or custom)
    artwork_url: Optional[str] = None
    custom_artwork: bool = False

    # Stats
    total_tracks: int = 0
    duration_ms: int = 0
    play_count: int = 0
    save_count: int = 0  # How many users saved this

    # Collaborative
    is_collaborative: bool = False
    collaborator_ids: List[str] = Field(default_factory=list)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class PlaylistCreate(BaseModel):
    """Schema for creating a playlist"""
    name: str
    description: Optional[str] = None
    visibility: PlaylistVisibility = PlaylistVisibility.PRIVATE
    song_ids: List[str] = Field(default_factory=list)


class PlaylistUpdate(BaseModel):
    """Schema for updating a playlist"""
    name: Optional[str] = None
    description: Optional[str] = None
    visibility: Optional[PlaylistVisibility] = None
    artwork_url: Optional[str] = None


class PlaylistSummary(BaseModel):
    """Lightweight playlist for listings"""
    id: str
    name: str
    owner_name: str
    artwork_url: Optional[str] = None
    total_tracks: int = 0
    visibility: PlaylistVisibility


class UserLibrary(BaseModel):
    """
    Complete user library state

    Can be stored in localStorage (anonymous) or synced to cloud (authenticated)
    """
    user_id: Optional[str] = None  # None for anonymous/localStorage

    # Collections
    favorites: List[FavoriteEntry] = Field(default_factory=list)
    playlists: List[Playlist] = Field(default_factory=list)
    history: List[HistoryEntry] = Field(default_factory=list, max_length=100)
    queue: List[QueueEntry] = Field(default_factory=list)

    # Following
    following_artist_ids: List[str] = Field(default_factory=list)
    following_user_ids: List[str] = Field(default_factory=list)
    saved_album_ids: List[str] = Field(default_factory=list)
    saved_playlist_ids: List[str] = Field(default_factory=list)  # Other users' playlists

    # Sync metadata
    last_synced_at: Optional[datetime] = None
    sync_version: int = 0

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class LibrarySyncRequest(BaseModel):
    """Request to sync library from client"""
    client_version: int
    favorites: List[FavoriteEntry] = Field(default_factory=list)
    history: List[HistoryEntry] = Field(default_factory=list)
    queue: List[QueueEntry] = Field(default_factory=list)


class LibrarySyncResponse(BaseModel):
    """Response with merged library state"""
    server_version: int
    library: UserLibrary
    conflicts: List[str] = Field(default_factory=list)  # Any merge conflicts


# ============== Playback State ==============

class PlaybackState(BaseModel):
    """
    Current playback state (for cross-device sync)
    """
    user_id: str
    current_song_id: Optional[str] = None
    position_ms: int = 0
    is_playing: bool = False
    shuffle: bool = False
    repeat: str = "off"  # "off", "all", "one"
    volume: float = 1.0

    # Queue snapshot
    queue_song_ids: List[str] = Field(default_factory=list)
    queue_position: int = 0

    # Device info
    device_id: Optional[str] = None
    device_name: Optional[str] = None

    updated_at: datetime = Field(default_factory=datetime.utcnow)
