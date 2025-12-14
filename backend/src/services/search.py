"""
Search Service - Full-text search across entities
"""
from typing import List, Optional, Dict, Any
import re

from ..models import SongSnapshot, ArtistSummary, AlbumSummary, PlaylistSummary
from .song import SongService
from .artist import ArtistService


class SearchService:
    """
    Handles search operations

    In production, would use Typesense or Elasticsearch.
    For development, uses simple in-memory search.
    """

    @classmethod
    async def search(
        cls,
        query: str,
        type_filter: Optional[str] = None,
        limit: int = 10
    ) -> Dict[str, Any]:
        """
        Universal search across all entities
        """
        results = {
            "songs": [],
            "artists": [],
            "albums": [],
            "playlists": [],
            "total_count": 0,
        }

        if not type_filter or type_filter == "song":
            results["songs"] = await cls.search_songs(query, limit=limit)

        if not type_filter or type_filter == "artist":
            results["artists"] = await cls.search_artists(query, limit=limit)

        # Albums and playlists - placeholder
        results["albums"] = []
        results["playlists"] = []

        results["total_count"] = (
            len(results["songs"]) +
            len(results["artists"]) +
            len(results["albums"]) +
            len(results["playlists"])
        )

        return results

    @classmethod
    async def search_songs(
        cls,
        query: str,
        language: Optional[str] = None,
        limit: int = 25
    ) -> List[SongSnapshot]:
        """
        Search songs by title or artist

        Uses simple string matching for development.
        Production should use Typesense/Elasticsearch.
        """
        songs = await SongService._load_songs_from_files()
        artists_map = await SongService._load_artists_map()

        query_lower = query.lower().strip()
        query_words = query_lower.split()

        results = []
        scores = []

        for song in songs:
            if language and song.language != language:
                continue

            # Get artist name
            artist_name = ""
            if song.artist_ids:
                artist = artists_map.get(song.artist_ids[0])
                if artist:
                    artist_name = artist.get("name", "").lower()

            title_lower = song.title.lower()

            # Calculate match score
            score = 0

            # Exact title match
            if query_lower == title_lower:
                score = 100
            # Title starts with query
            elif title_lower.startswith(query_lower):
                score = 80
            # Query words in title
            elif all(word in title_lower for word in query_words):
                score = 60
            # Partial title match
            elif query_lower in title_lower:
                score = 40
            # Artist match
            elif query_lower in artist_name:
                score = 30
            # Any word matches
            elif any(word in title_lower or word in artist_name for word in query_words):
                score = 20

            if score > 0:
                results.append((score, song))

        # Sort by score descending
        results.sort(key=lambda x: x[0], reverse=True)

        return [
            SongService._to_snapshot(song, artists_map)
            for score, song in results[:limit]
        ]

    @classmethod
    async def search_artists(
        cls,
        query: str,
        limit: int = 10
    ) -> List[ArtistSummary]:
        """
        Search artists by name
        """
        artists = await ArtistService._load_artists_from_files()

        query_lower = query.lower().strip()
        query_words = query_lower.split()

        results = []

        for artist in artists:
            name_lower = artist.name.lower()

            # Calculate match score
            score = 0

            if query_lower == name_lower:
                score = 100
            elif name_lower.startswith(query_lower):
                score = 80
            elif query_lower in name_lower:
                score = 50
            elif any(word in name_lower for word in query_words):
                score = 30

            if score > 0:
                results.append((score, artist))

        # Sort by score descending
        results.sort(key=lambda x: x[0], reverse=True)

        return [
            ArtistSummary(
                id=artist.id,
                name=artist.name,
                image_url=artist.images.thumbnail if artist.images else None,
                verified=artist.verified,
            )
            for score, artist in results[:limit]
        ]

    @classmethod
    async def get_suggestions(
        cls,
        query: str,
        limit: int = 5
    ) -> List[str]:
        """
        Get autocomplete suggestions
        """
        if len(query) < 2:
            return []

        songs = await SongService._load_songs_from_files()
        artists = await ArtistService._load_artists_from_files()

        query_lower = query.lower().strip()

        suggestions = set()

        # Song titles
        for song in songs:
            if song.title.lower().startswith(query_lower):
                suggestions.add(song.title)
            if len(suggestions) >= limit * 2:
                break

        # Artist names
        for artist in artists:
            if artist.name.lower().startswith(query_lower):
                suggestions.add(artist.name)
            if len(suggestions) >= limit * 2:
                break

        return list(suggestions)[:limit]
