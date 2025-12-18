"""
Curated Playlists API Routes

Provides endpoints for curated playlists from the music_harvester database.
This integrates 68,000+ songs with mood, language, artist, and era categorization.
"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
import re

from ...config import settings

router = APIRouter(prefix="/curated", tags=["Curated Playlists"])

# Music Harvester database connection (separate from main TLDR Music DB)
MUSIC_HARVESTER_URL = "mongodb://circuit-house:ch998812%403@52.77.214.150:27017/music_harvester?authSource=admin"
_harvester_client: Optional[AsyncIOMotorClient] = None
_harvester_db = None


def get_harvester_db():
    """Get or create connection to music_harvester database"""
    global _harvester_client, _harvester_db
    if _harvester_db is None:
        _harvester_client = AsyncIOMotorClient(MUSIC_HARVESTER_URL)
        _harvester_db = _harvester_client["music_harvester"]
    return _harvester_db


# Mood mappings (mood value -> display name)
MOOD_MAP = {
    "chill": "Chill",
    "workout": "Workout",
    "party": "Party",
    "romance": "Romance",
    "sad": "Sad",
    "focus": "Focus",
    "gaming": "Gaming",
    "feel-good": "Feel good",
    "sleep": "Sleep",
    "commute": "Commute",
    "energize": "Energize",
}

# Language mappings (our key -> language name in DB)
LANGUAGE_MAP = {
    "hindi": "Hindi",
    "tamil": "Tamil",
    "telugu": "Telugu",
    "punjabi": "Punjabi",
    "english": "English",
    "bengali": "Bengali",
    "kannada": "Kannada",
    "malayalam": "Malayalam",
    "bhojpuri": "Bhojpuri",
    "marathi": "Marathi",
    "gujarati": "Gujarati",
    "haryanvi": "Haryanvi",
}

# Era mappings
ERA_MAP = {
    "2025": {"start": 2025, "end": 2025, "name": "2025 Fresh"},
    "2024": {"start": 2024, "end": 2024, "name": "2024 Top Picks"},
    "2023": {"start": 2023, "end": 2023, "name": "2023 Best Of"},
    "2022": {"start": 2022, "end": 2022, "name": "2022 Favorites"},
    "2010s": {"start": 2010, "end": 2019, "name": "2010s Throwback"},
    "retro": {"start": 1950, "end": 2009, "name": "Retro Classics"},
}

# Artist mappings (id -> search name)
ARTIST_MAP = {
    "arijit": "Arijit Singh",
    "anirudh": "Anirudh Ravichander",
    "masoom": "Masoom Sharma",
    "kishore": "Kishore Kumar",
    "shreya": "Shreya Ghoshal",
    "sonu": "Sonu Nigam",
    "taylor": "Taylor Swift",
    "lata": "Lata Mangeshkar",
    "rafi": "Mohammed Rafi",
    "badshah": "Badshah",
    "udit": "Udit Narayan",
    "diljit": "Diljit Dosanjh",
    "ed": "Ed Sheeran",
    "karan": "Karan Aujla",
    "kumar": "Kumar Sanu",
    "chris": "Chris Brown",
    "drake": "Drake",
    "khesari": "Khesari Lal Yadav",
    "weeknd": "The Weeknd",
    "neha": "Neha Kakkar",
}


def _format_song(song: Dict[str, Any]) -> Dict[str, Any]:
    """Format a song document for the API response"""
    # Get thumbnail URL from thumbnails array or use default
    artwork_url = None
    if song.get("thumbnails"):
        # Get the highest quality thumbnail
        thumbnails = song["thumbnails"]
        if isinstance(thumbnails, list) and len(thumbnails) > 0:
            # Sort by width (descending) and get the largest
            sorted_thumbs = sorted(thumbnails, key=lambda x: x.get("width", 0), reverse=True)
            artwork_url = sorted_thumbs[0].get("url")

    return {
        "title": song.get("title", "Unknown"),
        "artist": song.get("artist", "Unknown Artist"),
        "album": song.get("album"),
        "youtube_video_id": song.get("video_id"),
        "artwork_url": artwork_url,
        "duration_seconds": song.get("duration_seconds"),
        "mood": song.get("mood"),
        "chart_name": song.get("chart_name"),
    }


@router.get("/categories")
async def get_categories():
    """
    Get all curated playlist categories with song counts.
    """
    db = get_harvester_db()
    yt_songs = db["youtube_music_songs"]
    songs_col = db["songs"]

    # Get mood counts from youtube_music_songs
    mood_counts = {}
    for mood_key, mood_name in MOOD_MAP.items():
        count = await yt_songs.count_documents({"mood": mood_name, "video_id": {"$ne": None}})
        mood_counts[mood_key] = count

    # Get language counts from songs collection
    language_counts = {}
    for lang_key, lang_name in LANGUAGE_MAP.items():
        count = await songs_col.count_documents({"language": lang_name})
        language_counts[lang_key] = count

    return {
        "moods": [
            {"id": f"mood-{k}", "name": v, "key": k, "songCount": mood_counts.get(k, 0)}
            for k, v in MOOD_MAP.items()
        ],
        "languages": [
            {"id": f"lang-{k}", "name": v, "key": k, "songCount": language_counts.get(k, 0)}
            for k, v in LANGUAGE_MAP.items()
        ],
        "artists": [
            {"id": f"artist-{k}", "name": v, "key": k}
            for k, v in ARTIST_MAP.items()
        ],
        "eras": [
            {"id": f"era-{k}", "name": v["name"], "key": k}
            for k, v in ERA_MAP.items()
        ],
    }


@router.get("/mood/{mood}")
async def get_mood_playlist(
    mood: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    Get songs for a specific mood playlist.

    Mood options: chill, workout, party, romance, sad, focus, gaming, feel-good, sleep, commute, energize
    """
    # Normalize mood key
    mood_key = mood.lower().replace("mood-", "")

    if mood_key not in MOOD_MAP:
        raise HTTPException(
            status_code=404,
            detail=f"Mood '{mood}' not found. Available: {', '.join(MOOD_MAP.keys())}"
        )

    mood_name = MOOD_MAP[mood_key]
    db = get_harvester_db()
    yt_songs = db["youtube_music_songs"]

    # Query songs with this mood that have video_id
    cursor = yt_songs.find(
        {"mood": mood_name, "video_id": {"$ne": None}},
        {"_id": 0}
    ).sort("chart_position", 1).skip(offset).limit(limit)

    songs = []
    async for song in cursor:
        songs.append(_format_song(song))

    # Get total count
    total = await yt_songs.count_documents({"mood": mood_name, "video_id": {"$ne": None}})

    return {
        "id": f"mood-{mood_key}",
        "name": f"{mood_name} Vibes" if mood_name == "Chill" else mood_name,
        "type": "mood",
        "mood": mood_key,
        "songs": songs,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/language/{language}")
async def get_language_playlist(
    language: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    Get songs for a specific language playlist.

    Language options: hindi, tamil, telugu, punjabi, english, bengali, kannada, malayalam, bhojpuri, marathi, gujarati, haryanvi
    """
    # Normalize language key
    lang_key = language.lower().replace("lang-", "")

    if lang_key not in LANGUAGE_MAP:
        raise HTTPException(
            status_code=404,
            detail=f"Language '{language}' not found. Available: {', '.join(LANGUAGE_MAP.keys())}"
        )

    lang_name = LANGUAGE_MAP[lang_key]
    db = get_harvester_db()

    # First try to get from youtube_music_songs with video_id via chart_name
    yt_songs = db["youtube_music_songs"]

    # Map language to chart pattern
    chart_patterns = {
        "hindi": "Hindi",
        "tamil": "Tamil",
        "telugu": "Telugu",
        "punjabi": "Punjabi",
        "bhojpuri": "Bhojpuri",
        "haryanvi": "Haryanvi",
    }

    songs = []
    total = 0

    if lang_key in chart_patterns:
        # Search in chart_name for regional charts
        pattern = re.compile(chart_patterns[lang_key], re.IGNORECASE)
        cursor = yt_songs.find(
            {"chart_name": pattern, "video_id": {"$ne": None}},
            {"_id": 0}
        ).sort("chart_position", 1).skip(offset).limit(limit)

        async for song in cursor:
            songs.append(_format_song(song))

        total = await yt_songs.count_documents({"chart_name": pattern, "video_id": {"$ne": None}})

    # If not enough songs, also search in songs collection
    if len(songs) < limit:
        songs_col = db["songs"]
        remaining = limit - len(songs)

        cursor = songs_col.find(
            {"language": lang_name},
            {"_id": 0}
        ).skip(offset if len(songs) == 0 else 0).limit(remaining)

        async for song in cursor:
            # Format songs collection format
            formatted = {
                "title": song.get("title", "Unknown"),
                "artist": song.get("artist", "Unknown Artist"),
                "album": song.get("album"),
                "youtube_video_id": None,  # No video_id in songs collection
                "artwork_url": song.get("platforms", {}).get("jiosaavn", {}).get("image_url"),
                "duration_seconds": None,
                "language": song.get("language"),
            }
            songs.append(formatted)

        if total == 0:
            total = await songs_col.count_documents({"language": lang_name})

    return {
        "id": f"lang-{lang_key}",
        "name": f"{lang_name} Hits",
        "type": "language",
        "language": lang_key,
        "songs": songs,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/artist/{artist}")
async def get_artist_playlist(
    artist: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    Get songs for a specific artist playlist.
    """
    # Normalize artist key
    artist_key = artist.lower().replace("artist-", "")

    if artist_key not in ARTIST_MAP:
        raise HTTPException(
            status_code=404,
            detail=f"Artist '{artist}' not found. Available: {', '.join(ARTIST_MAP.keys())}"
        )

    artist_name = ARTIST_MAP[artist_key]
    db = get_harvester_db()
    yt_songs = db["youtube_music_songs"]

    # Search for artist in artist field (case-insensitive partial match)
    pattern = re.compile(re.escape(artist_name), re.IGNORECASE)

    cursor = yt_songs.find(
        {"artist": pattern, "video_id": {"$ne": None}},
        {"_id": 0}
    ).sort("chart_position", 1).skip(offset).limit(limit)

    songs = []
    async for song in cursor:
        songs.append(_format_song(song))

    total = await yt_songs.count_documents({"artist": pattern, "video_id": {"$ne": None}})

    return {
        "id": f"artist-{artist_key}",
        "name": artist_name,
        "type": "artist",
        "artist": artist_name,
        "songs": songs,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/era/{era}")
async def get_era_playlist(
    era: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    Get songs for a specific era/decade playlist.

    Era options: 2025, 2024, 2023, 2022, 2010s, retro
    """
    # Normalize era key
    era_key = era.lower().replace("era-", "")

    if era_key not in ERA_MAP:
        raise HTTPException(
            status_code=404,
            detail=f"Era '{era}' not found. Available: {', '.join(ERA_MAP.keys())}"
        )

    era_info = ERA_MAP[era_key]
    db = get_harvester_db()
    songs_col = db["songs"]

    # Query songs by year range
    query = {
        "year": {"$gte": era_info["start"], "$lte": era_info["end"]}
    }

    cursor = songs_col.find(query, {"_id": 0}).sort("year", -1).skip(offset).limit(limit)

    songs = []
    async for song in cursor:
        formatted = {
            "title": song.get("title", "Unknown"),
            "artist": song.get("artist", "Unknown Artist"),
            "album": song.get("album"),
            "youtube_video_id": None,  # Need to lookup or add
            "artwork_url": song.get("platforms", {}).get("jiosaavn", {}).get("image_url"),
            "duration_seconds": None,
            "year": song.get("year"),
            "language": song.get("language"),
        }
        songs.append(formatted)

    total = await songs_col.count_documents(query)

    return {
        "id": f"era-{era_key}",
        "name": era_info["name"],
        "type": "era",
        "era": era_key,
        "songs": songs,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/search")
async def search_curated(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50)
):
    """
    Search songs in the music_harvester database.
    """
    db = get_harvester_db()
    yt_songs = db["youtube_music_songs"]

    # Search in title and artist fields
    pattern = re.compile(re.escape(q), re.IGNORECASE)

    cursor = yt_songs.find(
        {
            "$or": [
                {"title": pattern},
                {"artist": pattern}
            ],
            "video_id": {"$ne": None}
        },
        {"_id": 0}
    ).limit(limit)

    songs = []
    async for song in cursor:
        songs.append(_format_song(song))

    return {
        "query": q,
        "songs": songs,
        "count": len(songs),
    }
