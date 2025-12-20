"""
Library Service - User favorites, history, playlists
"""
from typing import List, Optional
from datetime import datetime, timedelta
import uuid
from bson import ObjectId

from ..models import (
    UserLibrary,
    FavoriteEntry,
    HistoryEntry,
    QueueEntry,
    Playlist,
    PlaylistCreate,
    PlaylistUpdate,
    PlaylistSummary,
    PlaylistVisibility,
    PlaySource,
    LibrarySyncRequest,
    LibrarySyncResponse,
)
from ..config import Database
from .song import SongService


class LibraryService:
    """
    Handles user library operations with MongoDB persistence
    """

    # ============== Library Sync ==============

    @classmethod
    async def get_user_library(cls, user_id: str) -> UserLibrary:
        """Get complete user library"""
        favorites = await cls.get_favorites(user_id, limit=100)
        history = await cls.get_history(user_id, limit=50)
        queue = await cls.get_queue(user_id)
        playlists = await cls.get_user_playlists_full(user_id)

        return UserLibrary(
            user_id=user_id,
            favorites=favorites,
            history=history,
            queue=queue,
            playlists=playlists,
        )

    @classmethod
    async def get_user_playlists_full(cls, user_id: str) -> List[Playlist]:
        """Get user's playlists with full details from MongoDB"""
        cursor = Database.playlists().find(
            {"user_id": user_id}
        ).sort("created_at", -1)

        playlists = []
        async for doc in cursor:
            try:
                playlist_id = str(doc.get("_id")) if "_id" in doc and "id" not in doc else doc.get("id", str(doc.get("_id")))

                playlists.append(Playlist(
                    id=playlist_id,
                    user_id=user_id,
                    name=doc.get("name", "Untitled"),
                    description=doc.get("description"),
                    artwork_url=doc.get("cover_image") or doc.get("artwork_url"),
                    visibility=PlaylistVisibility(doc.get("visibility", "private")),
                    song_ids=doc.get("song_ids", []),
                    total_tracks=len(doc.get("song_ids", [])),
                    created_at=doc.get("created_at", datetime.utcnow()),
                    updated_at=doc.get("updated_at", datetime.utcnow()),
                ))
            except Exception:
                continue

        return playlists

    @classmethod
    async def sync_library(
        cls,
        user_id: str,
        request: LibrarySyncRequest
    ) -> LibrarySyncResponse:
        """Sync library from client"""
        # Get current server state
        library = await cls.get_user_library(user_id)
        library.sync_version = request.client_version + 1
        library.last_synced_at = datetime.utcnow()

        return LibrarySyncResponse(
            server_version=library.sync_version,
            library=library,
            conflicts=[],
        )

    # ============== Favorites ==============

    @classmethod
    async def get_favorites(
        cls,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[FavoriteEntry]:
        """Get user's favorites from MongoDB"""
        cursor = Database.favorites().find(
            {"user_id": user_id}
        ).sort("added_at", -1).skip(offset).limit(limit)

        favorites = []
        async for doc in cursor:
            try:
                # Remove MongoDB _id
                doc.pop("_id", None)
                favorites.append(FavoriteEntry(**doc))
            except Exception:
                continue

        return favorites

    @classmethod
    async def add_favorite(cls, user_id: str, song_id: str) -> bool:
        """Add song to favorites"""
        song = await SongService.get_song_by_id(song_id)
        if not song:
            return False

        # Create favorite entry
        artists_map = await SongService._load_artists_map()
        snapshot = SongService._to_snapshot(song, artists_map)

        favorite_doc = {
            "user_id": user_id,
            "song_id": song_id,
            "added_at": datetime.utcnow(),
            "song_snapshot": snapshot.model_dump() if snapshot else None,
        }

        # Upsert to avoid duplicates
        await Database.favorites().update_one(
            {"user_id": user_id, "song_id": song_id},
            {"$set": favorite_doc},
            upsert=True
        )

        return True

    @classmethod
    async def remove_favorite(cls, user_id: str, song_id: str):
        """Remove song from favorites"""
        await Database.favorites().delete_one({
            "user_id": user_id,
            "song_id": song_id
        })

    @classmethod
    async def is_favorite(cls, user_id: str, song_id: str) -> bool:
        """Check if song is favorited"""
        doc = await Database.favorites().find_one({
            "user_id": user_id,
            "song_id": song_id
        })
        return doc is not None

    @classmethod
    async def sync_favorites(cls, user_id: str, favorites: list):
        """Sync favorites from client - replace server favorites with client data"""
        # Clear existing favorites
        await Database.favorites().delete_many({"user_id": user_id})

        # Insert new favorites
        if favorites:
            docs = []
            for item in favorites:
                video_id = item.get("videoId") or item.get("video_id") or item.get("song_id", "")
                if not video_id:
                    continue

                doc = {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "song_id": video_id,
                    "added_at": datetime.fromtimestamp(item.get("addedAt", 0) / 1000) if item.get("addedAt") else datetime.utcnow(),
                    "song_snapshot": {
                        "id": video_id,
                        "title": item.get("title", ""),
                        "artist": item.get("artist", ""),
                        "artwork_url": item.get("artwork") or item.get("artwork_url", ""),
                        "youtube_video_id": video_id,
                    }
                }
                docs.append(doc)

            if docs:
                await Database.favorites().insert_many(docs)

    # ============== History ==============

    @classmethod
    async def get_history(cls, user_id: str, limit: int = 50) -> List[HistoryEntry]:
        """Get listening history from MongoDB"""
        cursor = Database.history().find(
            {"user_id": user_id}
        ).sort("played_at", -1).limit(limit)

        history = []
        async for doc in cursor:
            try:
                doc.pop("_id", None)
                # Ensure id field exists
                if "id" not in doc:
                    doc["id"] = str(uuid.uuid4())
                history.append(HistoryEntry(**doc))
            except Exception:
                continue

        return history

    @classmethod
    async def add_to_history(
        cls,
        user_id: str,
        song_id: str,
        duration_played_ms: int = 0,
        completed: bool = False,
        source: str = "chart"
    ):
        """Add song to history"""
        song = await SongService.get_song_by_id(song_id)
        if not song:
            return

        artists_map = await SongService._load_artists_map()
        snapshot = SongService._to_snapshot(song, artists_map)

        # Parse source
        try:
            play_source = PlaySource(source)
        except ValueError:
            play_source = PlaySource.CHART

        entry_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "song_id": song_id,
            "played_at": datetime.utcnow(),
            "duration_played_ms": duration_played_ms,
            "completed": completed,
            "source": play_source.value,
            "song_snapshot": snapshot.model_dump() if snapshot else None,
        }

        await Database.history().insert_one(entry_doc)

    @classmethod
    async def clear_history(cls, user_id: str):
        """Clear listening history"""
        await Database.history().delete_many({"user_id": user_id})

    @classmethod
    async def sync_history(cls, user_id: str, history_items: list):
        """Sync history from client - replace server history with client data"""
        # Clear existing history
        await Database.history().delete_many({"user_id": user_id})

        # Insert new history items
        if history_items:
            docs = []
            for item in history_items:
                doc = {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "song_id": item.get("videoId") or item.get("song_id", ""),
                    "played_at": datetime.fromtimestamp(item.get("playedAt", 0) / 1000) if item.get("playedAt") else datetime.utcnow(),
                    "duration_played_ms": item.get("duration_played_ms", 0),
                    "completed": item.get("completed", False),
                    "source": item.get("source", "chart"),
                    "song_snapshot": {
                        "id": item.get("videoId") or item.get("video_id", ""),
                        "title": item.get("title", ""),
                        "artist": item.get("artist", ""),
                        "artwork_url": item.get("artwork") or item.get("artwork_url", ""),
                        "youtube_video_id": item.get("videoId") or item.get("video_id", ""),
                    }
                }
                docs.append(doc)

            if docs:
                await Database.history().insert_many(docs)

    # ============== Queue ==============

    @classmethod
    async def get_queue(cls, user_id: str) -> List[QueueEntry]:
        """Get user's queue from MongoDB"""
        doc = await Database.queue().find_one({"user_id": user_id})
        if not doc:
            return []

        queue = []
        for item in doc.get("items", []):
            try:
                # Ensure song_snapshot exists
                snapshot_data = item.get("song_snapshot", {})
                video_id = item.get("videoId") or item.get("song_id", "")
                if not snapshot_data:
                    snapshot_data = {
                        "id": video_id,
                        "title": item.get("title", ""),
                        "artist": item.get("artist", ""),
                        "artwork_url": item.get("artwork") or item.get("artwork_url", ""),
                        "youtube_video_id": video_id,
                    }

                from ..models import SongSnapshot
                snapshot = SongSnapshot(
                    id=snapshot_data.get("id") or snapshot_data.get("youtube_video_id", ""),
                    title=snapshot_data.get("title", ""),
                    artist=snapshot_data.get("artist", ""),
                    artwork_url=snapshot_data.get("artwork_url", ""),
                    youtube_video_id=snapshot_data.get("youtube_video_id") or snapshot_data.get("video_id", ""),
                )

                queue.append(QueueEntry(
                    id=item.get("id", str(uuid.uuid4())),
                    song_id=item.get("song_id") or item.get("videoId", ""),
                    added_at=item.get("added_at", datetime.utcnow()),
                    source=item.get("source", "unknown"),
                    song_snapshot=snapshot,
                ))
            except Exception:
                continue

        return queue

    @classmethod
    async def save_queue(cls, user_id: str, queue_items: list):
        """Save user's queue to MongoDB (replaces existing)"""
        items = []
        for item in queue_items:
            # Handle both dict and QueueEntry objects
            if hasattr(item, 'model_dump'):
                item_dict = item.model_dump()
            else:
                item_dict = item

            video_id = item_dict.get("videoId") or item_dict.get("video_id") or item_dict.get("song_snapshot", {}).get("youtube_video_id") or item_dict.get("song_snapshot", {}).get("video_id", "")
            items.append({
                "id": item_dict.get("id", str(uuid.uuid4())),
                "song_id": item_dict.get("song_id") or item_dict.get("videoId", ""),
                "added_at": item_dict.get("added_at", datetime.utcnow()),
                "source": item_dict.get("source", "unknown"),
                "song_snapshot": {
                    "id": video_id,
                    "title": item_dict.get("title") or item_dict.get("song_snapshot", {}).get("title", ""),
                    "artist": item_dict.get("artist") or item_dict.get("song_snapshot", {}).get("artist", ""),
                    "artwork_url": item_dict.get("artwork") or item_dict.get("artwork_url") or item_dict.get("song_snapshot", {}).get("artwork_url", ""),
                    "youtube_video_id": video_id,
                }
            })

        # Store current playing index if provided
        current_index = None
        if queue_items and hasattr(queue_items[0], 'get'):
            current_index = queue_items[0].get('current_index')

        doc = {
            "user_id": user_id,
            "items": items,
            "current_index": current_index,
            "updated_at": datetime.utcnow(),
        }

        await Database.queue().update_one(
            {"user_id": user_id},
            {"$set": doc},
            upsert=True
        )

    @classmethod
    async def clear_queue(cls, user_id: str):
        """Clear user's queue"""
        await Database.queue().delete_one({"user_id": user_id})

    # ============== Playlists ==============

    @classmethod
    async def get_user_playlists(cls, user_id: str) -> List[PlaylistSummary]:
        """Get user's playlists from MongoDB"""
        cursor = Database.playlists().find(
            {"user_id": user_id}
        ).sort("created_at", -1)

        playlists = []
        async for doc in cursor:
            try:
                playlist_id = str(doc.get("_id")) if "_id" in doc else doc.get("id")
                song_ids = doc.get("song_ids", [])

                # Get cover image from first song if available
                cover_image = doc.get("cover_image")
                if not cover_image and song_ids:
                    first_song = await SongService.get_song_by_id(song_ids[0])
                    if first_song:
                        cover_image = first_song.get("image_url") or first_song.get("artwork_url")

                summary = PlaylistSummary(
                    id=playlist_id,
                    name=doc.get("name", "Untitled"),
                    owner_name="You",
                    artwork_url=cover_image,
                    total_tracks=len(song_ids),
                    visibility=PlaylistVisibility(doc.get("visibility", "private")),
                )
                playlists.append(summary)
            except Exception as e:
                continue

        return playlists

    @classmethod
    async def create_playlist(
        cls,
        user_id: str,
        data: PlaylistCreate
    ) -> Playlist:
        """Create new playlist in MongoDB"""
        playlist_id = str(uuid.uuid4())
        now = datetime.utcnow()

        playlist_doc = {
            "id": playlist_id,
            "user_id": user_id,
            "name": data.name,
            "description": data.description,
            "visibility": data.visibility.value if data.visibility else "private",
            "song_ids": data.song_ids or [],
            "total_tracks": len(data.song_ids) if data.song_ids else 0,
            "created_at": now,
            "updated_at": now,
        }

        await Database.playlists().insert_one(playlist_doc)

        return Playlist(
            id=playlist_id,
            user_id=user_id,
            name=data.name,
            description=data.description,
            visibility=data.visibility or PlaylistVisibility.PRIVATE,
            song_ids=data.song_ids or [],
            total_tracks=len(data.song_ids) if data.song_ids else 0,
            created_at=now,
            updated_at=now,
        )

    @classmethod
    async def get_playlist(
        cls,
        playlist_id: str,
        user_id: str
    ) -> Optional[Playlist]:
        """Get playlist by ID from MongoDB"""
        # Try finding by id, client_id, or _id
        doc = await Database.playlists().find_one({"id": playlist_id})

        if not doc:
            doc = await Database.playlists().find_one({"client_id": playlist_id})

        if not doc:
            try:
                doc = await Database.playlists().find_one({"_id": ObjectId(playlist_id)})
            except:
                pass

        if not doc:
            return None

        # Check ownership or public visibility
        doc_user_id = doc.get("user_id")
        visibility = doc.get("visibility", "private")

        if doc_user_id != user_id and visibility != "public":
            return None

        pid = str(doc.get("_id")) if "_id" in doc and "id" not in doc else doc.get("id", str(doc.get("_id")))

        return Playlist(
            id=pid,
            user_id=doc.get("user_id"),
            name=doc.get("name", "Untitled"),
            description=doc.get("description"),
            artwork_url=doc.get("cover_image") or doc.get("artwork_url"),
            visibility=PlaylistVisibility(doc.get("visibility", "private")),
            song_ids=doc.get("song_ids", []),
            total_tracks=len(doc.get("song_ids", [])),
            created_at=doc.get("created_at", datetime.utcnow()),
            updated_at=doc.get("updated_at", datetime.utcnow()),
        )

    @classmethod
    async def get_playlist_public(cls, playlist_id: str) -> Optional[Playlist]:
        """Get playlist by ID (for public/share access)"""
        doc = await Database.playlists().find_one({"id": playlist_id})

        if not doc:
            try:
                doc = await Database.playlists().find_one({"_id": ObjectId(playlist_id)})
            except:
                pass

        if not doc:
            return None

        pid = str(doc.get("_id")) if "_id" in doc and "id" not in doc else doc.get("id", str(doc.get("_id")))

        return Playlist(
            id=pid,
            user_id=doc.get("user_id"),
            name=doc.get("name", "Untitled"),
            description=doc.get("description"),
            artwork_url=doc.get("cover_image") or doc.get("artwork_url"),
            visibility=PlaylistVisibility(doc.get("visibility", "private")),
            song_ids=doc.get("song_ids", []),
            total_tracks=len(doc.get("song_ids", [])),
            created_at=doc.get("created_at", datetime.utcnow()),
            updated_at=doc.get("updated_at", datetime.utcnow()),
        )

    @classmethod
    async def update_playlist(
        cls,
        playlist_id: str,
        user_id: str,
        data: PlaylistUpdate
    ) -> Optional[Playlist]:
        """Update playlist in MongoDB"""
        # Find playlist first - check id, client_id, and _id
        query_conditions = [
            {"id": playlist_id},
            {"client_id": playlist_id},
        ]
        if ObjectId.is_valid(playlist_id):
            query_conditions.append({"_id": ObjectId(playlist_id)})

        doc = await Database.playlists().find_one({
            "$or": query_conditions,
            "user_id": user_id
        })

        if not doc:
            return None

        # Build update
        update_fields = {"updated_at": datetime.utcnow()}
        if data.name is not None:
            update_fields["name"] = data.name
        if data.description is not None:
            update_fields["description"] = data.description
        if data.visibility is not None:
            update_fields["visibility"] = data.visibility.value
        if data.song_ids is not None:
            update_fields["song_ids"] = data.song_ids
            update_fields["total_tracks"] = len(data.song_ids)

        # Update using the document's _id
        await Database.playlists().update_one(
            {"_id": doc["_id"]},
            {"$set": update_fields}
        )

        # Return updated playlist
        return await cls.get_playlist(playlist_id, user_id)

    @classmethod
    async def delete_playlist(cls, playlist_id: str, user_id: str) -> bool:
        """Delete playlist from MongoDB"""
        # Check id, client_id, and _id to handle all ID formats
        query_conditions = [
            {"id": playlist_id},
            {"client_id": playlist_id},  # Also check client_id for synced playlists
        ]
        if ObjectId.is_valid(playlist_id):
            query_conditions.append({"_id": ObjectId(playlist_id)})

        result = await Database.playlists().delete_one({
            "$or": query_conditions,
            "user_id": user_id
        })
        return result.deleted_count > 0

    @classmethod
    async def add_song_to_playlist(
        cls,
        playlist_id: str,
        song_id: str,
        user_id: str
    ) -> bool:
        """Add song to playlist"""
        # Verify song exists
        song = await SongService.get_song_by_id(song_id)
        if not song:
            return False

        # Build query conditions for id, client_id, and _id
        query_conditions = [
            {"id": playlist_id},
            {"client_id": playlist_id},
        ]
        if ObjectId.is_valid(playlist_id):
            query_conditions.append({"_id": ObjectId(playlist_id)})

        # Find and update playlist
        result = await Database.playlists().update_one(
            {
                "$or": query_conditions,
                "user_id": user_id
            },
            {
                "$addToSet": {"song_ids": song_id},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )

        # Update total_tracks
        if result.modified_count > 0:
            doc = await Database.playlists().find_one({
                "$or": query_conditions
            })
            if doc:
                await Database.playlists().update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"total_tracks": len(doc.get("song_ids", []))}}
                )

        return result.modified_count > 0 or result.matched_count > 0

    @classmethod
    async def remove_song_from_playlist(
        cls,
        playlist_id: str,
        song_id: str,
        user_id: str
    ):
        """Remove song from playlist"""
        # Build query conditions for id, client_id, and _id
        query_conditions = [
            {"id": playlist_id},
            {"client_id": playlist_id},
        ]
        if ObjectId.is_valid(playlist_id):
            query_conditions.append({"_id": ObjectId(playlist_id)})

        result = await Database.playlists().update_one(
            {
                "$or": query_conditions,
                "user_id": user_id
            },
            {
                "$pull": {"song_ids": song_id},
                "$set": {"updated_at": datetime.utcnow()}
            }
        )

        # Update total_tracks
        if result.modified_count > 0:
            doc = await Database.playlists().find_one({
                "$or": query_conditions
            })
            if doc:
                await Database.playlists().update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"total_tracks": len(doc.get("song_ids", []))}}
                )

    @classmethod
    async def sync_playlists(cls, user_id: str, playlists: list) -> List[PlaylistSummary]:
        """
        Sync playlists from client to server.
        Creates new playlists, updates existing ones, deletes removed ones.
        """
        synced_playlists = []
        now = datetime.utcnow()

        # Get all client playlist IDs (both client-generated and server IDs)
        client_ids = set()
        for p in playlists:
            pid = p.get("id", "")
            if pid:
                client_ids.add(pid)

        # Delete playlists on server that are not in client's list
        # This handles the case where user deleted a playlist
        server_playlists = Database.playlists().find({"user_id": user_id})
        async for doc in server_playlists:
            server_id = doc.get("id", str(doc.get("_id")))
            client_id = doc.get("client_id", "")
            # If neither server_id nor client_id is in the client's list, delete it
            if server_id not in client_ids and client_id not in client_ids:
                await Database.playlists().delete_one({"_id": doc["_id"]})

        for playlist_data in playlists:
            client_id = playlist_data.get("id", "")
            name = playlist_data.get("name", "Untitled")
            description = playlist_data.get("description", "")
            songs = playlist_data.get("songs", [])
            is_public = playlist_data.get("is_public", False)

            # custom_artwork can be a boolean flag or the actual URL
            # artwork_url is always the actual URL
            artwork_url_value = playlist_data.get("artwork_url")
            custom_artwork_flag = playlist_data.get("custom_artwork")

            # Only use artwork_url if it's a valid string URL
            custom_artwork = None
            if isinstance(artwork_url_value, str) and artwork_url_value:
                custom_artwork = artwork_url_value
            elif isinstance(custom_artwork_flag, str) and custom_artwork_flag:
                custom_artwork = custom_artwork_flag

            created_at = playlist_data.get("created_at")
            updated_at = playlist_data.get("updated_at")

            # Convert timestamps from milliseconds if needed
            if isinstance(created_at, (int, float)):
                created_at = datetime.fromtimestamp(created_at / 1000)
            elif not created_at:
                created_at = now

            if isinstance(updated_at, (int, float)):
                updated_at = datetime.fromtimestamp(updated_at / 1000)
            elif not updated_at:
                updated_at = now

            # Build song_ids list and song snapshots
            song_ids = []
            song_snapshots = []
            for song in songs:
                video_id = song.get("videoId") or song.get("video_id", "")
                if video_id:
                    song_ids.append(video_id)
                    song_snapshots.append({
                        "video_id": video_id,
                        "title": song.get("title", ""),
                        "artist": song.get("artist", ""),
                        "artwork_url": song.get("artwork") or song.get("artwork_url", ""),
                        "added_at": song.get("added_at", now)
                    })

            # Check if playlist with this client ID already exists for this user
            existing = await Database.playlists().find_one({
                "user_id": user_id,
                "$or": [
                    {"id": client_id},
                    {"client_id": client_id}
                ]
            })

            if existing:
                # Update existing playlist
                server_id = existing.get("id", str(existing.get("_id")))
                update_doc = {
                    "name": name,
                    "description": description,
                    "song_ids": song_ids,
                    "song_snapshots": song_snapshots,
                    "total_tracks": len(song_ids),
                    "visibility": "public" if is_public else "private",
                    "updated_at": updated_at,
                }
                # Only update custom_artwork if provided
                if custom_artwork:
                    update_doc["custom_artwork"] = custom_artwork

                await Database.playlists().update_one(
                    {"_id": existing["_id"]},
                    {"$set": update_doc}
                )
            else:
                # Create new playlist with server-generated ID
                server_id = str(uuid.uuid4())
                playlist_doc = {
                    "id": server_id,
                    "client_id": client_id,  # Keep track of client ID for future syncs
                    "user_id": user_id,
                    "name": name,
                    "description": description,
                    "song_ids": song_ids,
                    "song_snapshots": song_snapshots,
                    "total_tracks": len(song_ids),
                    "visibility": "public" if is_public else "private",
                    "created_at": created_at,
                    "updated_at": updated_at,
                }
                # Add custom_artwork if provided
                if custom_artwork:
                    playlist_doc["custom_artwork"] = custom_artwork

                await Database.playlists().insert_one(playlist_doc)

            # Use custom artwork if available, otherwise first song artwork
            artwork_url = custom_artwork or (song_snapshots[0].get("artwork_url") if song_snapshots else None)

            synced_playlists.append(PlaylistSummary(
                id=server_id,
                name=name,
                owner_name="You",
                artwork_url=artwork_url,
                total_tracks=len(song_ids),
                visibility=PlaylistVisibility.PUBLIC if is_public else PlaylistVisibility.PRIVATE,
            ))

        return synced_playlists

    # ============== Preferences ==============

    @classmethod
    async def get_preferences(cls, user_id: str) -> dict:
        """Get user preferences from MongoDB"""
        doc = await Database.db["user_preferences"].find_one({"user_id": user_id})
        if not doc:
            return {"shuffle": False, "repeat": "off"}
        return {
            "shuffle": doc.get("shuffle", False),
            "repeat": doc.get("repeat", "off")
        }

    @classmethod
    async def save_preferences(cls, user_id: str, shuffle: bool = False, repeat: str = "off"):
        """Save user preferences to MongoDB"""
        await Database.db["user_preferences"].update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id": user_id,
                "shuffle": shuffle,
                "repeat": repeat,
                "updated_at": datetime.utcnow()
            }},
            upsert=True
        )

    # ============== Recent Searches ==============

    @classmethod
    async def get_recent_searches(cls, user_id: str) -> list:
        """Get user's recent searches from MongoDB"""
        doc = await Database.db["recent_searches"].find_one({"user_id": user_id})
        if not doc:
            return []
        return doc.get("searches", [])

    @classmethod
    async def save_recent_searches(cls, user_id: str, searches: list):
        """Save user's recent searches to MongoDB"""
        # Limit to 10 most recent
        searches = searches[:10] if searches else []
        await Database.db["recent_searches"].update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id": user_id,
                "searches": searches,
                "updated_at": datetime.utcnow()
            }},
            upsert=True
        )

    # ============== Session Management ==============

    @classmethod
    async def ping_session(cls, user_id: str, session_id: str = None) -> dict:
        """
        Ping session to track active sessions.
        Returns info about active sessions for this user.
        """
        import uuid as uuid_module

        now = datetime.utcnow()
        session_timeout = 120  # 2 minutes - sessions older than this are considered inactive

        # Use client-provided session ID or generate one
        if not session_id:
            session_id = f"server_{uuid_module.uuid4().hex[:16]}"

        # Update this session's last ping time
        await Database.db["active_sessions"].update_one(
            {"user_id": user_id, "session_id": session_id},
            {"$set": {
                "user_id": user_id,
                "session_id": session_id,
                "last_ping": now
            }},
            upsert=True
        )

        # Clean up old sessions (older than 2 minutes)
        cutoff = now - timedelta(seconds=session_timeout)
        await Database.db["active_sessions"].delete_many({
            "user_id": user_id,
            "last_ping": {"$lt": cutoff}
        })

        # Count active sessions for this user
        count = await Database.db["active_sessions"].count_documents({
            "user_id": user_id,
            "last_ping": {"$gte": cutoff}
        })

        return {
            "multiple_sessions": count > 1,
            "active_sessions": count,
            "session_id": session_id
        }
