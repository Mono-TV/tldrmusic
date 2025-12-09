# TLDR Music - Rich Metadata Fetcher using iTunes Search API
# Fetches comprehensive metadata: artwork, album, genre, duration, preview, etc.

import json
import os
import aiohttp
import asyncio
from typing import List, Optional, Dict
from urllib.parse import quote

from config import DATA_DIR
from ranking import ConsolidatedSong


METADATA_CACHE_FILE = "data/metadata_cache.json"


class MetadataFetcher:
    """
    Fetches comprehensive song metadata using iTunes Search API.
    Free, no authentication required.

    Available metadata from iTunes:
    - Album name (collectionName)
    - Release date (releaseDate)
    - Genre (primaryGenreName)
    - Duration in ms (trackTimeMillis)
    - Preview URL (previewUrl) - 30 second audio preview
    - Artwork URL (artworkUrl100 -> upgraded to 600x600)
    - iTunes URL (trackViewUrl)
    - Explicit flag (trackExplicitness)
    - ISRC code (when available)
    """

    def __init__(self):
        self.cache = self._load_cache()
        self.api_calls_made = 0

    def _load_cache(self) -> Dict:
        """Load cached metadata results."""
        cache_path = os.path.join(os.path.dirname(__file__), '..', METADATA_CACHE_FILE)
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}

    def _save_cache(self) -> None:
        """Save metadata results to cache."""
        cache_path = os.path.join(os.path.dirname(__file__), '..', METADATA_CACHE_FILE)
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(self.cache, f, indent=2, ensure_ascii=False)

    def _get_cache_key(self, title: str, artist: str) -> str:
        """Generate cache key for a song."""
        return f"{title.lower()}|{artist.lower()}"

    def _parse_itunes_result(self, data: dict) -> Optional[Dict]:
        """Extract all useful metadata from iTunes API response."""
        if not data:
            return None

        result = {}

        # Artwork - upgrade to high resolution
        artwork_url = data.get('artworkUrl100', '')
        if artwork_url:
            result['artwork_url'] = artwork_url.replace('100x100', '600x600')

        # Album name
        if data.get('collectionName'):
            result['album_name'] = data['collectionName']

        # Release date (format: 2024-01-15T12:00:00Z -> 2024-01-15)
        if data.get('releaseDate'):
            result['release_date'] = data['releaseDate'][:10]

        # Genre
        if data.get('primaryGenreName'):
            result['genre'] = data['primaryGenreName']

        # Duration in milliseconds
        if data.get('trackTimeMillis'):
            result['duration_ms'] = data['trackTimeMillis']

        # Preview URL (30 second audio clip)
        if data.get('previewUrl'):
            result['preview_url'] = data['previewUrl']

        # iTunes URL
        if data.get('trackViewUrl'):
            result['itunes_url'] = data['trackViewUrl']
            # Generate Apple Music URL from iTunes URL
            result['apple_music_url'] = data['trackViewUrl'].replace(
                'itunes.apple.com',
                'music.apple.com'
            ).replace('/song/', '/album/')

        # Explicit flag
        if data.get('trackExplicitness') == 'explicit':
            result['explicit'] = True

        # Track and artist info for verification
        result['_itunes_track'] = data.get('trackName', '')
        result['_itunes_artist'] = data.get('artistName', '')

        return result

    async def search_metadata(
        self,
        session: aiohttp.ClientSession,
        title: str,
        artist: str
    ) -> Optional[Dict]:
        """
        Search for song metadata on iTunes.

        Args:
            session: aiohttp session
            title: Song title
            artist: Artist name

        Returns:
            Dict with all available metadata or None
        """
        cache_key = self._get_cache_key(title, artist)

        # Check cache first
        if cache_key in self.cache:
            cached = self.cache[cache_key]
            if cached:
                print(f"  [Cache] Metadata: {title}")
                return cached
            return None

        # Search iTunes with both title and artist
        query = f"{title} {artist}"
        encoded_query = quote(query)
        url = f"https://itunes.apple.com/search?term={encoded_query}&media=music&entity=song&limit=3&country=IN"

        try:
            async with session.get(url) as response:
                self.api_calls_made += 1

                if response.status != 200:
                    print(f"  [iTunes] Error {response.status} for: {title}")
                    return None

                text = await response.text()
                data = json.loads(text)

                # Try to find best match from results
                results = data.get('results', [])

                if not results:
                    # Try US store as fallback
                    url_us = f"https://itunes.apple.com/search?term={encoded_query}&media=music&entity=song&limit=3&country=US"
                    async with session.get(url_us) as resp_us:
                        self.api_calls_made += 1
                        if resp_us.status == 200:
                            text_us = await resp_us.text()
                            data_us = json.loads(text_us)
                            results = data_us.get('results', [])

                if results:
                    # Use first result (most relevant)
                    metadata = self._parse_itunes_result(results[0])

                    if metadata:
                        print(f"  [iTunes] Found: {title} | Album: {metadata.get('album_name', 'N/A')}")

                        # Cache the result
                        self.cache[cache_key] = metadata
                        self._save_cache()

                        return metadata

                print(f"  [iTunes] No metadata: {title}")
                # Cache the miss
                self.cache[cache_key] = None
                self._save_cache()
                return None

        except Exception as e:
            print(f"  [iTunes] Error: {e}")
            return None

    async def enrich_songs_with_metadata(
        self,
        songs: List[ConsolidatedSong]
    ) -> List[ConsolidatedSong]:
        """
        Fetch comprehensive metadata for all songs.

        Args:
            songs: List of consolidated songs

        Returns:
            Same list with metadata fields populated
        """
        print("\n" + "=" * 60)
        print("METADATA API: Fetching rich metadata from iTunes")
        print("=" * 60)

        async with aiohttp.ClientSession() as session:
            for i, song in enumerate(songs, 1):
                print(f"\n[{i}/{len(songs)}] {song.canonical_title} - {song.canonical_artist}")

                metadata = await self.search_metadata(
                    session,
                    song.canonical_title,
                    song.canonical_artist
                )

                if metadata:
                    # Apply all metadata to song
                    if metadata.get('artwork_url'):
                        song.artwork_url = metadata['artwork_url']
                    if metadata.get('album_name'):
                        song.album_name = metadata['album_name']
                    if metadata.get('release_date'):
                        song.release_date = metadata['release_date']
                    if metadata.get('genre'):
                        song.genre = metadata['genre']
                    if metadata.get('duration_ms'):
                        song.duration_ms = metadata['duration_ms']
                    if metadata.get('preview_url'):
                        song.preview_url = metadata['preview_url']
                    if metadata.get('itunes_url'):
                        song.itunes_url = metadata['itunes_url']
                    if metadata.get('apple_music_url'):
                        song.apple_music_url = metadata['apple_music_url']
                    if metadata.get('explicit'):
                        song.explicit = metadata['explicit']

                # Small delay to be nice to iTunes API
                await asyncio.sleep(0.15)

        print(f"\n[Metadata API] Total API calls made: {self.api_calls_made}")

        # Statistics
        with_artwork = sum(1 for s in songs if s.artwork_url)
        with_album = sum(1 for s in songs if s.album_name)
        with_preview = sum(1 for s in songs if s.preview_url)
        with_genre = sum(1 for s in songs if s.genre)

        print(f"[Metadata API] Songs with artwork: {with_artwork}/{len(songs)}")
        print(f"[Metadata API] Songs with album: {with_album}/{len(songs)}")
        print(f"[Metadata API] Songs with preview: {with_preview}/{len(songs)}")
        print(f"[Metadata API] Songs with genre: {with_genre}/{len(songs)}")

        return songs
