# TLDR Music - Apple Music Charts Scraper

from typing import List
from .base import BaseScraper, Song


class AppleMusicScraper(BaseScraper):
    """Scraper for Apple Music India Top Charts."""

    def __init__(self):
        super().__init__(
            platform_name="apple_music",
            url="https://music.apple.com/in/new/top-charts/songs"
        )

    async def scrape(self, page) -> List[Song]:
        """Scrape Apple Music India Top Charts."""
        print(f"[Apple Music] Navigating to {self.url}")
        await page.goto(self.url, wait_until="networkidle", timeout=60000)

        # Wait for song list to load - Apple Music uses various selectors
        try:
            await page.wait_for_selector("div.songs-list-row, div.top-songs-row", timeout=30000)
        except:
            # Try alternative selectors
            await page.wait_for_selector("[data-testid='song-cell']", timeout=30000)

        songs = []

        # Try different selectors as Apple Music's structure may vary
        rows = await page.query_selector_all("div.songs-list-row")
        if not rows:
            rows = await page.query_selector_all("div.top-songs-row")
        if not rows:
            rows = await page.query_selector_all("[data-testid='song-cell']")
        if not rows:
            rows = await page.query_selector_all("div.songs-list__row")

        for i, row in enumerate(rows):
            try:
                position = i + 1

                # Get song title
                title_el = await row.query_selector(".songs-list-row__song-name, .song-name")
                if not title_el:
                    title_el = await row.query_selector("div[class*='song-name']")
                if not title_el:
                    title_el = await row.query_selector("[data-testid='track-title']")
                if not title_el:
                    continue

                title = await title_el.inner_text()

                # Get artist
                artist_el = await row.query_selector(".songs-list-row__link, .song-artist a")
                if not artist_el:
                    artist_el = await row.query_selector("a[href*='/artist/']")
                if not artist_el:
                    artist_el = await row.query_selector("[data-testid='artist-link']")
                artist = await artist_el.inner_text() if artist_el else "Unknown"

                song = self._create_song(
                    title=self._clean_title(title),
                    artist=self._clean_artist(artist),
                    position=position
                )
                songs.append(song)
                print(f"[Apple Music] #{position}: {song.title} - {song.artist}")

            except Exception as e:
                print(f"[Apple Music] Error parsing row {i + 1}: {e}")
                continue

        print(f"[Apple Music] Scraped {len(songs)} songs")
        self.songs = songs
        return songs
