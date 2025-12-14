"""
Chart Model - Rankings and chart data
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class ChartRegion(str, Enum):
    INDIA = "india"
    GLOBAL = "global"
    REGIONAL = "regional"


class MovementDirection(str, Enum):
    UP = "up"
    DOWN = "down"
    SAME = "same"
    NEW = "new"
    RE_ENTRY = "re_entry"


class PlatformRank(BaseModel):
    """Ranking on a specific platform"""
    platform: str  # "spotify", "apple_music", "youtube_music", etc.
    rank: int
    weight: float


class ChartMovement(BaseModel):
    """Track movement on the chart"""
    direction: MovementDirection
    positions: int = 0  # How many positions moved
    previous_rank: Optional[int] = None
    weeks_on_chart: int = 1
    peak_rank: int


class ChartEntry(BaseModel):
    """A single entry in the chart"""
    rank: int
    song_id: str

    # Scoring
    score: float
    platforms_count: int
    platform_ranks: List[PlatformRank] = Field(default_factory=list)

    # Movement tracking
    movement: ChartMovement

    # Engagement stats (denormalized)
    youtube_views: Optional[int] = None
    spotify_streams: Optional[int] = None

    # Denormalized song data for quick rendering
    song_title: str
    song_artist: str
    artwork_url: Optional[str] = None
    youtube_video_id: Optional[str] = None

    # ============================================================
    # V1 Fields (flat fields for backward compatibility)
    # ============================================================

    # Movement as flat fields (V1 format)
    rank_change: Optional[int] = None  # Positive = up, negative = down
    previous_rank: Optional[int] = None
    is_new: bool = False

    # Additional song metadata (V1)
    youtube_likes: Optional[int] = None
    youtube_duration: Optional[str] = None
    youtube_published: Optional[str] = None
    album: Optional[str] = None
    genre: Optional[str] = None
    duration_ms: Optional[int] = None
    release_date: Optional[str] = None

    # URLs (V1)
    preview_url: Optional[str] = None
    itunes_url: Optional[str] = None
    apple_music_url: Optional[str] = None

    # Lyrics (V1 - for quick access without separate fetch)
    lyrics_plain: Optional[str] = None
    lyrics_synced: Optional[str] = None


class Chart(BaseModel):
    """
    Chart entity

    Represents a weekly chart (India Top 25, Global Top 25, Regional charts)
    """
    id: str = Field(..., description="Unique identifier")
    name: str  # "India Top 25", "Global Top 25"
    description: Optional[str] = None

    # Classification
    region: ChartRegion
    language: Optional[str] = None  # For regional charts (tamil, telugu, etc.)

    # Time period
    week: str  # ISO week: "2025-W50"
    generated_at: datetime

    # Chart entries
    entries: List[ChartEntry] = Field(default_factory=list)

    # V1 compatibility
    total_songs: Optional[int] = None  # V1 field (computed from len(entries))

    # Navigation
    previous_chart_id: Optional[str] = None
    next_chart_id: Optional[str] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class RegionalChart(BaseModel):
    """
    Lightweight regional chart for display
    """
    language: str
    name: str
    icon: str
    songs: List[ChartEntry] = Field(default_factory=list)


class ChartSummary(BaseModel):
    """
    Summary of a chart for listing
    """
    id: str
    name: str
    region: ChartRegion
    week: str
    total_entries: int
    top_song_title: Optional[str] = None
    top_song_artist: Optional[str] = None
