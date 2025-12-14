# TLDR Music - MongoDB Cache for Scraper
# Provides persistent caching for YouTube data and song metadata

import os
import re
import unicodedata
from typing import Optional, Dict
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient


class MongoCache:
    """MongoDB-based cache for YouTube data and song metadata."""

    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db = None
        self._connected = False

    async def connect(self):
        """Connect to MongoDB."""
        if self._connected:
            return

        mongo_uri = os.environ.get(
            "MONGODB_URI",
            "mongodb://localhost:27017"
        )
        db_name = os.environ.get("MONGODB_DB", "tldrmusic")

        self.client = AsyncIOMotorClient(mongo_uri)
        self.db = self.client[db_name]
        self._connected = True
        print(f"[MongoCache] Connected to MongoDB: {db_name}")

    async def disconnect(self):
        """Disconnect from MongoDB."""
        if self.client:
            self.client.close()
            self._connected = False
            print("[MongoCache] Disconnected from MongoDB")

    def _song_key(self, title: str, artist: str) -> str:
        """Create a normalized key for song matching."""
        def normalize(s):
            s = s.lower().strip()
            s = unicodedata.normalize('NFKD', s)
            s = re.sub(r'[^\w\s]', '', s)
            s = re.sub(r'\s+', ' ', s)
            return s
        return f"{normalize(title)}|{normalize(artist)}"

    # ============================================================
    # YOUTUBE CACHE
    # ============================================================

    async def get_youtube_cache(self, title: str, artist: str) -> Optional[Dict]:
        """Get cached YouTube data for a song."""
        await self.connect()
        cache_key = self._song_key(title, artist)
        doc = await self.db.youtube_cache.find_one({"cache_key": cache_key})
        if doc:
            doc.pop("_id", None)
            return {
                "video_id": doc.get("video_id"),
                "title": doc.get("video_title"),
                "channel": doc.get("channel"),
                "views": doc.get("views", 0)
            }
        return None

    async def save_youtube_cache(self, title: str, artist: str, data: Dict) -> bool:
        """Save YouTube data to cache."""
        await self.connect()
        cache_key = self._song_key(title, artist)
        doc = {
            "cache_key": cache_key,
            "title": title,
            "artist": artist,
            "video_id": data.get("video_id"),
            "views": data.get("views", 0),
            "channel": data.get("channel"),
            "video_title": data.get("title"),
            "cached_at": datetime.utcnow().isoformat() + "Z"
        }
        await self.db.youtube_cache.update_one(
            {"cache_key": cache_key},
            {"$set": doc},
            upsert=True
        )
        return True

    async def get_all_youtube_cache(self) -> Dict[str, Dict]:
        """Get all cached YouTube data as a dictionary."""
        await self.connect()
        cursor = self.db.youtube_cache.find({}, {"_id": 0})
        cache = {}
        async for doc in cursor:
            cache[doc["cache_key"]] = {
                "video_id": doc.get("video_id"),
                "title": doc.get("video_title"),
                "channel": doc.get("channel"),
                "views": doc.get("views", 0)
            }
        return cache

    # ============================================================
    # SONG METADATA CACHE
    # ============================================================

    async def get_song_metadata(self, title: str, artist: str) -> Optional[Dict]:
        """Get cached song metadata."""
        await self.connect()
        cache_key = self._song_key(title, artist)
        doc = await self.db.song_metadata.find_one({"cache_key": cache_key})
        if doc:
            doc.pop("_id", None)
            return doc
        return None

    async def save_song_metadata(self, title: str, artist: str, data: Dict) -> bool:
        """Save song metadata to cache."""
        await self.connect()
        cache_key = self._song_key(title, artist)
        doc = {
            "cache_key": cache_key,
            "title": title,
            "artist": artist,
            "youtube_video_id": data.get("youtube_video_id"),
            "youtube_views": data.get("youtube_views"),
            "artwork_url": data.get("artwork_url"),
            "lyrics_plain": data.get("lyrics_plain"),
            "lyrics_synced": data.get("lyrics_synced"),
            "cached_at": datetime.utcnow().isoformat() + "Z"
        }
        # Only update fields that are not None
        doc = {k: v for k, v in doc.items() if v is not None}

        await self.db.song_metadata.update_one(
            {"cache_key": cache_key},
            {"$set": doc},
            upsert=True
        )
        return True

    async def get_all_song_metadata(self) -> Dict[str, Dict]:
        """Get all cached song metadata as a dictionary."""
        await self.connect()
        cursor = self.db.song_metadata.find({}, {"_id": 0})
        cache = {}
        async for doc in cursor:
            cache[doc["cache_key"]] = doc
        return cache


# Global instance
_cache_instance: Optional[MongoCache] = None


async def get_mongo_cache() -> MongoCache:
    """Get or create the global MongoDB cache instance."""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = MongoCache()
        await _cache_instance.connect()
    return _cache_instance
