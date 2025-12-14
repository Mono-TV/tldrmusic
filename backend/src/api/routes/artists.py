"""
Artists API Routes
"""
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from ...models import Artist, ArtistSummary, SongSnapshot, AlbumSummary
from ...services.artist import ArtistService

router = APIRouter(prefix="/artists", tags=["Artists"])


@router.get("/{artist_id}", response_model=Artist)
async def get_artist(artist_id: str):
    """
    Get artist profile

    Returns full artist details including bio, images, and social links.
    """
    artist = await ArtistService.get_artist_by_id(artist_id)

    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")

    return artist


@router.get("/{artist_id}/songs", response_model=List[SongSnapshot])
async def get_artist_songs(
    artist_id: str,
    limit: int = Query(default=25, le=100),
    offset: int = Query(default=0, ge=0),
):
    """
    Get artist's songs

    Returns songs by the specified artist, sorted by popularity.
    """
    songs = await ArtistService.get_artist_songs(
        artist_id,
        limit=limit,
        offset=offset
    )
    return songs


@router.get("/{artist_id}/albums", response_model=List[AlbumSummary])
async def get_artist_albums(
    artist_id: str,
    limit: int = Query(default=25, le=100),
):
    """
    Get artist's albums

    Returns albums by the specified artist, sorted by release date.
    """
    albums = await ArtistService.get_artist_albums(artist_id, limit=limit)
    return albums


@router.get("/{artist_id}/related", response_model=List[ArtistSummary])
async def get_related_artists(
    artist_id: str,
    limit: int = Query(default=10, le=25),
):
    """
    Get related artists

    Returns artists similar to the specified artist based on genre and collaborations.
    """
    related = await ArtistService.get_related_artists(artist_id, limit=limit)
    return related


@router.get("", response_model=List[ArtistSummary])
async def list_artists(
    genre: Optional[str] = None,
    language: Optional[str] = None,
    limit: int = Query(default=25, le=100),
    offset: int = Query(default=0, ge=0),
):
    """
    List artists

    Get a paginated list of artists, optionally filtered by genre or language.
    """
    artists = await ArtistService.list_artists(
        genre=genre,
        language=language,
        limit=limit,
        offset=offset
    )
    return artists
