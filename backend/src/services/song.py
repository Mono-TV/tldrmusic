"""
Song Service - Business logic for songs
"""
from typing import List, Optional
import json
from pathlib import Path

from ..models import Song, SongSnapshot, Lyrics
from ..config import Database


class SongService:
    """
    Handles song operations
    """

    # Cache for file-based songs (development mode)
    _file_cache: dict = {}

    @classmethod
    async def get_song_by_id(cls, song_id: str) -> Optional[Song]:
        """Get song by ID"""
        songs = await cls._load_songs_from_files()

        for song in songs:
            if song.id == song_id:
                return song

        return None

    @classmethod
    async def get_lyrics(cls, song_id: str) -> Optional[Lyrics]:
        """Get lyrics for a song"""
        song = await cls.get_song_by_id(song_id)
        if song:
            return song.lyrics
        return None

    @classmethod
    async def get_related_songs(
        cls,
        song: Song,
        limit: int = 10
    ) -> List[SongSnapshot]:
        """
        Get songs related to the given song

        Based on: same artist, same language, same genre
        """
        songs = await cls._load_songs_from_files()
        artists = await cls._load_artists_map()

        related = []
        for s in songs:
            if s.id == song.id:
                continue

            # Same artist
            if set(s.artist_ids) & set(song.artist_ids):
                related.append(cls._to_snapshot(s, artists))
                continue

            # Same language
            if s.language == song.language and song.language:
                related.append(cls._to_snapshot(s, artists))
                continue

            if len(related) >= limit:
                break

        return related[:limit]

    @classmethod
    async def list_songs(
        cls,
        language: Optional[str] = None,
        genre: Optional[str] = None,
        limit: int = 25,
        offset: int = 0
    ) -> List[SongSnapshot]:
        """List songs with optional filters"""
        songs = await cls._load_songs_from_files()
        artists = await cls._load_artists_map()

        result = []
        for song in songs:
            if language and song.language != language:
                continue
            if genre and genre not in song.genres:
                continue

            result.append(cls._to_snapshot(song, artists))

        return result[offset:offset + limit]

    @classmethod
    async def increment_play_count(cls, song_id: str):
        """Increment song play count"""
        # In production, this would update MongoDB
        pass

    @classmethod
    def _to_snapshot(cls, song: Song, artists: dict) -> SongSnapshot:
        """Convert Song to SongSnapshot"""
        # Get primary artist name
        artist_name = "Unknown Artist"
        if song.artist_ids:
            artist = artists.get(song.artist_ids[0])
            if artist:
                artist_name = artist.get("name", "Unknown Artist")

        # Get YouTube video ID
        youtube_id = None
        for source in song.sources:
            if source.provider.value == "youtube":
                youtube_id = source.id
                break

        return SongSnapshot(
            id=song.id,
            title=song.title,
            artist=artist_name,
            artwork_url=song.artwork.large if song.artwork else None,
            youtube_video_id=youtube_id,
            duration_ms=song.duration_ms,
        )

    @classmethod
    async def _load_songs_from_files(cls) -> List[Song]:
        """Load songs from JSON files (development mode)"""
        if cls._file_cache.get("songs"):
            return cls._file_cache["songs"]

        data_dir = Path(__file__).parent.parent.parent / "data" / "v2"
        songs_file = data_dir / "songs.json"

        if not songs_file.exists():
            return []

        with open(songs_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        songs = [Song(**s) for s in data]
        cls._file_cache["songs"] = songs

        return songs

    @classmethod
    async def _load_artists_map(cls) -> dict:
        """Load artists as ID->data map"""
        if cls._file_cache.get("artists_map"):
            return cls._file_cache["artists_map"]

        data_dir = Path(__file__).parent.parent.parent / "data" / "v2"
        artists_file = data_dir / "artists.json"

        if not artists_file.exists():
            return {}

        with open(artists_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        artists_map = {a["id"]: a for a in data}
        cls._file_cache["artists_map"] = artists_map

        return artists_map

    @classmethod
    def clear_cache(cls):
        """Clear file cache"""
        cls._file_cache.clear()
