# TLDR Music - Billboard India Songs Scraper

from typing import List
from .base import BaseScraper, Song


class BillboardScraper(BaseScraper):
    """Scraper for Billboard India Songs Hot Weekly chart."""

    def __init__(self):
        super().__init__(
            platform_name="billboard",
            url="https://www.billboard.com/charts/india-songs-hotw/"
        )

    async def scrape(self, page) -> List[Song]:
        """Scrape Billboard India Songs chart."""
        print(f"[Billboard] Navigating to {self.url}")
        await page.goto(self.url, wait_until="domcontentloaded", timeout=90000)

        # Wait for JS to render and chart items to load
        await page.wait_for_timeout(5000)
        await page.wait_for_selector("div.o-chart-results-list-row-container", timeout=30000)

        songs = []

        # Billboard chart structure: each row has rank, title, artist
        rows = await page.query_selector_all("div.o-chart-results-list-row-container")

        for i, row in enumerate(rows):
            try:
                # Get position
                position = i + 1

                # Get song title - usually in h3#title-of-a-story
                title_el = await row.query_selector("h3#title-of-a-story")
                if not title_el:
                    continue
                title = await title_el.inner_text()

                # Get artist - usually in span.c-label after the title
                artist_el = await row.query_selector("span.c-label.a-no-trucate")
                if not artist_el:
                    artist_el = await row.query_selector("span.c-label")
                artist = await artist_el.inner_text() if artist_el else "Unknown"

                song = self._create_song(
                    title=self._clean_title(title),
                    artist=self._clean_artist(artist),
                    position=position
                )
                songs.append(song)
                print(f"[Billboard] #{position}: {song.title} - {song.artist}")

            except Exception as e:
                print(f"[Billboard] Error parsing row {i + 1}: {e}")
                continue

        print(f"[Billboard] Scraped {len(songs)} songs")
        self.songs = songs
        return songs
