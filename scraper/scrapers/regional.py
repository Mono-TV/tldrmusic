# TLDR Music - Regional Charts Scrapers (Tamil, Telugu, Punjabi)

from typing import List
from .base import BaseScraper, Song


class RegionalBaseScraper(BaseScraper):
    """Base class for regional Spotify charts."""

    async def scrape(self, page) -> List[Song]:
        """Scrape regional Spotify playlist."""
        print(f"[{self.platform_name}] Navigating to {self.url}")
        await page.goto(self.url, wait_until="networkidle", timeout=60000)

        # Wait for track rows to load
        await page.wait_for_selector("[data-testid='tracklist-row']", timeout=30000)

        songs = []

        # Get all track rows
        rows = await page.query_selector_all("[data-testid='tracklist-row']")

        for i, row in enumerate(rows[:30]):  # Limit to top 30 for regional
            try:
                position = i + 1

                # Get song title
                title_el = await row.query_selector("[data-testid='internal-track-link'] div")
                if not title_el:
                    title_el = await row.query_selector("div.standalone-ellipsis-one-line")
                if not title_el:
                    continue

                title = await title_el.inner_text()

                # Get artist
                artist_el = await row.query_selector("[data-testid='internal-track-link'] + span a, span.artists-albums a")
                if not artist_el:
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
                print(f"[{self.platform_name}] #{position}: {song.title} - {song.artist}")

            except Exception as e:
                print(f"[{self.platform_name}] Error parsing row {i + 1}: {e}")
                continue

        print(f"[{self.platform_name}] Scraped {len(songs)} songs")
        self.songs = songs
        return songs


class TamilChartsScraper(RegionalBaseScraper):
    """Scraper for Tamil Top 50 (Spotify)."""

    def __init__(self):
        super().__init__(
            platform_name="tamil",
            url="https://open.spotify.com/playlist/37i9dQZF1DX1i3hvzHpcQV"  # Hot Hits Tamil (Official)
        )


class TeluguChartsScraper(RegionalBaseScraper):
    """Scraper for Telugu Top 50 (Spotify)."""

    def __init__(self):
        super().__init__(
            platform_name="telugu",
            url="https://open.spotify.com/playlist/37i9dQZF1DWWwrjLPC16W7"  # Latest Telugu (Official)
        )


class PunjabiChartsScraper(RegionalBaseScraper):
    """Scraper for Punjabi Top 50 (Spotify)."""

    def __init__(self):
        super().__init__(
            platform_name="punjabi",
            url="https://open.spotify.com/playlist/37i9dQZF1DX5cZuAHLNjGz"  # Top 50 Punjabi
        )


class HindiChartsScraper(RegionalBaseScraper):
    """Scraper for Hindi Top 50 (Bollywood/Indie) (Spotify)."""

    def __init__(self):
        super().__init__(
            platform_name="hindi",
            url="https://open.spotify.com/playlist/37i9dQZF1DX0XUfTFmNBRM"  # Hot Hits Hindi (Official)
        )
