"""
Artist Service - Business logic for artists
"""
from typing import List, Optional
import json
from pathlib import Path

from ..models import Artist, ArtistSummary, SongSnapshot, AlbumSummary
from ..config import Database


class ArtistService:
    """
    Handles artist operations
    """

    # Cache for file-based data (development mode)
    _file_cache: dict = {}

    @classmethod
    async def get_artist_by_id(cls, artist_id: str) -> Optional[Artist]:
        """Get artist by ID"""
        artists = await cls._load_artists_from_files()

        for artist in artists:
            if artist.id == artist_id:
                return artist

        return None

    @classmethod
    async def get_artist_songs(
        cls,
        artist_id: str,
        limit: int = 25,
        offset: int = 0
    ) -> List[SongSnapshot]:
        """Get songs by an artist"""
        from .song import SongService

        songs = await SongService._load_songs_from_files()
        artists_map = await SongService._load_artists_map()

        result = []
        for song in songs:
            if artist_id in song.artist_ids or artist_id in song.featured_artist_ids:
                result.append(SongService._to_snapshot(song, artists_map))

        return result[offset:offset + limit]

    @classmethod
    async def get_artist_albums(
        cls,
        artist_id: str,
        limit: int = 25
    ) -> List[AlbumSummary]:
        """Get albums by an artist (placeholder)"""
        # In production, would query albums collection
        return []

    @classmethod
    async def get_related_artists(
        cls,
        artist_id: str,
        limit: int = 10
    ) -> List[ArtistSummary]:
        """Get related artists based on genre/language"""
        artists = await cls._load_artists_from_files()

        target = None
        for a in artists:
            if a.id == artist_id:
                target = a
                break

        if not target:
            return []

        result = []
        for artist in artists:
            if artist.id == artist_id:
                continue

            # Same genres or languages
            if (set(artist.genres) & set(target.genres)) or \
               (set(artist.languages) & set(target.languages)):
                result.append(ArtistSummary(
                    id=artist.id,
                    name=artist.name,
                    image_url=artist.images.thumbnail if artist.images else None,
                    verified=artist.verified,
                ))

            if len(result) >= limit:
                break

        return result

    @classmethod
    async def list_artists(
        cls,
        genre: Optional[str] = None,
        language: Optional[str] = None,
        limit: int = 25,
        offset: int = 0
    ) -> List[ArtistSummary]:
        """List artists with optional filters"""
        artists = await cls._load_artists_from_files()

        result = []
        for artist in artists:
            if genre and genre not in artist.genres:
                continue
            if language and language not in artist.languages:
                continue

            result.append(ArtistSummary(
                id=artist.id,
                name=artist.name,
                image_url=artist.images.thumbnail if artist.images else None,
                verified=artist.verified,
            ))

        return result[offset:offset + limit]

    @classmethod
    async def _load_artists_from_files(cls) -> List[Artist]:
        """Load artists from JSON files (development mode)"""
        if cls._file_cache.get("artists"):
            return cls._file_cache["artists"]

        data_dir = Path(__file__).parent.parent.parent / "data" / "v2"
        artists_file = data_dir / "artists.json"

        if not artists_file.exists():
            return []

        with open(artists_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        artists = [Artist(**a) for a in data]
        cls._file_cache["artists"] = artists

        return artists

    @classmethod
    def clear_cache(cls):
        """Clear file cache"""
        cls._file_cache.clear()
