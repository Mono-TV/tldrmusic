# TLDR Music - Shazam India Charts Scraper

from typing import List
from .base import BaseScraper, Song


class ShazamScraper(BaseScraper):
    """Scraper for Shazam Top 200 India charts."""

    def __init__(self):
        super().__init__(
            platform_name="shazam",
            url="https://www.shazam.com/charts/top-200/india"
        )

    async def scrape(self, page) -> List[Song]:
        """Scrape Shazam Top 200 India."""
        print(f"[Shazam] Navigating to {self.url}")
        await page.goto(self.url, wait_until="networkidle", timeout=60000)

        # Wait for chart to load
        await page.wait_for_selector("article.chart-track", timeout=30000)

        songs = []

        # Get all track rows
        rows = await page.query_selector_all("article.chart-track")

        for i, row in enumerate(rows[:50]):  # Limit to top 50
            try:
                position = i + 1

                # Get song title
                title_el = await row.query_selector(".chart-track__title, h3")
                if not title_el:
                    continue
                title = await title_el.inner_text()

                # Get artist
                artist_el = await row.query_selector(".chart-track__artist, p")
                if not artist_el:
                    artist = "Unknown"
                else:
                    artist = await artist_el.inner_text()

                song = self._create_song(
                    title=self._clean_title(title),
                    artist=self._clean_artist(artist),
                    position=position
                )
                songs.append(song)
                print(f"[Shazam] #{position}: {song.title} - {song.artist}")

            except Exception as e:
                print(f"[Shazam] Error parsing row {i + 1}: {e}")
                continue

        print(f"[Shazam] Scraped {len(songs)} songs")
        self.songs = songs
        return songs
