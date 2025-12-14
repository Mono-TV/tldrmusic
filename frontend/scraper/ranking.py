# TLDR Music - Ranking and Consolidation Engine

import re
from typing import List, Dict, Tuple
from dataclasses import dataclass, field
from collections import defaultdict

from scrapers.base import Song
from config import PLATFORM_WEIGHTS, FINAL_CHART_SIZE


@dataclass
class ConsolidatedSong:
    """A song consolidated from multiple platforms."""
    canonical_title: str
    canonical_artist: str
    platforms: Dict[str, int] = field(default_factory=dict)  # platform -> position
    score: float = 0.0
    platforms_count: int = 0
    # YouTube metadata
    youtube_video_id: str = ""
    youtube_views: int = 0
    youtube_duration: str = ""  # ISO 8601 duration (PT3M45S)
    youtube_likes: int = 0
    youtube_published: str = ""  # ISO date
    # iTunes/Apple Music metadata
    artwork_url: str = ""
    album_name: str = ""
    release_date: str = ""  # ISO date (YYYY-MM-DD)
    genre: str = ""
    duration_ms: int = 0  # Duration in milliseconds
    preview_url: str = ""  # 30-second preview audio URL
    itunes_url: str = ""  # iTunes store URL
    apple_music_url: str = ""  # Apple Music URL
    # Lyrics
    lyrics_plain: str = ""
    lyrics_synced: str = ""
    # Additional metadata
    isrc: str = ""  # International Standard Recording Code
    explicit: bool = False
    language: str = ""

    def to_dict(self) -> dict:
        result = {
            "title": self.canonical_title,
            "artist": self.canonical_artist,
            "score": round(self.score, 3),
            "platforms_count": self.platforms_count,
            "youtube_video_id": self.youtube_video_id,
            "youtube_views": self.youtube_views,
            "artwork_url": self.artwork_url,
        }
        # Include metadata fields only if they have values
        if self.youtube_duration:
            result["youtube_duration"] = self.youtube_duration
        if self.youtube_likes:
            result["youtube_likes"] = self.youtube_likes
        if self.youtube_published:
            result["youtube_published"] = self.youtube_published
        if self.album_name:
            result["album"] = self.album_name
        if self.release_date:
            result["release_date"] = self.release_date
        if self.genre:
            result["genre"] = self.genre
        if self.duration_ms:
            result["duration_ms"] = self.duration_ms
        if self.preview_url:
            result["preview_url"] = self.preview_url
        if self.itunes_url:
            result["itunes_url"] = self.itunes_url
        if self.apple_music_url:
            result["apple_music_url"] = self.apple_music_url
        if self.lyrics_plain:
            result["lyrics_plain"] = self.lyrics_plain
        if self.lyrics_synced:
            result["lyrics_synced"] = self.lyrics_synced
        if self.isrc:
            result["isrc"] = self.isrc
        if self.explicit:
            result["explicit"] = self.explicit
        if self.language:
            result["language"] = self.language
        return result


