# TLDR Music - Prime Music (Amazon Music) Scraper

from typing import List
from .base import BaseScraper, Song


class PrimeMusicScraper(BaseScraper):
    """Scraper for Amazon Prime Music India Popular Songs.

    Note: Amazon Music requires authentication to display song content.
    This scraper is currently disabled until a public API is available.
    """

    def __init__(self):
        super().__init__(
            platform_name="prime_music",
            url="https://music.amazon.in/popular/songs"
        )

    async def scrape(self, page) -> List[Song]:
        """Scrape Amazon Prime Music Popular Songs.

        Currently returns empty list as Amazon Music requires authentication
        to display song data in their web components.
        """
        print("[Prime Music] Skipping - Amazon Music requires authentication")
        print("[Prime Music] Content is not accessible without login")
        return []
