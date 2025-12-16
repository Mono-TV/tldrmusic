"""
Pydantic models for user playlists
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ============================================================
# PLAYLIST ITEMS
# ============================================================

class PlaylistSong(BaseModel):
    """A song in a playlist"""
    title: str
    artist: str
    videoId: Optional[str] = None
    artwork: Optional[str] = None
    added_at: int  # Unix timestamp in ms
    order: int = 0

    class Config:
        extra = "allow"


# ============================================================
# PLAYLIST CORE
# ============================================================

class PlaylistBase(BaseModel):
    """Base playlist fields"""
    name: str = Field(..., max_length=50)
    description: str = Field(default="", max_length=200)


class PlaylistCreate(PlaylistBase):
    """Request to create a new playlist"""
    pass


class PlaylistUpdate(BaseModel):
    """Request to update playlist details"""
    name: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=200)


class PlaylistOwner(BaseModel):
    """Playlist owner info for public playlists"""
    id: str
    name: str
    picture: Optional[str] = None


class Playlist(BaseModel):
    """Full playlist model"""
    id: str
    name: str
    description: str = ""
    owner_id: str
    owner: Optional[PlaylistOwner] = None  # Populated for public playlists

    is_public: bool = False
    published_at: Optional[int] = None  # Unix timestamp in ms

    cover_urls: List[str] = []  # First 4 song artworks for 2x2 grid

    songs: List[PlaylistSong] = []
    song_count: int = 0

    follower_count: int = 0
    is_following: bool = False  # Set based on current user
    is_owner: bool = False  # Set based on current user

    created_at: int  # Unix timestamp in ms
    updated_at: int  # Unix timestamp in ms
    play_count: int = 0

    # OG Image fields
    og_image_url: Optional[str] = None
    og_image_status: str = "none"  # none, pending, generating, ready, failed
    og_image_updated_at: Optional[int] = None
    og_image_template: str = "default"
    og_image_version: int = 0


class PlaylistSummary(BaseModel):
    """Compact playlist for lists (without full song data)"""
    id: str
    name: str
    description: str = ""
    owner_id: str
    owner: Optional[PlaylistOwner] = None

    is_public: bool = False
    cover_urls: List[str] = []
    song_count: int = 0
    follower_count: int = 0
    is_following: bool = False
    is_owner: bool = False

    created_at: int
    updated_at: int

    # OG Image fields (for owner's preview)
    og_image_url: Optional[str] = None
    og_image_status: str = "none"


# ============================================================
# SONG MANAGEMENT
# ============================================================

class AddSongRequest(BaseModel):
    """Request to add a song to a playlist"""
    title: str
    artist: str
    videoId: Optional[str] = None
    artwork: Optional[str] = None


class RemoveSongsRequest(BaseModel):
    """Request to remove songs from a playlist"""
    indexes: List[int]  # 0-based indexes of songs to remove


class ReorderSongsRequest(BaseModel):
    """Request to reorder songs in a playlist"""
    order: List[int]  # New order as list of current indexes


# ============================================================
# PUBLISH
# ============================================================

class PublishRequest(BaseModel):
    """Request to publish/unpublish a playlist"""
    is_public: bool


# ============================================================
# SYNC
# ============================================================

class SyncPlaylistItem(BaseModel):
    """A playlist item for syncing from client"""
    id: str  # Can be client-generated (pl_xxx) or MongoDB ObjectId
    name: str
    description: str = ""
    songs: List[PlaylistSong] = []
    is_public: bool = False
    created_at: Optional[int] = None
    updated_at: Optional[int] = None

    class Config:
        extra = "allow"


class SyncPlaylistsRequest(BaseModel):
    """Request to sync playlists from client"""
    playlists: List[SyncPlaylistItem]


class SyncPlaylistsResponse(BaseModel):
    """Response from playlist sync with updated IDs"""
    success: bool = True
    playlists: List[PlaylistSummary]
    count: int


# ============================================================
# RESPONSES
# ============================================================

class PlaylistListResponse(BaseModel):
    """Response for list of playlists"""
    playlists: List[PlaylistSummary]
    total: int


class PlaylistResponse(BaseModel):
    """Response for single playlist"""
    playlist: Playlist


class SuccessResponse(BaseModel):
    """Generic success response"""
    success: bool = True
    message: Optional[str] = None


# ============================================================
# DISCOVERY
# ============================================================

class DiscoverPlaylistsResponse(BaseModel):
    """Response for discover playlists endpoint"""
    trending: List[PlaylistSummary] = []
    new: List[PlaylistSummary] = []
    popular: List[PlaylistSummary] = []


class BrowsePlaylistsRequest(BaseModel):
    """Query params for browsing playlists"""
    sort: str = "popular"  # 'popular' | 'new' | 'trending'
    limit: int = Field(default=20, ge=1, le=50)
    offset: int = Field(default=0, ge=0)


class SearchPlaylistsRequest(BaseModel):
    """Query params for searching playlists"""
    q: str = Field(..., min_length=2)
    limit: int = Field(default=20, ge=1, le=50)
    offset: int = Field(default=0, ge=0)
