"""
Songs API Routes
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from ...models import Song, SongSnapshot, Lyrics
from ...services.song import SongService

router = APIRouter(prefix="/songs", tags=["Songs"])


@router.get("/{song_id}", response_model=Song)
async def get_song(song_id: str):
    """
    Get song details

    Returns full song details including lyrics, audio sources, and metadata.
    """
    song = await SongService.get_song_by_id(song_id)

    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    # Increment play count (optional - could be separate endpoint)
    await SongService.increment_play_count(song_id)

    return song


@router.get("/{song_id}/lyrics", response_model=Lyrics)
async def get_lyrics(song_id: str):
    """
    Get song lyrics

    Returns plain and synced lyrics for a song.
    """
    lyrics = await SongService.get_lyrics(song_id)

    if not lyrics:
        raise HTTPException(status_code=404, detail="Lyrics not found")

    return lyrics


@router.get("/{song_id}/related", response_model=List[SongSnapshot])
async def get_related_songs(
    song_id: str,
    limit: int = Query(default=10, le=25),
):
    """
    Get related songs

    Returns songs similar to the specified song based on artist, genre, and language.
    """
    song = await SongService.get_song_by_id(song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    related = await SongService.get_related_songs(song, limit=limit)
    return related


@router.get("", response_model=List[SongSnapshot])
async def list_songs(
    language: Optional[str] = None,
    genre: Optional[str] = None,
    limit: int = Query(default=25, le=100),
    offset: int = Query(default=0, ge=0),
):
    """
    List songs

    Get a paginated list of songs, optionally filtered by language or genre.
    """
    songs = await SongService.list_songs(
        language=language,
        genre=genre,
        limit=limit,
        offset=offset
    )
    return songs
