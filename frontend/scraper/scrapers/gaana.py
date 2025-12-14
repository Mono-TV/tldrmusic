# TLDR Music - Gaana Charts Scraper

from typing import List
from .base import BaseScraper, Song


class GaanaScraper(BaseScraper):
    """Scraper for Gaana Top Songs Weekly chart."""

    def __init__(self):
        super().__init__(
            platform_name="gaana",
            url="https://gaana.com/charts/top-songs/weekly"
        )

    async def scrape(self, page) -> List[Song]:
        """Scrape Gaana Top Songs chart."""
        print(f"[Gaana] Navigating to {self.url}")
        await page.goto(self.url, wait_until="domcontentloaded", timeout=90000)

        # Wait for JS to render
        await page.wait_for_timeout(5000)
        await page.wait_for_selector("article.topChartRowArticle", timeout=30000)

        songs = []

        # Gaana uses article.topChartRowArticle for chart rows
        rows = await page.query_selector_all("article.topChartRowArticle")

        for i, row in enumerate(rows):
            try:
                position = i + 1

                # Get song title from .cardDetail h3
                title_el = await row.query_selector(".cardDetail h3")
                if not title_el:
                    continue

                title = await title_el.inner_text()

                # Get artist from .cardDetail p
                artist_el = await row.query_selector(".cardDetail p")
                artist = await artist_el.inner_text() if artist_el else "Unknown"

                song = self._create_song(
                    title=self._clean_title(title),
                    artist=self._clean_artist(artist),
                    position=position
                )
                songs.append(song)
                print(f"[Gaana] #{position}: {song.title} - {song.artist}")

            except Exception as e:
                print(f"[Gaana] Error parsing row {i + 1}: {e}")
                continue

        print(f"[Gaana] Scraped {len(songs)} songs")
        self.songs = songs
        return songs
