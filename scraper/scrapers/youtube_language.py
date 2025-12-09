# TLDR Music - YouTube Language Charts Scrapers
# Scrapes regional language charts from YouTube Charts

from typing import List
from .base import BaseScraper, Song


class YouTubeLanguageBaseScraper(BaseScraper):
    """Base class for YouTube Language Charts (regional)."""

    async def scrape(self, page) -> List[Song]:
        """Scrape YouTube Language Charts."""
        print(f"[{self.platform_name}] Navigating to {self.url}")
        await page.goto(self.url, wait_until="domcontentloaded", timeout=90000)

        # Wait for JS to render
        await page.wait_for_timeout(5000)
        await page.wait_for_selector("ytmc-entry-row", timeout=30000)

        songs = []

        # Get all chart entries
        rows = await page.query_selector_all("ytmc-entry-row")

        for i, row in enumerate(rows[:30]):  # Limit to top 30 for regional
            try:
                position = i + 1

                # Get song title
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
                print(f"[{self.platform_name}] #{position}: {song.title} - {song.artist}")

            except Exception as e:
                print(f"[{self.platform_name}] Error parsing row {i + 1}: {e}")
                continue

        print(f"[{self.platform_name}] Scraped {len(songs)} songs")
        self.songs = songs
        return songs


class BhojpuriChartsScraper(YouTubeLanguageBaseScraper):
    """Scraper for Bhojpuri Top Songs (YouTube Charts)."""

    def __init__(self):
        super().__init__(
            platform_name="bhojpuri",
            url="https://charts.youtube.com/charts/TopLanguageVideos/in/weekly/bho"
        )


class HaryanviChartsScraper(YouTubeLanguageBaseScraper):
    """Scraper for Haryanvi Top Songs (YouTube Charts)."""

    def __init__(self):
        super().__init__(
            platform_name="haryanvi",
            url="https://charts.youtube.com/charts/TopLanguageVideos/in/weekly/bgc"
        )


class BengaliChartsScraper(YouTubeLanguageBaseScraper):
    """Scraper for Bengali Top Songs (YouTube Charts)."""

    def __init__(self):
        super().__init__(
            platform_name="bengali",
            url="https://charts.youtube.com/charts/TopLanguageVideos/in/weekly/bn"
        )


class MarathiChartsScraper(YouTubeLanguageBaseScraper):
    """Scraper for Marathi Top Songs (YouTube Charts)."""

    def __init__(self):
        super().__init__(
            platform_name="marathi",
            url="https://charts.youtube.com/charts/TopLanguageVideos/in/weekly/mr"
        )


class KannadaChartsScraper(YouTubeLanguageBaseScraper):
    """Scraper for Kannada Top Songs (YouTube Charts)."""

    def __init__(self):
        super().__init__(
            platform_name="kannada",
            url="https://charts.youtube.com/charts/TopLanguageVideos/in/weekly/kn"
        )


class MalayalamChartsScraper(YouTubeLanguageBaseScraper):
    """Scraper for Malayalam Top Songs (YouTube Charts)."""

    def __init__(self):
        super().__init__(
            platform_name="malayalam",
            url="https://charts.youtube.com/charts/TopLanguageVideos/in/weekly/ml"
        )


class GujaratiChartsScraper(YouTubeLanguageBaseScraper):
    """Scraper for Gujarati Top Songs (YouTube Charts)."""

    def __init__(self):
        super().__init__(
            platform_name="gujarati",
            url="https://charts.youtube.com/charts/TopLanguageVideos/in/weekly/gu"
        )
