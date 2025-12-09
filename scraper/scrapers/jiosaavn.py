# TLDR Music - JioSaavn Scraper (API-based)

import aiohttp
from typing import List
from .base import BaseScraper, Song


class JioSaavnScraper(BaseScraper):
    """Scraper for JioSaavn Trending Today playlist using public API."""

    # Trending Today playlist ID
    PLAYLIST_ID = "110858205"
    API_BASE = "https://www.jiosaavn.com/api.php"

    def __init__(self):
        super().__init__(
            platform_name="jiosaavn",
            url="https://www.jiosaavn.com/featured/trending-today/I3kvhipIy73uCJW60TJk1Q__"
        )

    async def scrape(self, page) -> List[Song]:
        """Scrape JioSaavn Trending Today using API (bypasses bot detection)."""
        print(f"[JioSaavn] Using API to fetch Trending Today playlist")

        songs = []

        try:
            async with aiohttp.ClientSession() as session:
                # Step 1: Get playlist to retrieve song IDs
                playlist_url = (
                    f"{self.API_BASE}?__call=playlist.getDetails"
                    f"&listid={self.PLAYLIST_ID}&_format=json&_marker=0"
                )
                async with session.get(playlist_url) as resp:
                    if resp.status != 200:
                        print(f"[JioSaavn] API error: {resp.status}")
                        return []
                    playlist_data = await resp.json(content_type=None)

                song_ids = playlist_data.get("content_list", [])
                if not song_ids:
                    print("[JioSaavn] No songs found in playlist")
                    return []

                print(f"[JioSaavn] Found {len(song_ids)} songs in playlist")

                # Step 2: Fetch song details in batches of 20
                batch_size = 20
                for batch_start in range(0, min(len(song_ids), 50), batch_size):
                    batch_ids = song_ids[batch_start:batch_start + batch_size]
                    pids = ",".join(batch_ids)

                    details_url = (
                        f"{self.API_BASE}?__call=song.getDetails"
                        f"&pids={pids}&_format=json&_marker=0"
                    )
                    async with session.get(details_url) as resp:
                        if resp.status != 200:
                            continue
                        songs_data = await resp.json(content_type=None)

                    # Process each song in order
                    for i, song_id in enumerate(batch_ids):
                        if song_id not in songs_data:
                            continue

                        song_info = songs_data[song_id]
                        position = batch_start + i + 1

                        title = song_info.get("song", "")
                        artist = song_info.get("primary_artists", "Unknown")

                        if not title:
                            continue

                        song = self._create_song(
                            title=self._clean_title(title),
                            artist=self._clean_artist(artist),
                            position=position
                        )
                        songs.append(song)
                        print(f"[JioSaavn] #{position}: {song.title} - {song.artist}")

        except Exception as e:
            print(f"[JioSaavn] API error: {e}")
            return []

        print(f"[JioSaavn] Scraped {len(songs)} songs via API")
        self.songs = songs
        return songs
