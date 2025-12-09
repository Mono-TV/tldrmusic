# TLDR Music - Lyrics Fetcher using LRCLIB API

import json
import os
import aiohttp
import asyncio
from typing import List, Optional, Dict, Tuple
from urllib.parse import quote

from config import DATA_DIR
from ranking import ConsolidatedSong


LYRICS_CACHE_FILE = "data/lyrics_cache.json"


class LyricsFetcher:
    """
    Fetches song lyrics using LRCLIB API.
    Free, no authentication required.
    Supports both plain and synced (timed) lyrics.
    """

    def __init__(self):
        self.cache = self._load_cache()
        self.api_calls_made = 0

    def _load_cache(self) -> Dict:
        """Load cached lyrics results."""
        cache_path = os.path.join(os.path.dirname(__file__), '..', LYRICS_CACHE_FILE)
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}

    def _save_cache(self) -> None:
        """Save lyrics results to cache."""
        cache_path = os.path.join(os.path.dirname(__file__), '..', LYRICS_CACHE_FILE)
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(self.cache, f, indent=2, ensure_ascii=False)

    def _get_cache_key(self, title: str, artist: str) -> str:
        """Generate cache key for a song."""
        return f"{title.lower()}|{artist.lower()}"

    async def search_lyrics(
        self,
        session: aiohttp.ClientSession,
        title: str,
        artist: str
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Search for lyrics on LRCLIB.

        Args:
            session: aiohttp session
            title: Song title
            artist: Artist name

        Returns:
            Tuple of (plain_lyrics, synced_lyrics) - either can be None
        """
        cache_key = self._get_cache_key(title, artist)

        # Check cache first
        if cache_key in self.cache:
            cached = self.cache[cache_key]
            if cached:
                print(f"  [Cache] Lyrics: {title}")
                return cached.get('plain'), cached.get('synced')
            return None, None

        # Build LRCLIB API URL
        encoded_artist = quote(artist)
        encoded_title = quote(title)
        url = f"https://lrclib.net/api/get?artist_name={encoded_artist}&track_name={encoded_title}"

        headers = {
            'User-Agent': 'TLDR Music/1.0 (https://github.com/tldrmusic)'
        }

        try:
            async with session.get(url, headers=headers) as response:
                self.api_calls_made += 1

                if response.status == 404:
                    # Try search endpoint as fallback
                    search_url = f"https://lrclib.net/api/search?q={quote(f'{title} {artist}')}"
                    async with session.get(search_url, headers=headers) as search_resp:
                        self.api_calls_made += 1
                        if search_resp.status == 200:
                            results = await search_resp.json()
                            if results and len(results) > 0:
                                # Use first result
                                data = results[0]
                                plain = data.get('plainLyrics')
                                synced = data.get('syncedLyrics')

                                if plain or synced:
                                    print(f"  [LRCLIB] Found via search: {title}")
                                    self.cache[cache_key] = {'plain': plain, 'synced': synced}
                                    self._save_cache()
                                    return plain, synced

                    print(f"  [LRCLIB] Not found: {title}")
                    self.cache[cache_key] = None
                    self._save_cache()
                    return None, None

                if response.status != 200:
                    print(f"  [LRCLIB] Error {response.status} for: {title}")
                    return None, None

                data = await response.json()

                plain_lyrics = data.get('plainLyrics')
                synced_lyrics = data.get('syncedLyrics')

                if plain_lyrics or synced_lyrics:
                    sync_status = "synced" if synced_lyrics else "plain"
                    print(f"  [LRCLIB] Found ({sync_status}): {title}")

                    # Cache the result
                    self.cache[cache_key] = {
                        'plain': plain_lyrics,
                        'synced': synced_lyrics
                    }
                    self._save_cache()

                    return plain_lyrics, synced_lyrics

                print(f"  [LRCLIB] No lyrics: {title}")
                self.cache[cache_key] = None
                self._save_cache()
                return None, None

        except Exception as e:
            print(f"  [LRCLIB] Error: {e}")
            return None, None

    async def enrich_songs_with_lyrics(self, songs: List[ConsolidatedSong]) -> List[ConsolidatedSong]:
        """
        Fetch lyrics for all songs.

        Args:
            songs: List of consolidated songs

        Returns:
            Same list with lyrics fields populated
        """
        print("\n" + "=" * 50)
        print("LYRICS API: Fetching song lyrics from LRCLIB")
        print("=" * 50)

        async with aiohttp.ClientSession() as session:
            for i, song in enumerate(songs, 1):
                print(f"\n[{i}/{len(songs)}] {song.canonical_title} - {song.canonical_artist}")

                plain, synced = await self.search_lyrics(
                    session,
                    song.canonical_title,
                    song.canonical_artist
                )

                if plain:
                    song.lyrics_plain = plain
                if synced:
                    song.lyrics_synced = synced

                # Small delay to be respectful to API
                await asyncio.sleep(0.2)

        print(f"\n[Lyrics API] Total API calls made: {self.api_calls_made}")

        # Count successes
        with_lyrics = sum(1 for s in songs if s.lyrics_plain or s.lyrics_synced)
        with_synced = sum(1 for s in songs if s.lyrics_synced)
        print(f"[Lyrics API] Songs with lyrics: {with_lyrics}/{len(songs)}")
        print(f"[Lyrics API] Songs with synced lyrics: {with_synced}/{len(songs)}")

        return songs
