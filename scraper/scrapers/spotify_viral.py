# TLDR Music - Spotify Viral 50 India Scraper

from typing import List
from .base import BaseScraper, Song


class SpotifyViralScraper(BaseScraper):
    """Scraper for Spotify Viral 50 India playlist."""

    def __init__(self):
        super().__init__(
            platform_name="spotify_viral",
            url="https://open.spotify.com/playlist/37i9dQZEVXbMWDif5SCBJq"
        )

    async def scrape(self, page) -> List[Song]:
        """Scrape Spotify Viral 50 India."""
        print(f"[Spotify Viral] Navigating to {self.url}")
        await page.goto(self.url, wait_until="networkidle", timeout=60000)

        # Wait for track rows to load
        await page.wait_for_selector("[data-testid='tracklist-row']", timeout=30000)

        songs = []

        # Get all track rows
        rows = await page.query_selector_all("[data-testid='tracklist-row']")

        for i, row in enumerate(rows):
            try:
                position = i + 1

                # Get song title from the track name element
                title_el = await row.query_selector("[data-testid='internal-track-link'] div")
                if not title_el:
                    title_el = await row.query_selector("div.standalone-ellipsis-one-line")
                if not title_el:
                    continue

                title = await title_el.inner_text()

                # Get artist - usually in the second column
                artist_el = await row.query_selector("[data-testid='internal-track-link'] + span a, span.artists-albums a")
                if not artist_el:
                    # Try getting all artists in the artist column
                    artist_links = await row.query_selector_all("span a[href*='/artist/']")
                    if artist_links:
                        artist = await artist_links[0].inner_text()
                    else:
                        artist = "Unknown"
                else:
                    artist = await artist_el.inner_text()

                song = self._create_song(
                    title=self._clean_title(title),
                    artist=self._clean_artist(artist),
                    position=position
                )
                songs.append(song)
                print(f"[Spotify Viral] #{position}: {song.title} - {song.artist}")

            except Exception as e:
                print(f"[Spotify Viral] Error parsing row {i + 1}: {e}")
                continue

        print(f"[Spotify Viral] Scraped {len(songs)} songs")
        self.songs = songs
        return songs
