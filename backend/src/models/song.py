"""
Song Model - Core entity for music tracks
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class AudioProvider(str, Enum):
    YOUTUBE = "youtube"
    SPOTIFY = "spotify"
    JIOSAAVN = "jiosaavn"
    GAANA = "gaana"
    APPLE_MUSIC = "apple_music"


class AudioQuality(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    LOSSLESS = "lossless"


class AudioSource(BaseModel):
    """Represents a playback source for a song"""
    provider: AudioProvider
    id: str  # Provider-specific ID
    url: Optional[str] = None
    quality: AudioQuality = AudioQuality.MEDIUM
    is_primary: bool = False


class Artwork(BaseModel):
    """Multi-resolution artwork URLs"""
    small: Optional[str] = None      # 100x100
    medium: Optional[str] = None     # 300x300
    large: Optional[str] = None      # 600x600
    original: Optional[str] = None


class SyncedLyric(BaseModel):
    """A single line of synced lyrics"""
    time_ms: int
    text: str
    translation: Optional[str] = None


class Lyrics(BaseModel):
    """Song lyrics container"""
    plain: Optional[str] = None
    synced: Optional[List[SyncedLyric]] = None
    language: Optional[str] = None
    source: Optional[str] = None  # "musixmatch", "genius", etc.


class Song(BaseModel):
    """
    Core Song entity

    Represents a single music track with all associated metadata,
    audio sources, artwork, and lyrics.
    """
    id: str = Field(..., description="Unique identifier (UUID)")
    title: str
    title_normalized: str = Field(..., description="Lowercase, stripped for search")

    # Duration
    duration_ms: Optional[int] = None

    # Content info
    explicit: bool = False
    release_date: Optional[str] = None  # ISO date string

    # Relationships (stored as IDs, resolved via joins/lookups)
    artist_ids: List[str] = Field(default_factory=list)
    featured_artist_ids: List[str] = Field(default_factory=list)
    album_id: Optional[str] = None

    # Classification
    language: Optional[str] = None  # ISO 639-1: "hi", "en", "pa", "ta", "te"
    genres: List[str] = Field(default_factory=list)
    moods: List[str] = Field(default_factory=list)

    # Audio sources (abstraction layer for multi-provider support)
    sources: List[AudioSource] = Field(default_factory=list)

    # Artwork
    artwork: Artwork = Field(default_factory=Artwork)

    # Lyrics
    lyrics: Optional[Lyrics] = None

    # External identifiers
    isrc: Optional[str] = None  # International Standard Recording Code

    # Stats (denormalized for quick access)
    play_count: int = 0
    favorite_count: int = 0

    # ============================================================
    # V1 Fields (denormalized for backward compatibility)
    # ============================================================

    # YouTube metadata (V1)
    youtube_video_id: Optional[str] = None
    youtube_views: Optional[int] = None
    youtube_likes: Optional[int] = None
    youtube_duration: Optional[str] = None  # "3:45" format
    youtube_published: Optional[str] = None

    # External URLs (V1)
    preview_url: Optional[str] = None
    itunes_url: Optional[str] = None
    apple_music_url: Optional[str] = None

    # Denormalized fields for V1 compatibility
    artist: Optional[str] = None  # Combined artist string
    album: Optional[str] = None  # Album name
    genre: Optional[str] = None  # Primary genre
    artwork_url: Optional[str] = None  # Single artwork URL

    # Denormalized lyrics (V1 format)
    lyrics_plain: Optional[str] = None  # Plain text
    lyrics_synced: Optional[str] = None  # LRC format string

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

    def get_primary_source(self) -> Optional[AudioSource]:
        """Get the primary audio source for playback"""
        for source in self.sources:
            if source.is_primary:
                return source
        return self.sources[0] if self.sources else None

    def get_source_by_provider(self, provider: AudioProvider) -> Optional[AudioSource]:
        """Get audio source for a specific provider"""
        for source in self.sources:
            if source.provider == provider:
                return source
        return None


class SongCreate(BaseModel):
    """Schema for creating a new song"""
    title: str
    artist_ids: List[str]
    featured_artist_ids: List[str] = Field(default_factory=list)
    album_id: Optional[str] = None
    duration_ms: Optional[int] = None
    explicit: bool = False
    release_date: Optional[str] = None
    language: Optional[str] = None
    genres: List[str] = Field(default_factory=list)
    moods: List[str] = Field(default_factory=list)
    sources: List[AudioSource] = Field(default_factory=list)
    artwork: Optional[Artwork] = None
    lyrics: Optional[Lyrics] = None
    isrc: Optional[str] = None


class SongUpdate(BaseModel):
    """Schema for updating a song"""
    title: Optional[str] = None
    artist_ids: Optional[List[str]] = None
    featured_artist_ids: Optional[List[str]] = None
    album_id: Optional[str] = None
    duration_ms: Optional[int] = None
    explicit: Optional[bool] = None
    release_date: Optional[str] = None
    language: Optional[str] = None
    genres: Optional[List[str]] = None
    moods: Optional[List[str]] = None
    sources: Optional[List[AudioSource]] = None
    artwork: Optional[Artwork] = None
    lyrics: Optional[Lyrics] = None
    isrc: Optional[str] = None


class SongSnapshot(BaseModel):
    """
    Lightweight song representation for embedding in user data
    (favorites, queue, history) to avoid joins for common operations
    """
    id: str
    title: str
    artist: str  # Primary artist name (denormalized)
    artwork_url: Optional[str] = None
    youtube_video_id: Optional[str] = None
    duration_ms: Optional[int] = None

    # V1 fields for backward compatibility
    album: Optional[str] = None
    genre: Optional[str] = None
    youtube_views: Optional[int] = None
    youtube_likes: Optional[int] = None
    preview_url: Optional[str] = None
