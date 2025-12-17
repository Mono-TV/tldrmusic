# TLDR Music - YouTube API Integration

import json
import os
from typing import List, Optional, Dict
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from config import (
    YOUTUBE_API_KEY,
    YOUTUBE_MUSIC_TOPIC_ID,
    YOUTUBE_CACHE_FILE,
    DATA_DIR
)
from ranking import ConsolidatedSong


class YouTubeAPI:
    """
    YouTube Data API v3 integration for:
    1. Searching songs and getting video IDs
    2. Getting video view counts
    3. Creating public playlists

    Supports both file-based and MongoDB caching.
    """

    def __init__(self, mongo_cache=None):
        self.api_key = YOUTUBE_API_KEY
        self.youtube = build('youtube', 'v3', developerKey=self.api_key)
        self.mongo_cache = mongo_cache
        self.cache = {}  # Will be loaded async if using MongoDB
        self.api_calls_made = 0
        self.quota_exceeded = False

        # Load file cache if no MongoDB
        if not mongo_cache:
            self.cache = self._load_file_cache()

    def _load_file_cache(self) -> Dict:
        """Load cached YouTube search results from file."""
        cache_path = os.path.join(os.path.dirname(__file__), '..', YOUTUBE_CACHE_FILE)
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}

    def _save_file_cache(self) -> None:
        """Save YouTube search results to file cache."""
        cache_path = os.path.join(os.path.dirname(__file__), '..', YOUTUBE_CACHE_FILE)
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(self.cache, f, indent=2, ensure_ascii=False)

    async def _get_cached(self, cache_key: str) -> Optional[Dict]:
        """Get cached result from MongoDB or file cache."""
        if self.mongo_cache:
            try:
                cached = await self.mongo_cache.db.youtube_cache.find_one({"cache_key": cache_key})
                if cached:
                    return cached.get("data")
            except Exception as e:
                print(f"  [MongoDB Cache] Error reading: {e}")
        return self.cache.get(cache_key)

    async def _set_cached(self, cache_key: str, data: Dict) -> None:
        """Save result to MongoDB or file cache."""
        if self.mongo_cache:
            try:
                await self.mongo_cache.db.youtube_cache.update_one(
                    {"cache_key": cache_key},
                    {"$set": {"cache_key": cache_key, "data": data}},
                    upsert=True
                )
            except Exception as e:
                print(f"  [MongoDB Cache] Error saving: {e}")
        else:
            self.cache[cache_key] = data
            self._save_file_cache()

    def _get_cache_key(self, title: str, artist: str) -> str:
        """Generate cache key for a song."""
        return f"{title.lower()}|{artist.lower()}"

    async def search_song(self, title: str, artist: str) -> Optional[Dict]:
        """
        Search for a song on YouTube and return the top result.

        Uses topic ID /m/04rlf to filter for music content only.
        Limited to 1 result to save API quota.

        Args:
            title: Song title
            artist: Artist name

        Returns:
            Dict with video_id, title, views or None if not found
        """
        cache_key = self._get_cache_key(title, artist)

        # Check cache first (async for MongoDB support)
        cached = await self._get_cached(cache_key)
        if cached:
            print(f"  [Cache] Found: {title} - {artist}")
            return cached

        # Skip API calls if quota exceeded
        if self.quota_exceeded:
            print(f"  [Quota] Skipping: {title} - {artist}")
            return None

        query = f"{title} {artist}"
        print(f"  [API] Searching: {query}")

        try:
            # Search with music topic filter
            search_response = self.youtube.search().list(
                q=query,
                part='snippet',
                maxResults=1,  # Only get top result
                type='video',
                topicId=YOUTUBE_MUSIC_TOPIC_ID,  # Music topic
                relevanceLanguage='en',
                regionCode='IN'
            ).execute()

            self.api_calls_made += 1

            if not search_response.get('items'):
                print(f"  [API] No results for: {query}")
                return None

            video = search_response['items'][0]
            video_id = video['id']['videoId']

            # Get comprehensive video details
            details = self._get_video_details(video_id)

            result = {
                'video_id': video_id,
                'title': video['snippet']['title'],
                'channel': video['snippet']['channelTitle'],
                'views': details['views'],
                'likes': details['likes'],
                'duration': details['duration'],
                'published': details['published'],
            }

            # Cache the result (async for MongoDB support)
            await self._set_cached(cache_key, result)

            print(f"  [API] Found: {result['title']} ({details['views']:,} views, {details['likes']:,} likes)")
            return result

        except HttpError as e:
            error_str = str(e)
            if 'quotaExceeded' in error_str or 'quota' in error_str.lower():
                print(f"  [API] Quota exceeded - skipping remaining songs")
                self.quota_exceeded = True
            else:
                print(f"  [API Error] {e}")
            return None

    def _get_video_details(self, video_id: str) -> Dict:
        """Get comprehensive video details including views, duration, likes, publish date."""
        try:
            video_response = self.youtube.videos().list(
                part='statistics,contentDetails,snippet',
                id=video_id
            ).execute()

            self.api_calls_made += 1

            if video_response.get('items'):
                item = video_response['items'][0]
                stats = item.get('statistics', {})
                content = item.get('contentDetails', {})
                snippet = item.get('snippet', {})

                return {
                    'views': int(stats.get('viewCount', 0)),
                    'likes': int(stats.get('likeCount', 0)),
                    'duration': content.get('duration', ''),  # ISO 8601 format (PT3M45S)
                    'published': snippet.get('publishedAt', '')[:10] if snippet.get('publishedAt') else '',
                }

        except HttpError as e:
            print(f"  [API Error] Getting video details: {e}")

        return {'views': 0, 'likes': 0, 'duration': '', 'published': ''}

    def _get_video_views(self, video_id: str) -> int:
        """Get view count for a video (backwards compatibility)."""
        details = self._get_video_details(video_id)
        return details['views']

    async def enrich_songs_with_youtube_data(self, songs: List[ConsolidatedSong]) -> List[ConsolidatedSong]:
        """
        Search YouTube for each song and add video metadata.

        Args:
            songs: List of consolidated songs

        Returns:
            Same list with YouTube metadata populated:
            - youtube_video_id
            - youtube_views
            - youtube_likes
            - youtube_duration
            - youtube_published
        """
        print("\n" + "=" * 60)
        print("YOUTUBE API: Enriching songs with video data")
        print("=" * 60)

        for i, song in enumerate(songs, 1):
            print(f"\n[{i}/{len(songs)}] {song.canonical_title} - {song.canonical_artist}")

            result = await self.search_song(song.canonical_title, song.canonical_artist)

            if result:
                song.youtube_video_id = result['video_id']
                song.youtube_views = result.get('views', 0)
                song.youtube_likes = result.get('likes', 0)
                song.youtube_duration = result.get('duration', '')
                song.youtube_published = result.get('published', '')
            else:
                print(f"  Warning: Could not find YouTube video")

        print(f"\n[YouTube API] Total API calls made: {self.api_calls_made}")

        # Statistics
        with_video = sum(1 for s in songs if s.youtube_video_id)
        with_likes = sum(1 for s in songs if s.youtube_likes > 0)
        print(f"[YouTube API] Songs with video: {with_video}/{len(songs)}")
        print(f"[YouTube API] Songs with likes data: {with_likes}/{len(songs)}")

        return songs

    def create_playlist(self, title: str, description: str, video_ids: List[str]) -> Optional[str]:
        """
        Create a public YouTube playlist with the given videos.

        NOTE: This requires OAuth2 authentication, not just API key.
        For MVP, we'll generate a playlist URL that can be manually created
        or use an authenticated flow later.

        Args:
            title: Playlist title
            description: Playlist description
            video_ids: List of video IDs to add

        Returns:
            Playlist ID or None
        """
        # For now, generate a "watch later" URL with all videos
        # This creates a playable queue without needing OAuth
        print("\n" + "=" * 50)
        print("YOUTUBE: Generating playlist")
        print("=" * 50)

        if not video_ids:
            print("No videos to add to playlist")
            return None

        # Create a YouTube mix/queue URL
        # Format: https://www.youtube.com/watch_videos?video_ids=id1,id2,id3
        video_ids_str = ','.join(video_ids)
        playlist_url = f"https://www.youtube.com/watch_videos?video_ids={video_ids_str}"

        print(f"Generated playlist URL with {len(video_ids)} videos")
        print(f"URL: {playlist_url}")

        return video_ids_str  # Return comma-separated IDs for iframe embedding

    def get_embed_playlist_url(self, video_ids: List[str]) -> str:
        """
        Generate an embeddable playlist URL for iframe.

        Args:
            video_ids: List of video IDs

        Returns:
            Embeddable URL string
        """
        if not video_ids:
            return ""

        # First video plays, rest are in queue
        first_video = video_ids[0]
        playlist_param = ','.join(video_ids)

        # YouTube embed with playlist
        # Format: https://www.youtube.com/embed/VIDEO_ID?playlist=id1,id2,id3
        embed_url = f"https://www.youtube.com/embed/{first_video}?playlist={playlist_param}&autoplay=0"

        return embed_url


def get_video_ids_from_songs(songs: List[ConsolidatedSong]) -> List[str]:
    """Extract video IDs from enriched songs."""
    return [song.youtube_video_id for song in songs if song.youtube_video_id]
