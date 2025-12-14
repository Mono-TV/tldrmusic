"""
Charts API Routes

Provides both V2 and V1-compatible endpoints for chart data.
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query

from ...models import Chart, ChartSummary, ChartRegion, ChartEntry
from ...services.chart import ChartService

router = APIRouter(prefix="/charts", tags=["Charts"])

# Also create a router for V1 aliases (without 's')
v1_router = APIRouter(prefix="/chart", tags=["Charts (V1 Compat)"])


@router.get("", response_model=List[ChartSummary])
async def list_charts(
    region: Optional[ChartRegion] = None,
    language: Optional[str] = None,
    limit: int = Query(default=10, le=50),
):
    """
    List available charts

    Get a list of available charts, optionally filtered by region or language.
    """
    charts = await ChartService.list_charts(
        region=region,
        language=language,
        limit=limit
    )
    return charts


@router.get("/current", response_model=Chart)
async def get_current_chart(
    region: ChartRegion = ChartRegion.INDIA,
    language: Optional[str] = None,
):
    """
    Get current week's chart

    Returns the latest chart for the specified region.
    For regional charts, specify the language code (ta, te, pa, etc.)
    """
    chart = await ChartService.get_current_chart(region=region, language=language)

    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    return chart


@router.get("/{chart_id}", response_model=Chart)
async def get_chart(chart_id: str):
    """
    Get chart by ID

    Returns a specific chart with all entries.
    """
    chart = await ChartService.get_chart_by_id(chart_id)

    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")

    return chart


@router.get("/{chart_id}/history", response_model=List[ChartSummary])
async def get_chart_history(
    chart_id: str,
    limit: int = Query(default=10, le=52),
):
    """
    Get chart history

    Returns historical versions of this chart (previous weeks).
    """
    history = await ChartService.get_chart_history(chart_id, limit=limit)
    return history


# ============================================================
# V1 Compatible Endpoints (using /chart instead of /charts)
# ============================================================

def _entry_to_v1_song(entry: ChartEntry) -> Dict[str, Any]:
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
        # Use V1 flat fields directly if available
        result["is_new"] = entry.is_new
        result["rank_change"] = entry.rank_change
        result["previous_rank"] = entry.previous_rank

    # Add engagement stats
    if entry.youtube_views:
        result["youtube_views"] = entry.youtube_views
    if entry.youtube_likes:
        result["youtube_likes"] = entry.youtube_likes
    if entry.spotify_streams:
        result["spotify_streams"] = entry.spotify_streams

    # Add V1 song metadata
    if entry.album:
        result["album"] = entry.album
    if entry.genre:
        result["genre"] = entry.genre
    if entry.duration_ms:
        result["duration_ms"] = entry.duration_ms
    if entry.youtube_duration:
        result["youtube_duration"] = entry.youtube_duration
    if entry.youtube_published:
        result["youtube_published"] = entry.youtube_published
    if entry.release_date:
        result["release_date"] = entry.release_date
    if entry.preview_url:
        result["preview_url"] = entry.preview_url
    if entry.itunes_url:
        result["itunes_url"] = entry.itunes_url
    if entry.apple_music_url:
        result["apple_music_url"] = entry.apple_music_url
    if entry.lyrics_plain:
        result["lyrics_plain"] = entry.lyrics_plain
    if entry.lyrics_synced:
        result["lyrics_synced"] = entry.lyrics_synced

    return result


def _chart_to_v1_response(chart: Chart) -> Dict[str, Any]:
    """Convert Chart to V1 response format"""
    return {
        "generated_at": chart.generated_at.isoformat() if chart.generated_at else None,
        "week": chart.week,
        "total_songs": len(chart.entries),
        "chart": [_entry_to_v1_song(entry) for entry in chart.entries],
    }


@v1_router.get("/current")
async def v1_get_current_chart():
    """
    Get current week's chart (V1 compatible).

    Returns the India Top 25 chart in V1 flat format.
    """
    chart = await ChartService.get_current_chart(region=ChartRegion.INDIA)

    if not chart:
        raise HTTPException(status_code=404, detail="No chart data available")

    return _chart_to_v1_response(chart)


@v1_router.get("/history")
async def v1_get_chart_history():
    """
    Get list of all available chart weeks (V1 compatible).
    """
    charts = await ChartService.list_charts(region=ChartRegion.INDIA, limit=52)

    return {
        "weeks": [c.week for c in charts],
        "total": len(charts)
    }


@v1_router.get("/{week}")
async def v1_get_chart_by_week(week: str):
    """
    Get chart for a specific week (V1 compatible).

    Week format: YYYY-Www (e.g., 2025-W50)
    """
    # Try to find chart by week
    charts = await ChartService.list_charts(region=ChartRegion.INDIA, limit=100)

    for chart_summary in charts:
        if chart_summary.week == week:
            chart = await ChartService.get_chart_by_id(chart_summary.id)
            if chart:
                return _chart_to_v1_response(chart)

    raise HTTPException(status_code=404, detail=f"No chart found for week {week}")
