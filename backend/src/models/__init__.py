"""
TLDR Music - Data Models

This module contains all Pydantic models for the music service.
"""

from .song import (
    Song,
    SongCreate,
    SongUpdate,
    SongSnapshot,
    AudioSource,
    AudioProvider,
    AudioQuality,
    Artwork,
    Lyrics,
    SyncedLyric,
)

from .artist import (
    Artist,
    ArtistCreate,
    ArtistUpdate,
    ArtistSummary,
    ArtistType,
    ArtistImages,
    SocialLinks,
)

from .album import (
    Album,
    AlbumCreate,
    AlbumUpdate,
    AlbumSummary,
    AlbumType,
    AlbumArtwork,
)

from .chart import (
    Chart,
    ChartEntry,
    ChartSummary,
    ChartRegion,
    ChartMovement,
    MovementDirection,
    PlatformRank,
    RegionalChart,
)

from .user import (
    User,
    UserCreate,
    UserUpdate,
    UserPublicProfile,
    UserPreferences,
    AuthProvider,
    LinkedAccount,
    RepeatMode,
    AudioQualityPreference,
    PhoneAuthRequest,
    PhoneVerifyRequest,
    GoogleAuthRequest,
    AuthResponse,
    TokenRefreshRequest,
)

from .library import (
    UserLibrary,
    FavoriteEntry,
    HistoryEntry,
    QueueEntry,
    Playlist,
    PlaylistCreate,
    PlaylistUpdate,
    PlaylistSummary,
    PlaylistVisibility,
    PlaySource,
    PlaybackState,
    LibrarySyncRequest,
    LibrarySyncResponse,
)


__all__ = [
    # Song
    "Song",
    "SongCreate",
    "SongUpdate",
    "SongSnapshot",
    "AudioSource",
    "AudioProvider",
    "AudioQuality",
    "Artwork",
    "Lyrics",
    "SyncedLyric",
    # Artist
    "Artist",
    "ArtistCreate",
    "ArtistUpdate",
    "ArtistSummary",
    "ArtistType",
    "ArtistImages",
    "SocialLinks",
    # Album
    "Album",
    "AlbumCreate",
    "AlbumUpdate",
    "AlbumSummary",
    "AlbumType",
    "AlbumArtwork",
    # Chart
    "Chart",
    "ChartEntry",
    "ChartSummary",
    "ChartRegion",
    "ChartMovement",
    "MovementDirection",
    "PlatformRank",
    "RegionalChart",
    # User
    "User",
    "UserCreate",
    "UserUpdate",
    "UserPublicProfile",
    "UserPreferences",
    "AuthProvider",
    "LinkedAccount",
    "RepeatMode",
    "AudioQualityPreference",
    "PhoneAuthRequest",
    "PhoneVerifyRequest",
    "GoogleAuthRequest",
    "AuthResponse",
    "TokenRefreshRequest",
    # Library
    "UserLibrary",
    "FavoriteEntry",
    "HistoryEntry",
    "QueueEntry",
    "Playlist",
    "PlaylistCreate",
    "PlaylistUpdate",
    "PlaylistSummary",
    "PlaylistVisibility",
    "PlaySource",
    "PlaybackState",
    "LibrarySyncRequest",
    "LibrarySyncResponse",
]
