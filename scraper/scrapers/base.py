# TLDR Music - Base Scraper Class

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class Song:
    """Represents a song from a chart."""
    title: str
    artist: str
    position: int
    platform: str

    def __post_init__(self):
        # Normalize title and artist for better matching
        self.title = self.title.strip()
        self.artist = self.artist.strip()

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "artist": self.artist,
            "position": self.position,
            "platform": self.platform,
        }


class BaseScraper(ABC):
    """Base class for all chart scrapers."""

    def __init__(self, platform_name: str, url: str):
        self.platform_name = platform_name
        self.url = url
        self.songs: List[Song] = []

    @abstractmethod
    async def scrape(self, page) -> List[Song]:
        """
        Scrape the chart and return a list of Song objects.

        Args:
            page: Playwright page object

        Returns:
            List of Song objects with position, title, artist
        """
        pass

    def _create_song(self, title: str, artist: str, position: int) -> Song:
        """Helper to create a Song object."""
        return Song(
            title=title,
            artist=artist,
            position=position,
            platform=self.platform_name,
        )

    def _clean_title(self, title: str) -> str:
        """Remove common suffixes and clean up song titles."""
        # Remove common patterns like "(Official Video)", "[Official Audio]", etc.
        import re
        patterns = [
            r'\s*\(Official\s*(Music\s*)?Video\)',
            r'\s*\[Official\s*(Music\s*)?Video\]',
            r'\s*\(Official\s*Audio\)',
            r'\s*\[Official\s*Audio\]',
            r'\s*\(Lyric\s*Video\)',
            r'\s*\[Lyric\s*Video\]',
            r'\s*\(From\s*["\'].*?["\']\)',
            r'\s*-\s*From\s*["\'].*?["\']',
            r'\s*\|\s*.*$',  # Remove everything after |
        ]

        cleaned = title
        for pattern in patterns:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)

        return cleaned.strip()

    def _clean_artist(self, artist: str) -> str:
        """Clean up artist names."""
        # Remove "feat.", "ft.", "Feat.", etc. and everything after
        import re
        # Keep the main artist, remove featured artists for matching
        cleaned = re.split(r'\s*(?:feat\.?|ft\.?|featuring|&|,)\s*', artist, flags=re.IGNORECASE)[0]
        return cleaned.strip()
