# TLDR Music - Artwork Fetcher using iTunes Search API

import json
import os
import aiohttp
import asyncio
from typing import List, Optional, Dict
from urllib.parse import quote

from config import DATA_DIR
from ranking import ConsolidatedSong


ARTWORK_CACHE_FILE = "data/artwork_cache.json"


class ArtworkFetcher:
    """
    Fetches high-quality album artwork using iTunes Search API.
    Free, no authentication required.
    """

    def __init__(self):
        self.cache = self._load_cache()
        self.api_calls_made = 0

    def _load_cache(self) -> Dict:
        """Load cached artwork results."""
        cache_path = os.path.join(os.path.dirname(__file__), '..', ARTWORK_CACHE_FILE)
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}

    def _save_cache(self) -> None:
        """Save artwork results to cache."""
        cache_path = os.path.join(os.path.dirname(__file__), '..', ARTWORK_CACHE_FILE)
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(self.cache, f, indent=2, ensure_ascii=False)

    def _get_cache_key(self, title: str, artist: str) -> str:
        """Generate cache key for a song."""
        return f"{title.lower()}|{artist.lower()}"

    async def search_artwork(self, session: aiohttp.ClientSession, title: str, artist: str) -> Optional[str]:
        """
        Search for album artwork on iTunes.

        Args:
            session: aiohttp session
            title: Song title
            artist: Artist name

        Returns:
            High-res artwork URL (600x600) or None
        """
        cache_key = self._get_cache_key(title, artist)

        # Check cache first
        if cache_key in self.cache:
            cached = self.cache[cache_key]
            if cached:  # Could be None if previously not found
                print(f"  [Cache] Artwork: {title}")
                return cached
            return None

        # Search iTunes
        query = f"{title} {artist}"
        encoded_query = quote(query)
        url = f"https://itunes.apple.com/search?term={encoded_query}&media=music&entity=song&limit=1"

        try:
            async with session.get(url) as response:
                self.api_calls_made += 1

                if response.status != 200:
                    print(f"  [iTunes] Error {response.status} for: {title}")
                    return None

                # iTunes API returns text/javascript content type, so we parse as text first
                text = await response.text()
                data = json.loads(text)

                if not data.get('results'):
                    # Try searching with just the title
                    url_title_only = f"https://itunes.apple.com/search?term={quote(title)}&media=music&entity=song&limit=1"
                    async with session.get(url_title_only) as resp2:
                        self.api_calls_made += 1
                        if resp2.status == 200:
                            text2 = await resp2.text()
                            data = json.loads(text2)

                if data.get('results'):
                    # Get artwork URL and upgrade to high resolution (600x600)
                    artwork_url = data['results'][0].get('artworkUrl100', '')
                    if artwork_url:
                        # Replace 100x100 with 600x600 for higher quality
                        high_res_url = artwork_url.replace('100x100', '600x600')
                        print(f"  [iTunes] Found artwork: {title}")

                        # Cache the result
                        self.cache[cache_key] = high_res_url
                        self._save_cache()

                        return high_res_url

                print(f"  [iTunes] No artwork: {title}")
                # Cache the miss to avoid repeated lookups
                self.cache[cache_key] = None
                self._save_cache()
                return None

        except Exception as e:
            print(f"  [iTunes] Error: {e}")
            return None

    async def enrich_songs_with_artwork(self, songs: List[ConsolidatedSong]) -> List[ConsolidatedSong]:
        """
        Fetch artwork for all songs.

        Args:
            songs: List of consolidated songs

        Returns:
            Same list with artwork_url populated
        """
        print("\n" + "=" * 50)
        print("ARTWORK API: Fetching album artwork")
        print("=" * 50)

        async with aiohttp.ClientSession() as session:
            for i, song in enumerate(songs, 1):
                print(f"\n[{i}/{len(songs)}] {song.canonical_title} - {song.canonical_artist}")

                artwork_url = await self.search_artwork(
                    session,
                    song.canonical_title,
                    song.canonical_artist
                )

                if artwork_url:
                    song.artwork_url = artwork_url

                # Small delay to be nice to iTunes API
                await asyncio.sleep(0.1)

        print(f"\n[Artwork API] Total API calls made: {self.api_calls_made}")

        # Count successes
        with_artwork = sum(1 for s in songs if s.artwork_url)
        print(f"[Artwork API] Songs with artwork: {with_artwork}/{len(songs)}")

        return songs
