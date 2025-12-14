"""
Search API Routes
"""
from typing import List, Optional
from fastapi import APIRouter, Query

from ...models import SongSnapshot, ArtistSummary, AlbumSummary, PlaylistSummary
from ...services.search import SearchService

router = APIRouter(prefix="/search", tags=["Search"])


class SearchResults:
    """Combined search results"""
    songs: List[SongSnapshot]
    artists: List[ArtistSummary]
    albums: List[AlbumSummary]
    playlists: List[PlaylistSummary]
    total_count: int


@router.get("")
async def search(
    q: str = Query(..., min_length=1, description="Search query"),
    type: Optional[str] = Query(
        default=None,
        description="Filter by type: song, artist, album, playlist"
    ),
    limit: int = Query(default=10, le=50),
):
    """
    Universal search

    Search across songs, artists, albums, and playlists.
    Optionally filter by type.
    """
    results = await SearchService.search(
        query=q,
        type_filter=type,
        limit=limit
    )
    return results


@router.get("/songs", response_model=List[SongSnapshot])
async def search_songs(
    q: str = Query(..., min_length=1),
    language: Optional[str] = None,
    limit: int = Query(default=25, le=100),
):
    """
    Search songs

    Search for songs by title or artist name.
    """
    songs = await SearchService.search_songs(
        query=q,
        language=language,
        limit=limit
    )
    return songs


@router.get("/artists", response_model=List[ArtistSummary])
async def search_artists(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=10, le=50),
):
    """
    Search artists

    Search for artists by name.
    """
    artists = await SearchService.search_artists(query=q, limit=limit)
    return artists


@router.get("/suggestions", response_model=List[str])
async def get_suggestions(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=5, le=10),
):
    """
    Get search suggestions

    Returns autocomplete suggestions based on partial query.
    """
    suggestions = await SearchService.get_suggestions(query=q, limit=limit)
    return suggestions
