# TLDR Music - YouTube Music Charts Scraper

from typing import List
from .base import BaseScraper, Song


class YouTubeMusicScraper(BaseScraper):
    """Scraper for YouTube Music Trending Videos chart (India Weekly)."""

    def __init__(self):
        super().__init__(
            platform_name="youtube_music",
            url="https://charts.youtube.com/charts/TrendingVideos/in/weekly"
        )

    async def scrape(self, page) -> List[Song]:
        """Scrape YouTube Music Charts."""
        print(f"[YouTube Music] Navigating to {self.url}")
        await page.goto(self.url, wait_until="domcontentloaded", timeout=90000)

        # Wait for JS to render
        await page.wait_for_timeout(5000)
        await page.wait_for_selector("ytmc-entry-row", timeout=30000)

        songs = []

        # Get all chart entries
        rows = await page.query_selector_all("ytmc-entry-row")

        for i, row in enumerate(rows):
            try:
                position = i + 1

                # Get song title - use the correct class names
                title_el = await row.query_selector(".title")
                if not title_el:
                    continue

                title = await title_el.inner_text()

                # Get artist from subtitle
                artist_el = await row.query_selector(".subtitle")
                artist = await artist_el.inner_text() if artist_el else "Unknown"

                song = self._create_song(
                    title=self._clean_title(title),
                    artist=self._clean_artist(artist),
                    position=position
                )
                songs.append(song)
                print(f"[YouTube Music] #{position}: {song.title} - {song.artist}")

            except Exception as e:
                print(f"[YouTube Music] Error parsing row {i + 1}: {e}")
                continue

        print(f"[YouTube Music] Scraped {len(songs)} songs")
        self.songs = songs
        return songs
