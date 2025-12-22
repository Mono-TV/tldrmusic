"""
Music Conductor API Client for tldrmusic

Copy this file into your project to use the Music Conductor API.

Usage:
    from music_conductor_client import MusicConductorClient

    client = MusicConductorClient()

    # Search songs
    results = client.search_songs("arijit", has_youtube=True)
    for song in results["songs"]:
        print(f"{song['title']} - {song['artist_name']}")

    # Get playlist
    playlist = client.get_playlist("hip-hop-rap")
    for track in playlist["tracks"]:
        print(f"{track['title']} - {track['artist']}")
"""

import requests
from typing import Optional, List, Dict, Any

BASE_URL = "https://music-conductor-401132033262.asia-south1.run.app"


class MusicConductorClient:
    """Client for Music Conductor API."""

    def __init__(self, base_url: str = BASE_URL, timeout: int = 30):
        """
        Initialize the client.

        Args:
            base_url: API base URL
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _get(self, endpoint: str, params: dict = None) -> dict:
        """Make GET request."""
        resp = requests.get(
            f"{self.base_url}{endpoint}",
            params=params,
            timeout=self.timeout
        )
        resp.raise_for_status()
        return resp.json()

    # ==================== SEARCH ====================

    def search_songs(
        self,
        query: str = "",
        language: str = None,
        genre: str = None,
        has_youtube: bool = None,
        page: int = 1,
        per_page: int = 20,
        sort_by: str = None,
    ) -> dict:
        """
        Search songs with typo tolerance.

        Args:
            query: Search query (empty for all songs)
            language: Filter by language code (e.g., 'hi', 'en', 'es')
            genre: Filter by genre (e.g., 'Pop', 'Hip-Hop/Rap', 'Bollywood')
            has_youtube: Only return songs with YouTube videos
            page: Page number (starts at 1)
            per_page: Results per page (max 100)
            sort_by: Sort by 'title', 'artist', or 'created_at'

        Returns:
            {
                "query": str,
                "found": int,
                "page": int,
                "per_page": int,
                "songs": [
                    {
                        "id": str,
                        "title": str,
                        "artist_name": str,
                        "album_name": str,
                        "language": str,
                        "genres": [str],
                        "isrc": str,
                        "youtube_video_id": str,
                        "duration_seconds": int,
                        "artwork_url": str
                    }
                ],
                "facets": {
                    "language": [{"value": str, "count": int}],
                    "genres": [{"value": str, "count": int}],
                    "has_youtube": [{"value": str, "count": int}]
                }
            }
        """
        params = {"q": query, "page": page, "per_page": per_page}
        if language:
            params["language"] = language
        if genre:
            params["genre"] = genre
        if has_youtube is not None:
            params["has_youtube"] = has_youtube
        if sort_by:
            params["sort_by"] = sort_by
        return self._get("/api/search/songs", params)

    def search_artists(
        self,
        query: str = "",
        page: int = 1,
        per_page: int = 20
    ) -> dict:
        """
        Search for artists.

        Args:
            query: Artist name search query
            page: Page number
            per_page: Results per page

        Returns:
            {
                "query": str,
                "found": int,
                "artists": [
                    {
                        "artist_name": str,
                        "song_count": int,
                        "sample_artwork": str
                    }
                ]
            }
        """
        return self._get("/api/search/artists", {
            "q": query,
            "page": page,
            "per_page": per_page
        })

    def suggest(self, prefix: str, limit: int = 5) -> List[dict]:
        """
        Get autocomplete suggestions.

        Args:
            prefix: Search prefix (min 2 chars)
            limit: Max suggestions (max 10)

        Returns:
            [
                {
                    "id": str,
                    "title": str,
                    "artist_name": str,
                    "display": str,  # "Title - Artist"
                    "artwork_url": str,
                    "youtube_video_id": str
                }
            ]
        """
        result = self._get("/api/search/suggest", {"q": prefix, "limit": limit})
        return result.get("suggestions", [])

    def get_facets(self) -> dict:
        """
        Get available filter values with counts.

        Returns:
            {
                "language": [{"value": "en", "count": 45000}, ...],
                "genres": [{"value": "Pop", "count": 25000}, ...],
                "has_youtube": [{"value": "true", "count": 80000}, ...]
            }
        """
        return self._get("/api/search/facets")

    def get_search_stats(self) -> dict:
        """
        Get search index statistics.

        Returns:
            {
                "status": "healthy",
                "collection": "conductor_songs",
                "num_documents": 100000,
                "typesense_available": true
            }
        """
        return self._get("/api/search/stats")

    # ==================== CHARTS ====================

    def get_chart(self, region: str = "india", limit: int = 50) -> dict:
        """
        Get aggregated chart from multiple platforms.

        Args:
            region: Region code ('india', 'us', 'global')
            limit: Max songs (1-200)

        Returns:
            {
                "chart_id": str,
                "region": str,
                "week": str,  # "2025-W52"
                "sources": ["youtube_music", "apple_music", "spotify", "billboard"],
                "songs": [
                    {
                        "rank": int,
                        "title": str,
                        "artist": str,
                        "score": float,
                        "platforms_count": int,
                        "platform_ranks": {
                            "youtube_music": int or null,
                            "apple_music": int or null,
                            "spotify": int or null,
                            "billboard": int or null
                        },
                        "isrc": str,
                        "song_id": str
                    }
                ]
            }
        """
        return self._get("/api/charts/aggregated", {"region": region, "limit": limit})

    def get_multi_platform_songs(
        self,
        region: str = "india",
        min_platforms: int = 2
    ) -> List[dict]:
        """
        Get songs appearing on multiple platforms.

        These are the most reliable trending indicators.

        Args:
            region: Region code
            min_platforms: Minimum number of platforms (2-4)

        Returns:
            List of songs appearing on min_platforms or more platforms
        """
        result = self._get("/api/charts/multi-platform", {
            "region": region,
            "min_platforms": min_platforms
        })
        return result.get("songs", [])

    def get_source_chart(
        self,
        source: str,
        region: str = "india",
        limit: int = 50
    ) -> dict:
        """
        Get chart from a single source.

        Args:
            source: 'youtube_music', 'apple_music', 'spotify', or 'billboard'
            region: Region code
            limit: Max songs

        Returns:
            Raw chart data from the specified source
        """
        return self._get(f"/api/charts/source/{source}", {
            "region": region,
            "limit": limit
        })

    # ==================== PLAYLISTS ====================

    def get_playlists(self, playlist_type: str = None) -> List[dict]:
        """
        Get all playlists.

        Args:
            playlist_type: Filter by 'language', 'genre', or 'mood'

        Returns:
            [
                {
                    "id": str,
                    "slug": str,
                    "name": str,
                    "description": str,
                    "type": str,
                    "category": str,
                    "total_tracks": int,
                    "artwork": {"primary": str, "fallback": str, "color": str}
                }
            ]
        """
        params = {"type": playlist_type} if playlist_type else {}
        result = self._get("/api/playlists", params)
        return result.get("playlists", [])

    def get_playlist(self, slug: str) -> dict:
        """
        Get playlist with tracks.

        Available slugs:
        - Language: hindi-hits, english-hits, tamil-hits, telugu-hits,
                   punjabi-hits, spanish-hits, korean-hits, japanese-hits
        - Genre: hip-hop-rap, pop-hits, rock-classics, electronic-dance,
                rnb-soul, latin-vibes, jazz-classics, classical-music,
                world-music, alternative-indie
        - Mood: chill-vibes, workout-energy, party-mode, focus-study

        Args:
            slug: Playlist slug

        Returns:
            {
                "id": str,
                "slug": str,
                "name": str,
                "description": str,
                "type": str,
                "category": str,
                "artwork": {...},
                "tracks": [
                    {
                        "position": int,
                        "song_id": str,
                        "title": str,
                        "artist": str,
                        "youtube_id": str,
                        "artwork_url": str,
                        "duration_ms": int
                    }
                ],
                "total_tracks": int,
                "total_duration_ms": int
            }
        """
        return self._get(f"/api/playlists/{slug}")

    # ==================== HELPERS ====================

    @staticmethod
    def get_youtube_url(song: dict) -> Optional[str]:
        """
        Get YouTube Music URL for a song.

        Args:
            song: Song dict with youtube_video_id field

        Returns:
            YouTube Music URL or None
        """
        video_id = song.get("youtube_video_id") or song.get("youtube_id")
        if video_id:
            return f"https://music.youtube.com/watch?v={video_id}"
        return None

    @staticmethod
    def get_youtube_embed_url(song: dict) -> Optional[str]:
        """
        Get YouTube embed URL for a song.

        Args:
            song: Song dict with youtube_video_id field

        Returns:
            YouTube embed URL or None
        """
        video_id = song.get("youtube_video_id") or song.get("youtube_id")
        if video_id:
            return f"https://www.youtube.com/embed/{video_id}"
        return None


# ==================== EXAMPLE USAGE ====================

if __name__ == "__main__":
    client = MusicConductorClient()

    # Test connection
    print("=== API Status ===")
    stats = client.get_search_stats()
    print(f"Status: {stats['status']}")
    print(f"Songs indexed: {stats['num_documents']:,}")

    # Search songs
    print("\n=== Search: 'arijit' ===")
    results = client.search_songs("arijit", has_youtube=True, per_page=5)
    print(f"Found: {results['found']} songs")
    for song in results["songs"]:
        url = client.get_youtube_url(song)
        print(f"  {song['title']} - {song['artist_name']}")
        if url:
            print(f"    {url}")

    # Autocomplete
    print("\n=== Autocomplete: 'sha' ===")
    suggestions = client.suggest("sha", limit=5)
    for s in suggestions:
        print(f"  {s['display']}")

    # Get chart
    print("\n=== India Chart ===")
    chart = client.get_chart(region="india", limit=5)
    print(f"Week: {chart.get('week', 'N/A')}")
    for song in chart.get("songs", [])[:5]:
        print(f"  #{song['rank']} {song['title']} - {song['artist']}")

    # Get playlist
    print("\n=== Hip-Hop Playlist ===")
    playlist = client.get_playlist("hip-hop-rap")
    print(f"{playlist['name']}: {playlist['total_tracks']} tracks")
    for track in playlist["tracks"][:5]:
        url = client.get_youtube_url(track)
        print(f"  {track['position']}. {track['title']} - {track['artist']}")
        if url:
            print(f"       {url}")
