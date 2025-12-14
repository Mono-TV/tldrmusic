# TLDR Music - Global Charts Scrapers

from typing import List
from .base import BaseScraper, Song


class SpotifyGlobalScraper(BaseScraper):
    """Scraper for Spotify Global Top 50 playlist."""

    def __init__(self):
        super().__init__(
            platform_name="spotify_global",
            url="https://open.spotify.com/playlist/37i9dQZEVXbMDoHDwVN2tF"
        )

    async def scrape(self, page) -> List[Song]:
        """Scrape Spotify Global Top 50."""
        print(f"[Spotify Global] Navigating to {self.url}")
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
                print(f"[Spotify Global] #{position}: {song.title} - {song.artist}")

            except Exception as e:
                print(f"[Spotify Global] Error parsing row {i + 1}: {e}")
                continue

        print(f"[Spotify Global] Scraped {len(songs)} songs")
        self.songs = songs
        return songs


class BillboardHot100Scraper(BaseScraper):
    """Scraper for Billboard Hot 100 chart."""

    def __init__(self):
        super().__init__(
            platform_name="billboard_hot100",
            url="https://www.billboard.com/charts/hot-100/"
        )

    async def scrape(self, page) -> List[Song]:
        """Scrape Billboard Hot 100 chart."""
        print(f"[Billboard Hot 100] Navigating to {self.url}")
        await page.goto(self.url, wait_until="domcontentloaded", timeout=90000)

        # Wait for JS to render and chart items to load
        await page.wait_for_timeout(5000)
        await page.wait_for_selector("div.o-chart-results-list-row-container", timeout=30000)

        songs = []

        rows = await page.query_selector_all("div.o-chart-results-list-row-container")

        for i, row in enumerate(rows):
            try:
                position = i + 1

                # Get song title
                title_el = await row.query_selector("h3#title-of-a-story")
                if not title_el:
                    continue
                title = await title_el.inner_text()

                # Get artist
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
                print(f"[Billboard Hot 100] #{position}: {song.title} - {song.artist}")

            except Exception as e:
                print(f"[Billboard Hot 100] Error parsing row {i + 1}: {e}")
                continue

        print(f"[Billboard Hot 100] Scraped {len(songs)} songs")
        self.songs = songs
        return songs


class AppleMusicGlobalScraper(BaseScraper):
    """Scraper for Apple Music Global Top 100."""

    def __init__(self):
        super().__init__(
            platform_name="apple_global",
            url="https://music.apple.com/us/playlist/top-100-global/pl.d25f5d1181894928af76c85c967f8f31"
        )

    async def scrape(self, page) -> List[Song]:
        """Scrape Apple Music Global Top 100."""
        print(f"[Apple Music Global] Navigating to {self.url}")
        await page.goto(self.url, wait_until="networkidle", timeout=60000)

        # Wait for song list to load
        try:
            await page.wait_for_selector("div.songs-list-row, [data-testid='track-row']", timeout=30000)
        except:
            await page.wait_for_selector("[data-testid='song-cell']", timeout=30000)

        songs = []

        # Try different selectors
        rows = await page.query_selector_all("div.songs-list-row")
        if not rows:
            rows = await page.query_selector_all("[data-testid='track-row']")
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
                print(f"[Apple Music Global] #{position}: {song.title} - {song.artist}")

            except Exception as e:
                print(f"[Apple Music Global] Error parsing row {i + 1}: {e}")
                continue

        print(f"[Apple Music Global] Scraped {len(songs)} songs")
        self.songs = songs
        return songs
