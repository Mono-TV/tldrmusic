"""
Pydantic models for TLDR Music API
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class Song(BaseModel):
    """Individual song in the chart."""
    rank: int
    title: str
    artist: str
    score: Optional[float] = None
    platforms_count: Optional[int] = None

    # Rank movement tracking
    rank_change: Optional[int] = None  # Positive = moved up, negative = moved down
    previous_rank: Optional[int] = None
    is_new: Optional[bool] = None  # True if new entry to chart

    # YouTube data
    youtube_video_id: Optional[str] = None
    youtube_views: Optional[int] = None
    youtube_likes: Optional[int] = None
    youtube_duration: Optional[str] = None
    youtube_published: Optional[str] = None

    # Metadata
    artwork_url: Optional[str] = None
    album: Optional[str] = None
    release_date: Optional[str] = None
    genre: Optional[str] = None
    duration_ms: Optional[int] = None
    preview_url: Optional[str] = None
    itunes_url: Optional[str] = None
    apple_music_url: Optional[str] = None
    explicit: Optional[bool] = None

    # Lyrics
    lyrics_plain: Optional[str] = None
    lyrics_synced: Optional[str] = None

    class Config:
        extra = "allow"  # Allow additional fields


class RegionalSong(BaseModel):
    """Song in a regional chart."""
    rank: int
    title: str
    artist: str
    rank_change: Optional[int] = None
    previous_rank: Optional[int] = None
    is_new: Optional[bool] = None
    youtube_video_id: Optional[str] = None
    youtube_views: Optional[int] = None
    youtube_likes: Optional[int] = None
    youtube_duration: Optional[str] = None
    artwork_url: Optional[str] = None
    album: Optional[str] = None
    genre: Optional[str] = None
    preview_url: Optional[str] = None
    lyrics_plain: Optional[str] = None
    lyrics_synced: Optional[str] = None

    class Config:
        extra = "allow"


class RegionalChart(BaseModel):
    """A single regional chart."""
    name: str
    icon: str
    songs: List[RegionalSong]


class ChartResponse(BaseModel):
    """Response for chart endpoints."""
    generated_at: str
    week: str
    total_songs: int
    chart: List[Song]
    regional: Optional[Dict[str, RegionalChart]] = None
    global_chart: Optional[List[Song]] = None  # Global Top 25 with same format as India chart

    class Config:
        populate_by_name = True


class SongResponse(BaseModel):
    """Response for single song lookup."""
    song: Song
    week: str
    source: str = "main"  # "main" or "regional"
    region: Optional[str] = None


class SearchResult(BaseModel):
    """Single search result."""
    title: str
    artist: str
    rank: int
    week: str
    source: str  # "main" or regional name
    youtube_video_id: Optional[str] = None
    artwork_url: Optional[str] = None


class SearchResponse(BaseModel):
    """Response for search endpoint."""
    query: str
    results: List[SearchResult]
    total: int


class RegionalResponse(BaseModel):
    """Response for regional charts endpoint."""
    regions: Dict[str, RegionalChart]


class WeekListResponse(BaseModel):
    """Response for chart history endpoint."""
    weeks: List[str]
    total: int


class UploadChartRequest(BaseModel):
    """Request body for uploading chart data."""
    generated_at: str
    week: str
    total_songs: int
    chart: List[Dict[str, Any]]
    regional: Optional[Dict[str, Dict[str, Any]]] = None
    global_chart: Optional[List[Dict[str, Any]]] = None  # Global Top 25 with same format

    class Config:
        extra = "allow"
