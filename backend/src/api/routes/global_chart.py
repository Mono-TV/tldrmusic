"""
Global Charts API Routes

Provides V1-compatible endpoint for global chart (Top 25).
"""
from typing import List
from fastapi import APIRouter, HTTPException

from ...models import Chart, ChartRegion, ChartEntry
from ...services.chart import ChartService

router = APIRouter(tags=["Global"])


@router.get("/global")
async def get_global_chart():
    """
    Get the consolidated global Top 25 chart.

    This endpoint aggregates data from multiple global platforms
    (Spotify Global, Billboard Hot 100, Apple Music) to create
    a unified global chart.

    V1 compatible endpoint.
    """
    chart = await ChartService.get_current_chart(region=ChartRegion.GLOBAL)

    if not chart:
        raise HTTPException(
            status_code=404,
            detail="No global chart data available"
        )

    # Convert to V1 format
    songs = [_entry_to_v1_format(entry) for entry in chart.entries]

    return {
        "chart": songs,
        "total": len(songs),
        "week": chart.week,
        "generated_at": chart.generated_at.isoformat() if chart.generated_at else None
    }


def _entry_to_v1_format(entry: ChartEntry) -> dict:
    """Convert ChartEntry to V1 flat song format"""
    result = {
        "rank": entry.rank,
        "title": entry.song_title,
        "artist": entry.song_artist,
        "score": entry.score,
        "platforms_count": entry.platforms_count,
        "artwork_url": entry.artwork_url,
        "youtube_video_id": entry.youtube_video_id,
    }

    # Add movement as flat fields (V1 format)
    if entry.movement:
        result["is_new"] = entry.movement.direction.value == "new"
        if entry.movement.direction.value == "up":
            result["rank_change"] = entry.movement.positions
        elif entry.movement.direction.value == "down":
            result["rank_change"] = -entry.movement.positions
        else:
            result["rank_change"] = 0 if entry.movement.direction.value == "same" else None
        result["previous_rank"] = entry.movement.previous_rank
    else:
        # Use V1 flat fields if available
        result["is_new"] = entry.is_new
        result["rank_change"] = entry.rank_change
        result["previous_rank"] = entry.previous_rank

    # Add optional engagement stats
    if entry.youtube_views:
        result["youtube_views"] = entry.youtube_views
    if entry.youtube_likes:
        result["youtube_likes"] = entry.youtube_likes
    if entry.spotify_streams:
        result["spotify_streams"] = entry.spotify_streams

    # Add optional song metadata (V1 fields)
    if entry.album:
        result["album"] = entry.album
    if entry.genre:
        result["genre"] = entry.genre
    if entry.duration_ms:
        result["duration_ms"] = entry.duration_ms
    if entry.release_date:
        result["release_date"] = entry.release_date
    if entry.preview_url:
        result["preview_url"] = entry.preview_url
    if entry.itunes_url:
        result["itunes_url"] = entry.itunes_url
    if entry.apple_music_url:
        result["apple_music_url"] = entry.apple_music_url

    # Add lyrics if available
    if entry.lyrics_plain:
        result["lyrics_plain"] = entry.lyrics_plain
    if entry.lyrics_synced:
        result["lyrics_synced"] = entry.lyrics_synced

    return result
