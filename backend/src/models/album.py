"""
Album Model - Represents albums, singles, EPs, soundtracks
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class AlbumType(str, Enum):
    ALBUM = "album"
    SINGLE = "single"
    EP = "ep"
    COMPILATION = "compilation"
    SOUNDTRACK = "soundtrack"


class AlbumArtwork(BaseModel):
    """Album artwork at multiple resolutions"""
    small: Optional[str] = None      # 100x100
    medium: Optional[str] = None     # 300x300
    large: Optional[str] = None      # 600x600


class Album(BaseModel):
    """
    Album entity

    Represents a collection of songs (album, single, EP, etc.)
    """
    id: str = Field(..., description="Unique identifier (UUID)")
    title: str
    title_normalized: str = Field(..., description="Lowercase for search")

    # Type
    type: AlbumType = AlbumType.ALBUM

    # Relationships
    artist_ids: List[str] = Field(default_factory=list)  # Primary artists
    song_ids: List[str] = Field(default_factory=list)    # Ordered track list

    # Release info
    release_date: Optional[str] = None  # ISO date
    label: Optional[str] = None

    # Artwork
    artwork: AlbumArtwork = Field(default_factory=AlbumArtwork)

    # Classification
    genres: List[str] = Field(default_factory=list)
    language: Optional[str] = None

    # Computed/cached
    total_tracks: int = 0
    duration_ms: int = 0

    # External IDs
    upc: Optional[str] = None  # Universal Product Code

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class AlbumCreate(BaseModel):
    """Schema for creating a new album"""
    title: str
    type: AlbumType = AlbumType.ALBUM
    artist_ids: List[str]
    song_ids: List[str] = Field(default_factory=list)
    release_date: Optional[str] = None
    label: Optional[str] = None
    artwork: Optional[AlbumArtwork] = None
    genres: List[str] = Field(default_factory=list)
    language: Optional[str] = None
    upc: Optional[str] = None


class AlbumUpdate(BaseModel):
    """Schema for updating an album"""
    title: Optional[str] = None
    type: Optional[AlbumType] = None
    artist_ids: Optional[List[str]] = None
    song_ids: Optional[List[str]] = None
    release_date: Optional[str] = None
    label: Optional[str] = None
    artwork: Optional[AlbumArtwork] = None
    genres: Optional[List[str]] = None
    language: Optional[str] = None
    upc: Optional[str] = None


class AlbumSummary(BaseModel):
    """
    Lightweight album representation
    """
    id: str
    title: str
    artist_name: str  # Primary artist (denormalized)
    artwork_url: Optional[str] = None
    type: AlbumType
    release_date: Optional[str] = None
