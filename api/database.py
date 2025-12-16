"""
MongoDB Database Connection for TLDR Music API
Uses Motor (async MongoDB driver)
"""

import os
from typing import Optional, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import DESCENDING
from dotenv import load_dotenv
import re
import asyncio

# Load environment variables from .env file
load_dotenv()


# Global reference to OG worker (set by main.py after startup)
_og_worker_ref = None


def set_og_worker_ref(worker):
    """Set the OG worker reference for triggering regeneration."""
    global _og_worker_ref
    _og_worker_ref = worker


async def _trigger_og_regeneration(playlist_id: str, is_public: bool):
    """Trigger OG image regeneration for a public playlist."""
    if not is_public or _og_worker_ref is None:
        return

    try:
        await _og_worker_ref.enqueue(playlist_id)
    except Exception as e:
        print(f"Failed to enqueue OG regeneration for {playlist_id}: {e}")


class Database:
    """Async MongoDB database handler."""

    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db = None

    async def connect(self):
        """Connect to MongoDB."""
        # Get MongoDB URI from environment variable
        mongo_uri = os.environ.get(
            "MONGODB_URI",
            "mongodb://localhost:27017"  # Default for local development
        )
        db_name = os.environ.get("MONGODB_DB", "tldrmusic")

        self.client = AsyncIOMotorClient(mongo_uri)
        self.db = self.client[db_name]

        # Create indexes for better query performance
        await self._create_indexes()

        print(f"Connected to MongoDB: {db_name}")

    async def disconnect(self):
        """Disconnect from MongoDB."""
        if self.client:
            self.client.close()
            print("Disconnected from MongoDB")

    async def _create_indexes(self):
        """Create necessary indexes for efficient queries."""
        # Charts collection - index by week
        await self.db.charts.create_index("week", unique=True)

        # Songs collection - text index for search
        await self.db.songs.create_index([
            ("title", "text"),
            ("artist", "text")
        ])
        await self.db.songs.create_index("week")

        # YouTube cache - index by cache_key
        await self.db.youtube_cache.create_index("cache_key", unique=True)

        # Song metadata cache - index by cache_key
        await self.db.song_metadata.create_index("cache_key", unique=True)

        # Users collection - indexes for auth
        await self.db.users.create_index("google_id", unique=True)
        await self.db.users.create_index("email", unique=True)

        # Playlists collection - indexes for queries
        await self.db.playlists.create_index("owner_id")
        await self.db.playlists.create_index([("is_public", 1), ("follower_count", -1)])
        await self.db.playlists.create_index([("is_public", 1), ("created_at", -1)])
        await self.db.playlists.create_index([("is_public", 1), ("weekly_plays", -1)])
        await self.db.playlists.create_index("followers")
        await self.db.playlists.create_index([
            ("name", "text"),
            ("songs.title", "text"),
            ("songs.artist", "text")
        ])

    # ============================================================
    # CHART OPERATIONS
    # ============================================================

    async def get_current_chart(self) -> Optional[Dict]:
        """Get the most recent chart."""
        chart = await self.db.charts.find_one(
            {},
            sort=[("week", DESCENDING)]
        )
        if chart:
            chart.pop("_id", None)
        return chart

    async def get_chart_by_week(self, week: str) -> Optional[Dict]:
        """Get chart by week identifier (e.g., 2025-W50)."""
        chart = await self.db.charts.find_one({"week": week})
        if chart:
            chart.pop("_id", None)
        return chart

    async def get_available_weeks(self) -> List[str]:
        """Get list of all available chart weeks, most recent first."""
        cursor = self.db.charts.find(
            {},
            {"week": 1, "_id": 0}
        ).sort("week", DESCENDING)

        weeks = []
        async for doc in cursor:
            weeks.append(doc["week"])
        return weeks

    async def save_chart(self, chart_data: Dict) -> bool:
        """Save or update a chart with rank change tracking."""
        week = chart_data.get("week")
        if not week:
            return False

        # Get previous chart for rank comparison
        previous_chart = await self.get_current_chart()

        # Calculate rank changes for main chart
        if previous_chart and "chart" in previous_chart:
            chart_data = self._calculate_rank_changes(chart_data, previous_chart)

        # Upsert chart document
        await self.db.charts.update_one(
            {"week": week},
            {"$set": chart_data},
            upsert=True
        )

        # Also save individual songs for search indexing
        await self._index_songs(chart_data)

        return True

    def _calculate_rank_changes(self, new_chart: Dict, previous_chart: Dict) -> Dict:
        """Calculate rank changes by comparing with previous chart."""
        # Build lookup of previous positions by title+artist
        prev_positions = {}
        for song in previous_chart.get("chart", []):
            key = self._song_key(song.get("title", ""), song.get("artist", ""))
            prev_positions[key] = song.get("rank", 0)

        # Add rank_change to each song in new chart
        for song in new_chart.get("chart", []):
            key = self._song_key(song.get("title", ""), song.get("artist", ""))
            current_rank = song.get("rank", 0)

            if key in prev_positions:
                prev_rank = prev_positions[key]
                # Positive change = moved up (lower rank number is better)
                song["rank_change"] = prev_rank - current_rank
                song["previous_rank"] = prev_rank
                song["is_new"] = False
            else:
                # New entry to the chart
                song["rank_change"] = 0
                song["previous_rank"] = None
                song["is_new"] = True

        # Also calculate for regional charts
        for region_key, region_data in new_chart.get("regional", {}).items():
            prev_region = previous_chart.get("regional", {}).get(region_key, {})
            prev_region_positions = {}

            for song in prev_region.get("songs", []):
                key = self._song_key(song.get("title", ""), song.get("artist", ""))
                prev_region_positions[key] = song.get("rank", 0)

            for song in region_data.get("songs", []):
                key = self._song_key(song.get("title", ""), song.get("artist", ""))
                current_rank = song.get("rank", 0)

                if key in prev_region_positions:
                    prev_rank = prev_region_positions[key]
                    song["rank_change"] = prev_rank - current_rank
                    song["previous_rank"] = prev_rank
                    song["is_new"] = False
                else:
                    song["rank_change"] = 0
                    song["previous_rank"] = None
                    song["is_new"] = True

        return new_chart

    def _song_key(self, title: str, artist: str) -> str:
        """Create a normalized key for song matching."""
        # Normalize: lowercase, remove special chars, collapse whitespace
        import unicodedata
        def normalize(s):
            s = s.lower().strip()
            s = unicodedata.normalize('NFKD', s)
            s = re.sub(r'[^\w\s]', '', s)
            s = re.sub(r'\s+', ' ', s)
            return s
        return f"{normalize(title)}|{normalize(artist)}"

    async def delete_chart(self, week: str) -> bool:
        """Delete a chart by week."""
        result = await self.db.charts.delete_one({"week": week})
        # Also remove indexed songs for this week
        await self.db.songs.delete_many({"week": week})
        return result.deleted_count > 0

    async def _index_songs(self, chart_data: Dict):
        """Index individual songs for search functionality."""
        week = chart_data.get("week")
        songs_to_insert = []

        # Main chart songs
        for song in chart_data.get("chart", []):
            songs_to_insert.append({
                "week": week,
                "source": "main",
                "region": None,
                **song
            })

        # Regional songs
        for region_key, region_data in chart_data.get("regional", {}).items():
            for song in region_data.get("songs", []):
                songs_to_insert.append({
                    "week": week,
                    "source": "regional",
                    "region": region_key,
                    **song
                })

        # Remove old songs for this week and insert new ones
        if songs_to_insert:
            await self.db.songs.delete_many({"week": week})
            await self.db.songs.insert_many(songs_to_insert)

    # ============================================================
    # SEARCH OPERATIONS
    # ============================================================

    async def search_songs(
        self,
        query: str,
        limit: int = 20,
        include_regional: bool = True
    ) -> List[Dict]:
        """Search songs by title or artist."""
        # Build search filter
        search_filter = {
            "$or": [
                {"title": {"$regex": query, "$options": "i"}},
                {"artist": {"$regex": query, "$options": "i"}}
            ]
        }

        if not include_regional:
            search_filter["source"] = "main"

        cursor = self.db.songs.find(
            search_filter,
            {"_id": 0}
        ).limit(limit).sort("week", DESCENDING)

        results = []
        async for song in cursor:
            results.append({
                "title": song.get("title"),
                "artist": song.get("artist"),
                "rank": song.get("rank"),
                "week": song.get("week"),
                "source": song.get("region") or "main",
                "youtube_video_id": song.get("youtube_video_id"),
                "artwork_url": song.get("artwork_url")
            })

        return results

    async def get_song_by_id(self, song_id: str) -> Optional[Dict]:
        """Get a song by MongoDB _id."""
        from bson import ObjectId
        try:
            song = await self.db.songs.find_one({"_id": ObjectId(song_id)})
            if song:
                song["_id"] = str(song["_id"])
                return {
                    "song": song,
                    "week": song.get("week"),
                    "source": song.get("source", "main"),
                    "region": song.get("region")
                }
        except:
            pass
        return None

    # ============================================================
    # REGIONAL OPERATIONS
    # ============================================================

    async def get_regional_charts(self) -> Optional[Dict]:
        """Get all regional charts from the current week."""
        chart = await self.get_current_chart()
        if chart:
            return chart.get("regional", {})
        return None

    async def get_regional_by_name(self, region: str) -> Optional[Dict]:
        """Get a specific regional chart."""
        chart = await self.get_current_chart()
        if chart and "regional" in chart:
            return chart["regional"].get(region)
        return None

    # ============================================================
    # GLOBAL OPERATIONS
    # ============================================================

    async def get_global_chart(self) -> Optional[list]:
        """Get the consolidated global Top 25 chart."""
        chart = await self.get_current_chart()
        if chart:
            return chart.get("global_chart", [])
        return None

    # ============================================================
    # YOUTUBE CACHE OPERATIONS
    # ============================================================

    async def get_youtube_cache(self, title: str, artist: str) -> Optional[Dict]:
        """Get cached YouTube data for a song."""
        cache_key = self._song_key(title, artist)
        doc = await self.db.youtube_cache.find_one({"cache_key": cache_key})
        if doc:
            doc.pop("_id", None)
            return doc
        return None

    async def save_youtube_cache(self, title: str, artist: str, data: Dict) -> bool:
        """Save YouTube data to cache."""
        cache_key = self._song_key(title, artist)
        from datetime import datetime
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
        cursor = self.db.youtube_cache.find({}, {"_id": 0})
        cache = {}
        async for doc in cursor:
            cache[doc["cache_key"]] = doc
        return cache

    # ============================================================
    # SONG METADATA CACHE OPERATIONS
    # ============================================================

    async def get_song_metadata(self, title: str, artist: str) -> Optional[Dict]:
        """Get cached song metadata (artwork, lyrics, youtube, etc.)."""
        cache_key = self._song_key(title, artist)
        doc = await self.db.song_metadata.find_one({"cache_key": cache_key})
        if doc:
            doc.pop("_id", None)
            return doc
        return None

    async def save_song_metadata(self, title: str, artist: str, data: Dict) -> bool:
        """Save song metadata to cache."""
        cache_key = self._song_key(title, artist)
        from datetime import datetime
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
        cursor = self.db.song_metadata.find({}, {"_id": 0})
        cache = {}
        async for doc in cursor:
            cache[doc["cache_key"]] = doc
        return cache

    # ============================================================
    # USER OPERATIONS
    # ============================================================

    async def create_user_indexes(self):
        """Create indexes for users collection."""
        await self.db.users.create_index("google_id", unique=True)
        await self.db.users.create_index("email", unique=True)

    async def get_user_by_google_id(self, google_id: str) -> Optional[Dict]:
        """Get user by Google ID."""
        user = await self.db.users.find_one({"google_id": google_id})
        if user:
            user["_id"] = str(user["_id"])
        return user

    async def get_user_by_id(self, user_id: str) -> Optional[Dict]:
        """Get user by MongoDB ObjectId."""
        from bson import ObjectId
        try:
            user = await self.db.users.find_one({"_id": ObjectId(user_id)})
            if user:
                user["_id"] = str(user["_id"])
            return user
        except:
            return None

    async def get_user_by_email(self, email: str) -> Optional[Dict]:
        """Get user by email."""
        user = await self.db.users.find_one({"email": email})
        if user:
            user["_id"] = str(user["_id"])
        return user

    async def create_user(self, google_data: Dict, local_data: Optional[Dict] = None) -> Dict:
        """
        Create new user from Google OAuth data.

        Args:
            google_data: Dict with google_id, email, name, picture
            local_data: Optional dict with favorites, history, queue, preferences

        Returns:
            Created user document with _id as string
        """
        from datetime import datetime

        user_doc = {
            "google_id": google_data["google_id"],
            "email": google_data["email"],
            "name": google_data["name"],
            "picture": google_data.get("picture", ""),
            "favorites": local_data.get("favorites", []) if local_data else [],
            "history": local_data.get("history", []) if local_data else [],
            "queue": local_data.get("queue", []) if local_data else [],
            "preferences": local_data.get("preferences", {"shuffle": False, "repeat": "off"}) if local_data else {"shuffle": False, "repeat": "off"},
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "last_login": datetime.utcnow()
        }

        result = await self.db.users.insert_one(user_doc)
        user_doc["_id"] = str(result.inserted_id)
        return user_doc

    async def update_user_login(self, user_id: str) -> bool:
        """Update last login timestamp."""
        from bson import ObjectId
        from datetime import datetime

        result = await self.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"last_login": datetime.utcnow(), "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0

    async def update_user_profile(self, user_id: str, updates: Dict) -> bool:
        """Update user profile fields (name, picture)."""
        from bson import ObjectId
        from datetime import datetime

        allowed_fields = {"name", "picture"}
        filtered = {k: v for k, v in updates.items() if k in allowed_fields}
        filtered["updated_at"] = datetime.utcnow()

        result = await self.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": filtered}
        )
        return result.modified_count > 0

    async def update_user_favorites(self, user_id: str, favorites: List[Dict]) -> bool:
        """Update user's favorites."""
        from bson import ObjectId
        from datetime import datetime

        result = await self.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"favorites": favorites, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0

    async def update_user_history(self, user_id: str, history: List[Dict]) -> bool:
        """Update user's play history (max 50 items)."""
        from bson import ObjectId
        from datetime import datetime

        # Ensure max 50 items
        history = history[:50]

        result = await self.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"history": history, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0

    async def update_user_queue(self, user_id: str, queue: List[Dict]) -> bool:
        """Update user's queue."""
        from bson import ObjectId
        from datetime import datetime

        result = await self.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"queue": queue, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0

    async def update_user_preferences(self, user_id: str, preferences: Dict) -> bool:
        """Update user's playback preferences."""
        from bson import ObjectId
        from datetime import datetime

        result = await self.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"preferences": preferences, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0

    async def delete_user(self, user_id: str) -> bool:
        """Delete a user account."""
        from bson import ObjectId

        result = await self.db.users.delete_one({"_id": ObjectId(user_id)})
        return result.deleted_count > 0

    # ============================================================
    # USERNAME OPERATIONS
    # ============================================================

    async def get_user_by_username(self, username: str) -> Optional[Dict]:
        """Get a user by their username (case-insensitive)."""
        user = await self.db.users.find_one({"username": username.lower()})
        if user:
            user["id"] = str(user["_id"])
            del user["_id"]
        return user

    async def check_username_available(self, username: str, exclude_user_id: Optional[str] = None) -> bool:
        """Check if a username is available (case-insensitive)."""
        from bson import ObjectId

        query = {"username": username.lower()}
        if exclude_user_id:
            query["_id"] = {"$ne": ObjectId(exclude_user_id)}

        existing = await self.db.users.find_one(query)
        return existing is None

    async def update_user_username(self, user_id: str, username: str) -> bool:
        """Set or update a user's username."""
        from bson import ObjectId
        from datetime import datetime

        result = await self.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"username": username.lower(), "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0

    async def count_public_playlists(self, user_id: str) -> int:
        """Count how many public playlists a user has."""
        from bson import ObjectId
        return await self.db.playlists.count_documents({
            "owner_id": ObjectId(user_id),
            "is_public": True
        })

    async def get_user_public_playlists(
        self,
        owner_id: str,
        limit: int = 20,
        offset: int = 0,
        viewer_id: Optional[str] = None
    ) -> List[Dict]:
        """Get a user's public playlists."""
        from bson import ObjectId

        cursor = self.db.playlists.find({
            "owner_id": ObjectId(owner_id),
            "is_public": True
        }).sort("created_at", -1).skip(offset).limit(limit)

        playlists = []
        async for playlist in cursor:
            playlist["id"] = str(playlist["_id"])
            del playlist["_id"]
            playlist["owner_id"] = str(playlist["owner_id"])

            # Add viewer-specific data
            if viewer_id:
                playlist["is_following"] = viewer_id in [str(f) for f in playlist.get("followers", [])]
            else:
                playlist["is_following"] = False

            playlists.append(playlist)

        return playlists

    # ============================================================
    # PLAYLIST OPERATIONS
    # ============================================================

    async def count_user_playlists(self, user_id: str) -> int:
        """Count how many playlists a user owns."""
        from bson import ObjectId
        return await self.db.playlists.count_documents({"owner_id": ObjectId(user_id)})

    async def create_playlist(self, user_id: str, name: str, description: str = "") -> Dict:
        """Create a new playlist."""
        from bson import ObjectId
        from datetime import datetime

        now = int(datetime.utcnow().timestamp() * 1000)

        playlist_doc = {
            "name": name,
            "description": description,
            "owner_id": ObjectId(user_id),
            "is_public": False,
            "published_at": None,
            "cover_urls": [],
            "songs": [],
            "song_count": 0,
            "follower_count": 0,
            "followers": [],
            "created_at": now,
            "updated_at": now,
            "play_count": 0,
            "weekly_plays": 0
        }

        result = await self.db.playlists.insert_one(playlist_doc)
        playlist_doc["_id"] = str(result.inserted_id)
        playlist_doc["owner_id"] = user_id
        return playlist_doc

    async def get_playlist_by_id(self, playlist_id: str, user_id: Optional[str] = None) -> Optional[Dict]:
        """Get a playlist by ID with ownership/following info."""
        from bson import ObjectId

        try:
            playlist = await self.db.playlists.find_one({"_id": ObjectId(playlist_id)})
            if not playlist:
                return None

            playlist["_id"] = str(playlist["_id"])
            playlist["owner_id"] = str(playlist["owner_id"])

            # Set ownership and following status
            if user_id:
                user_oid = ObjectId(user_id)
                playlist["is_owner"] = playlist["owner_id"] == user_id
                playlist["is_following"] = user_oid in playlist.get("followers", [])
            else:
                playlist["is_owner"] = False
                playlist["is_following"] = False

            # Convert follower ObjectIds to strings for serialization
            playlist["followers"] = [str(f) for f in playlist.get("followers", [])]

            return playlist
        except:
            return None

    async def get_user_playlists(self, user_id: str) -> List[Dict]:
        """Get all playlists owned by a user with full song data."""
        from bson import ObjectId

        cursor = self.db.playlists.find(
            {"owner_id": ObjectId(user_id)}
        ).sort("created_at", DESCENDING)

        playlists = []
        async for playlist in cursor:
            playlist["id"] = str(playlist.pop("_id"))
            playlist["owner_id"] = str(playlist["owner_id"])
            playlist["is_owner"] = True
            playlist["is_following"] = False
            playlist["followers"] = []  # Don't need full list for summary
            # Ensure songs array exists
            if "songs" not in playlist:
                playlist["songs"] = []
            if "song_count" not in playlist:
                playlist["song_count"] = len(playlist["songs"])
            if "cover_urls" not in playlist:
                playlist["cover_urls"] = [s.get("artwork") for s in playlist["songs"][:4] if s.get("artwork")]
            playlists.append(playlist)

        return playlists

    async def sync_user_playlists(self, user_id: str, client_playlists: List) -> List[Dict]:
        """
        Sync playlists from client to server.

        - Client playlists with non-ObjectId IDs are created as new
        - Client playlists with valid ObjectIds are updated if owned by user
        - Returns list of synced playlists in PlaylistSummary format
        """
        from bson import ObjectId
        from bson.errors import InvalidId
        from datetime import datetime

        synced = []
        now = int(datetime.utcnow().timestamp() * 1000)

        for client_playlist in client_playlists:
            playlist_id = client_playlist.id
            is_valid_oid = False

            # Check if it's a valid MongoDB ObjectId
            try:
                ObjectId(playlist_id)
                is_valid_oid = True
            except (InvalidId, TypeError):
                is_valid_oid = False

            if is_valid_oid:
                # Try to update existing playlist if owned by user
                existing = await self.db.playlists.find_one({
                    "_id": ObjectId(playlist_id),
                    "owner_id": ObjectId(user_id)
                })

                if existing:
                    # Update existing playlist
                    songs = [s.model_dump() for s in client_playlist.songs]
                    cover_urls = [s.get("artwork") for s in songs[:4] if s.get("artwork")]

                    await self.db.playlists.update_one(
                        {"_id": ObjectId(playlist_id)},
                        {"$set": {
                            "name": client_playlist.name,
                            "description": client_playlist.description,
                            "songs": songs,
                            "song_count": len(songs),
                            "cover_urls": cover_urls,
                            "updated_at": now
                        }}
                    )

                    synced.append({
                        "id": playlist_id,
                        "name": client_playlist.name,
                        "description": client_playlist.description,
                        "owner_id": user_id,
                        "is_public": existing.get("is_public", False),
                        "cover_urls": cover_urls,
                        "songs": songs,
                        "song_count": len(songs),
                        "follower_count": existing.get("follower_count", 0),
                        "is_following": False,
                        "is_owner": True,
                        "created_at": existing.get("created_at", now),
                        "updated_at": now
                    })
                    continue

            # Create new playlist (either invalid OID or not found/not owned)
            songs = [s.model_dump() for s in client_playlist.songs]
            cover_urls = [s.get("artwork") for s in songs[:4] if s.get("artwork")]

            playlist_doc = {
                "name": client_playlist.name,
                "description": client_playlist.description,
                "owner_id": ObjectId(user_id),
                "is_public": False,
                "published_at": None,
                "cover_urls": cover_urls,
                "songs": songs,
                "song_count": len(songs),
                "follower_count": 0,
                "followers": [],
                "created_at": client_playlist.created_at or now,
                "updated_at": now,
                "play_count": 0,
                "weekly_plays": 0
            }

            result = await self.db.playlists.insert_one(playlist_doc)
            new_id = str(result.inserted_id)

            synced.append({
                "id": new_id,
                "name": client_playlist.name,
                "description": client_playlist.description,
                "owner_id": user_id,
                "is_public": False,
                "cover_urls": cover_urls,
                "songs": songs,
                "song_count": len(songs),
                "follower_count": 0,
                "is_following": False,
                "is_owner": True,
                "created_at": client_playlist.created_at or now,
                "updated_at": now
            })

        return synced

    async def get_followed_playlists(self, user_id: str) -> List[Dict]:
        """Get playlists that a user follows."""
        from bson import ObjectId

        cursor = self.db.playlists.find(
            {"followers": ObjectId(user_id), "is_public": True},
            {"songs": 0}
        ).sort("updated_at", DESCENDING)

        playlists = []
        async for playlist in cursor:
            playlist["_id"] = str(playlist["_id"])
            playlist["owner_id"] = str(playlist["owner_id"])
            playlist["is_owner"] = str(playlist["owner_id"]) == user_id
            playlist["is_following"] = True
            playlist["followers"] = []
            playlists.append(playlist)

        return playlists

    async def update_playlist(self, playlist_id: str, updates: Dict) -> bool:
        """Update playlist name/description."""
        from bson import ObjectId
        from datetime import datetime

        allowed_fields = {"name", "description"}
        filtered = {k: v for k, v in updates.items() if k in allowed_fields and v is not None}
        if not filtered:
            return False

        filtered["updated_at"] = int(datetime.utcnow().timestamp() * 1000)

        result = await self.db.playlists.update_one(
            {"_id": ObjectId(playlist_id)},
            {"$set": filtered}
        )
        return result.modified_count > 0

    async def delete_playlist(self, playlist_id: str) -> bool:
        """Delete a playlist."""
        from bson import ObjectId

        result = await self.db.playlists.delete_one({"_id": ObjectId(playlist_id)})
        return result.deleted_count > 0

    async def publish_playlist(self, playlist_id: str, is_public: bool) -> bool:
        """Publish or unpublish a playlist."""
        from bson import ObjectId
        from datetime import datetime

        now = int(datetime.utcnow().timestamp() * 1000)
        update = {
            "is_public": is_public,
            "updated_at": now
        }

        if is_public:
            update["published_at"] = now
        else:
            update["published_at"] = None

        result = await self.db.playlists.update_one(
            {"_id": ObjectId(playlist_id)},
            {"$set": update}
        )

        # Trigger OG image regeneration when published
        if result.modified_count > 0 and is_public:
            await _trigger_og_regeneration(playlist_id, is_public)

        return result.modified_count > 0

    def _regenerate_cover_urls(self, songs: List[Dict]) -> List[str]:
        """Generate cover URLs from first 4 songs with artwork."""
        covers = []
        for song in songs:
            if song.get("artwork") and len(covers) < 4:
                covers.append(song["artwork"])
        return covers

    async def add_song_to_playlist(self, playlist_id: str, song: Dict) -> Optional[Dict]:
        """Add a song to a playlist."""
        from bson import ObjectId
        from datetime import datetime

        playlist = await self.db.playlists.find_one({"_id": ObjectId(playlist_id)})
        if not playlist:
            return None

        # Check song limit
        if len(playlist.get("songs", [])) >= 100:
            return None

        now = int(datetime.utcnow().timestamp() * 1000)

        # Create song entry
        new_song = {
            "title": song.get("title"),
            "artist": song.get("artist"),
            "videoId": song.get("videoId"),
            "artwork": song.get("artwork"),
            "added_at": now,
            "order": len(playlist.get("songs", []))
        }

        # Add song and update metadata
        songs = playlist.get("songs", []) + [new_song]
        cover_urls = self._regenerate_cover_urls(songs)

        await self.db.playlists.update_one(
            {"_id": ObjectId(playlist_id)},
            {
                "$push": {"songs": new_song},
                "$inc": {"song_count": 1},
                "$set": {
                    "cover_urls": cover_urls,
                    "updated_at": now
                }
            }
        )

        # Trigger OG image regeneration for public playlists
        await _trigger_og_regeneration(playlist_id, playlist.get("is_public", False))

        return new_song

    async def remove_songs_from_playlist(self, playlist_id: str, indexes: List[int]) -> bool:
        """Remove songs from a playlist by their indexes."""
        from bson import ObjectId
        from datetime import datetime

        playlist = await self.db.playlists.find_one({"_id": ObjectId(playlist_id)})
        if not playlist:
            return False

        songs = playlist.get("songs", [])
        # Remove songs at specified indexes (in reverse order to maintain index validity)
        new_songs = [song for i, song in enumerate(songs) if i not in indexes]

        # Reindex order
        for i, song in enumerate(new_songs):
            song["order"] = i

        cover_urls = self._regenerate_cover_urls(new_songs)
        now = int(datetime.utcnow().timestamp() * 1000)

        await self.db.playlists.update_one(
            {"_id": ObjectId(playlist_id)},
            {"$set": {
                "songs": new_songs,
                "song_count": len(new_songs),
                "cover_urls": cover_urls,
                "updated_at": now
            }}
        )

        # Trigger OG image regeneration for public playlists
        await _trigger_og_regeneration(playlist_id, playlist.get("is_public", False))

        return True

    async def reorder_songs_in_playlist(self, playlist_id: str, new_order: List[int]) -> bool:
        """Reorder songs in a playlist."""
        from bson import ObjectId
        from datetime import datetime

        playlist = await self.db.playlists.find_one({"_id": ObjectId(playlist_id)})
        if not playlist:
            return False

        songs = playlist.get("songs", [])
        if len(new_order) != len(songs):
            return False

        # Reorder songs based on new_order
        try:
            reordered = [songs[i] for i in new_order]
            for i, song in enumerate(reordered):
                song["order"] = i
        except IndexError:
            return False

        cover_urls = self._regenerate_cover_urls(reordered)
        now = int(datetime.utcnow().timestamp() * 1000)

        await self.db.playlists.update_one(
            {"_id": ObjectId(playlist_id)},
            {"$set": {
                "songs": reordered,
                "cover_urls": cover_urls,
                "updated_at": now
            }}
        )

        # Trigger OG image regeneration for public playlists
        await _trigger_og_regeneration(playlist_id, playlist.get("is_public", False))

        return True

    async def follow_playlist(self, playlist_id: str, user_id: str) -> bool:
        """Follow a public playlist."""
        from bson import ObjectId

        user_oid = ObjectId(user_id)

        result = await self.db.playlists.update_one(
            {"_id": ObjectId(playlist_id), "is_public": True, "followers": {"$ne": user_oid}},
            {
                "$push": {"followers": user_oid},
                "$inc": {"follower_count": 1}
            }
        )
        return result.modified_count > 0

    async def unfollow_playlist(self, playlist_id: str, user_id: str) -> bool:
        """Unfollow a playlist."""
        from bson import ObjectId

        user_oid = ObjectId(user_id)

        result = await self.db.playlists.update_one(
            {"_id": ObjectId(playlist_id), "followers": user_oid},
            {
                "$pull": {"followers": user_oid},
                "$inc": {"follower_count": -1}
            }
        )
        return result.modified_count > 0

    async def increment_playlist_play_count(self, playlist_id: str) -> bool:
        """Increment play count for a playlist."""
        from bson import ObjectId

        result = await self.db.playlists.update_one(
            {"_id": ObjectId(playlist_id)},
            {"$inc": {"play_count": 1, "weekly_plays": 1}}
        )
        return result.modified_count > 0

    # ============================================================
    # PLAYLIST DISCOVERY
    # ============================================================

    async def get_trending_playlists(self, limit: int = 10, user_id: Optional[str] = None) -> List[Dict]:
        """Get trending playlists (by weekly plays)."""
        from bson import ObjectId

        cursor = self.db.playlists.find(
            {"is_public": True},
            {"songs": 0}
        ).sort("weekly_plays", DESCENDING).limit(limit)

        user_oid = ObjectId(user_id) if user_id else None
        playlists = []
        async for playlist in cursor:
            playlist["_id"] = str(playlist["_id"])
            playlist["owner_id"] = str(playlist["owner_id"])
            playlist["is_owner"] = str(playlist["owner_id"]) == user_id if user_id else False
            playlist["is_following"] = user_oid in playlist.get("followers", []) if user_oid else False
            playlist["followers"] = []
            playlists.append(playlist)

        return playlists

    async def get_new_playlists(self, limit: int = 10, user_id: Optional[str] = None) -> List[Dict]:
        """Get newly published playlists."""
        from bson import ObjectId

        cursor = self.db.playlists.find(
            {"is_public": True},
            {"songs": 0}
        ).sort("published_at", DESCENDING).limit(limit)

        user_oid = ObjectId(user_id) if user_id else None
        playlists = []
        async for playlist in cursor:
            playlist["_id"] = str(playlist["_id"])
            playlist["owner_id"] = str(playlist["owner_id"])
            playlist["is_owner"] = str(playlist["owner_id"]) == user_id if user_id else False
            playlist["is_following"] = user_oid in playlist.get("followers", []) if user_oid else False
            playlist["followers"] = []
            playlists.append(playlist)

        return playlists

    async def get_popular_playlists(self, limit: int = 10, user_id: Optional[str] = None) -> List[Dict]:
        """Get popular playlists (by follower count)."""
        from bson import ObjectId

        cursor = self.db.playlists.find(
            {"is_public": True},
            {"songs": 0}
        ).sort("follower_count", DESCENDING).limit(limit)

        user_oid = ObjectId(user_id) if user_id else None
        playlists = []
        async for playlist in cursor:
            playlist["_id"] = str(playlist["_id"])
            playlist["owner_id"] = str(playlist["owner_id"])
            playlist["is_owner"] = str(playlist["owner_id"]) == user_id if user_id else False
            playlist["is_following"] = user_oid in playlist.get("followers", []) if user_oid else False
            playlist["followers"] = []
            playlists.append(playlist)

        return playlists

    async def search_playlists(
        self,
        query: str,
        limit: int = 20,
        offset: int = 0,
        user_id: Optional[str] = None
    ) -> List[Dict]:
        """Search public playlists by name or song."""
        from bson import ObjectId

        cursor = self.db.playlists.find(
            {"is_public": True, "$text": {"$search": query}},
            {"songs": 0, "score": {"$meta": "textScore"}}
        ).sort([("score", {"$meta": "textScore"})]).skip(offset).limit(limit)

        user_oid = ObjectId(user_id) if user_id else None
        playlists = []
        async for playlist in cursor:
            playlist["_id"] = str(playlist["_id"])
            playlist["owner_id"] = str(playlist["owner_id"])
            playlist["is_owner"] = str(playlist["owner_id"]) == user_id if user_id else False
            playlist["is_following"] = user_oid in playlist.get("followers", []) if user_oid else False
            playlist["followers"] = []
            playlist.pop("score", None)
            playlists.append(playlist)

        return playlists

    async def browse_playlists(
        self,
        sort: str = "popular",
        limit: int = 20,
        offset: int = 0,
        user_id: Optional[str] = None
    ) -> List[Dict]:
        """Browse public playlists with sorting."""
        from bson import ObjectId

        sort_field = {
            "popular": ("follower_count", DESCENDING),
            "new": ("published_at", DESCENDING),
            "trending": ("weekly_plays", DESCENDING)
        }.get(sort, ("follower_count", DESCENDING))

        cursor = self.db.playlists.find(
            {"is_public": True},
            {"songs": 0}
        ).sort(*sort_field).skip(offset).limit(limit)

        user_oid = ObjectId(user_id) if user_id else None
        playlists = []
        async for playlist in cursor:
            playlist["_id"] = str(playlist["_id"])
            playlist["owner_id"] = str(playlist["owner_id"])
            playlist["is_owner"] = str(playlist["owner_id"]) == user_id if user_id else False
            playlist["is_following"] = user_oid in playlist.get("followers", []) if user_oid else False
            playlist["followers"] = []
            playlists.append(playlist)

        return playlists

    async def get_playlist_owner(self, owner_id: str) -> Optional[Dict]:
        """Get basic owner info for a playlist."""
        user = await self.get_user_by_id(owner_id)
        if user:
            return {
                "id": user["_id"],
                "name": user["name"],
                "picture": user.get("picture")
            }
        return None