class RankingEngine:
    """
    Consolidates songs from multiple platforms into a single ranked chart.

    Algorithm:
    1. Normalize song titles and artists for matching
    2. Group same songs from different platforms
    3. Calculate weighted score based on platform weights and positions
    4. Sort by score, with tiebreakers
    5. Return top N songs
    """

    def __init__(self):
        self.platform_weights = PLATFORM_WEIGHTS
        self.chart_size = FINAL_CHART_SIZE
        self.songs_by_key: Dict[str, ConsolidatedSong] = {}

    def _normalize_text(self, text: str) -> str:
        """Normalize text for matching - lowercase, remove special chars."""
        if not text:
            return ""
        # Convert to lowercase
        normalized = text.lower()
        # Remove parentheses and their contents
        normalized = re.sub(r'\([^)]*\)', '', normalized)
        normalized = re.sub(r'\[[^\]]*\]', '', normalized)
        # Remove special characters except spaces
        normalized = re.sub(r'[^\w\s]', '', normalized)
        # Collapse multiple spaces
        normalized = re.sub(r'\s+', ' ', normalized)
        return normalized.strip()

    def _create_song_key(self, title: str, artist: str) -> str:
        """
        Create a unique key for a song based on normalized title and artist.
        This helps match the same song across platforms with slight name variations.
        """
        norm_title = self._normalize_text(title)
        norm_artist = self._normalize_text(artist)

        # Take first 30 chars of title and first 20 chars of artist
        # This helps with matching when one platform has extra info
        key_title = norm_title[:30] if len(norm_title) > 30 else norm_title
        key_artist = norm_artist[:20] if len(norm_artist) > 20 else norm_artist

        return f"{key_title}|{key_artist}"

    def _calculate_position_score(self, position: int, max_position: int = 50) -> float:
        """
        Calculate score based on chart position.
        Higher position (lower number) = higher score.

        Formula: (max_position - position + 1) / max_position
        Position 1 → 1.0
        Position 25 → 0.52
        Position 50 → 0.02
        """
        return (max_position - position + 1) / max_position

    def add_songs(self, songs: List[Song]) -> None:
        """
        Add songs from a platform to the consolidation pool.

        Args:
            songs: List of Song objects from a single platform
        """
        for song in songs:
            key = self._create_song_key(song.title, song.artist)

            if key not in self.songs_by_key:
                # Create new consolidated song entry
                self.songs_by_key[key] = ConsolidatedSong(
                    canonical_title=song.title,
                    canonical_artist=song.artist,
                )

            # Add this platform's data
            consolidated = self.songs_by_key[key]
            consolidated.platforms[song.platform] = song.position

            # Update canonical name if this platform has higher weight
            # (prefer Apple Music/Spotify naming as they're more standardized)
            current_weight = self.platform_weights.get(song.platform, 0)
            if current_weight >= 1.5:  # Apple Music or Spotify
                consolidated.canonical_title = song.title
                consolidated.canonical_artist = song.artist

    def calculate_scores(self) -> None:
        """Calculate the final score for each consolidated song."""
        for key, song in self.songs_by_key.items():
            total_score = 0.0

            for platform, position in song.platforms.items():
                weight = self.platform_weights.get(platform, 1.0)
                position_score = self._calculate_position_score(position)
                total_score += weight * position_score

            song.score = total_score
            song.platforms_count = len(song.platforms)

    def get_top_songs(self) -> List[ConsolidatedSong]:
        """
        Get the top N songs sorted by score with tiebreakers.

        Sorting order:
        1. Score (descending)
        2. Platforms count (descending) - tiebreaker 1
        3. YouTube views (descending) - tiebreaker 2 (applied after YouTube lookup)

        Returns:
            List of top N ConsolidatedSong objects
        """
        # Calculate scores first
        self.calculate_scores()

        # Sort songs
        sorted_songs = sorted(
            self.songs_by_key.values(),
            key=lambda s: (s.score, s.platforms_count, s.youtube_views),
            reverse=True
        )

        return sorted_songs[:self.chart_size]

    def consolidate(self, all_platform_songs: Dict[str, List[Song]]) -> List[ConsolidatedSong]:
        """
        Main entry point: consolidate songs from all platforms.

        Args:
            all_platform_songs: Dict mapping platform name to list of songs

        Returns:
            Top N consolidated and ranked songs
        """
        print("\n" + "=" * 50)
        print("RANKING ENGINE: Starting consolidation")
        print("=" * 50)

        # Reset state
        self.songs_by_key = {}

        # Add songs from each platform
        for platform, songs in all_platform_songs.items():
            print(f"Adding {len(songs)} songs from {platform}")
            self.add_songs(songs)

        print(f"\nTotal unique songs found: {len(self.songs_by_key)}")

        # Get top songs
        top_songs = self.get_top_songs()

        print(f"\nTop {len(top_songs)} songs consolidated:")
        for i, song in enumerate(top_songs, 1):
            platforms_str = ", ".join(song.platforms.keys())
            print(f"  {i}. {song.canonical_title} - {song.canonical_artist}")
            print(f"     Score: {song.score:.3f} | Platforms ({song.platforms_count}): {platforms_str}")

        return top_songs


def print_detailed_report(songs: List[ConsolidatedSong]) -> None:
    """Print a detailed ranking report."""
    print("\n" + "=" * 70)
    print("TLDR MUSIC - CONSOLIDATED CHART")
    print("=" * 70)

    for i, song in enumerate(songs, 1):
        print(f"\n#{i} | {song.canonical_title}")
        print(f"    Artist: {song.canonical_artist}")
        print(f"    Score: {song.score:.3f}")
        print(f"    Appears on {song.platforms_count} platforms:")
        for platform, position in sorted(song.platforms.items(), key=lambda x: x[1]):
            weight = PLATFORM_WEIGHTS.get(platform, 1.0)
            print(f"      - {platform}: #{position} (weight: {weight})")

    print("\n" + "=" * 70)
