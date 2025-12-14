"""
Regional Charts API Routes

Provides V1-compatible endpoints for regional language charts.
"""
from typing import Optional, Dict, List
from fastapi import APIRouter, HTTPException

from ...models import Chart, ChartRegion, RegionalChart, ChartEntry
from ...services.chart import ChartService

router = APIRouter(prefix="/regional", tags=["Regional"])

# Language code to name mapping
LANGUAGE_MAP = {
    "hi": ("Hindi", "hindi"),
    "ta": ("Tamil", "tamil"),
    "te": ("Telugu", "telugu"),
    "pa": ("Punjabi", "punjabi"),
    "bh": ("Bhojpuri", "bhojpuri"),
    "hr": ("Haryanvi", "haryanvi"),
    "bn": ("Bengali", "bengali"),
    "mr": ("Marathi", "marathi"),
    "kn": ("Kannada", "kannada"),
    "ml": ("Malayalam", "malayalam"),
    "gu": ("Gujarati", "gujarati"),
}

# Icons for each language
LANGUAGE_ICONS = {
    "hi": "🇮🇳",
    "ta": "🎵",
    "te": "🎵",
    "pa": "🎵",
    "bh": "🎵",
    "hr": "🎵",
    "bn": "🎵",
    "mr": "🎵",
    "kn": "🎵",
    "ml": "🎵",
    "gu": "🎵",
}


def _chart_to_regional(chart: Chart, lang_code: str) -> RegionalChart:
    """Convert a Chart to RegionalChart format"""
    name, _ = LANGUAGE_MAP.get(lang_code, (lang_code.title(), lang_code))
    icon = LANGUAGE_ICONS.get(lang_code, "🎵")

    return RegionalChart(
        language=lang_code,
        name=name,
        icon=icon,
        songs=chart.entries
    )


@router.get("")
async def get_all_regional():
    """
    Get all regional charts from the current week.

    Returns a dictionary with language keys (hindi, tamil, etc.)
    mapping to regional chart data.

    V1 compatible endpoint.
    """
    result = {}

    for lang_code, (name, key) in LANGUAGE_MAP.items():
        chart = await ChartService.get_current_chart(
            region=ChartRegion.REGIONAL,
            language=lang_code
        )

        if chart and chart.entries:
            result[key] = {
                "name": name,
                "icon": LANGUAGE_ICONS.get(lang_code, "🎵"),
                "songs": [_entry_to_v1_format(e) for e in chart.entries]
            }

    if not result:
        raise HTTPException(status_code=404, detail="No regional data available")

    return result


@router.get("/{language}")
async def get_regional_by_language(language: str):
    """
    Get a specific regional chart by language.

    Language can be:
    - Language code: hi, ta, te, pa, bh, hr, bn, mr, kn, ml, gu
    - Language name: hindi, tamil, telugu, punjabi, etc.

    V1 compatible endpoint.
    """
    # Normalize language input
    lang_code = language.lower()

    # If full name provided, convert to code
    for code, (name, key) in LANGUAGE_MAP.items():
        if lang_code == key or lang_code == name.lower():
            lang_code = code
            break

    if lang_code not in LANGUAGE_MAP:
        raise HTTPException(
            status_code=404,
            detail=f"Regional chart '{language}' not found. Available: {', '.join(LANGUAGE_MAP.keys())}"
        )

    chart = await ChartService.get_current_chart(
        region=ChartRegion.REGIONAL,
        language=lang_code
    )

    if not chart:
        raise HTTPException(
            status_code=404,
            detail=f"No data available for {language}"
        )

    name, key = LANGUAGE_MAP[lang_code]

    return {
        "name": name,
        "icon": LANGUAGE_ICONS.get(lang_code, "🎵"),
        "language": lang_code,
        "songs": [_entry_to_v1_format(e) for e in chart.entries]
    }


def _entry_to_v1_format(entry: ChartEntry) -> dict:
    """Convert ChartEntry to V1 flat format"""
    result = {
        "rank": entry.rank,
        "title": entry.song_title,
        "artist": entry.song_artist,
        "artwork_url": entry.artwork_url,
        "youtube_video_id": entry.youtube_video_id,
    }

    # Add movement as flat fields
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

    # Add optional fields if present
    if entry.youtube_views:
        result["youtube_views"] = entry.youtube_views
    if entry.youtube_likes:
        result["youtube_likes"] = entry.youtube_likes
    if entry.album:
        result["album"] = entry.album
    if entry.genre:
        result["genre"] = entry.genre
    if entry.preview_url:
        result["preview_url"] = entry.preview_url

    return result
