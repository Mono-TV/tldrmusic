"""
Database Connection and Collections
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import IndexModel, ASCENDING, DESCENDING, TEXT
from pymongo.errors import OperationFailure
from typing import Optional
import logging

from .settings import settings

logger = logging.getLogger(__name__)


class Database:
    """
    MongoDB database manager
    """
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None

    @classmethod
    async def connect(cls):
        """Connect to MongoDB"""
        logger.info(f"Connecting to MongoDB at {settings.MONGODB_URL}")
        cls.client = AsyncIOMotorClient(settings.MONGODB_URL)
        cls.db = cls.client[settings.MONGODB_DB_NAME]

        # Create indexes
        await cls._create_indexes()

        logger.info("Connected to MongoDB successfully")

    @classmethod
    async def disconnect(cls):
        """Disconnect from MongoDB"""
        if cls.client is not None:
            cls.client.close()
            logger.info("Disconnected from MongoDB")

    @classmethod
    async def _create_indexes(cls):
        """Create database indexes for optimal query performance"""
        if cls.db is None:
            return

        async def safe_create_indexes(collection, indexes, collection_name):
            """Create indexes, skipping index conflicts"""
            try:
                await collection.create_indexes(indexes)
            except OperationFailure as e:
                if e.code in (85, 86):  # IndexOptionsConflict, IndexKeySpecsConflict
                    logger.warning(f"Index conflict in {collection_name}, using existing indexes")
                else:
                    raise

        # Songs collection indexes (skip text index - may conflict with existing)
        await safe_create_indexes(cls.db.songs, [
            IndexModel([("title_normalized", ASCENDING)]),
            IndexModel([("artist_ids", ASCENDING)]),
            IndexModel([("album_id", ASCENDING)]),
            IndexModel([("language", ASCENDING)]),
            IndexModel([("genres", ASCENDING)]),
            IndexModel([("created_at", DESCENDING)]),
            IndexModel([("play_count", DESCENDING)]),
            IndexModel([
                ("title_normalized", TEXT),
            ], name="song_text_search"),
        ], "songs")

        # Artists collection indexes
        await safe_create_indexes(cls.db.artists, [
            IndexModel([("name_normalized", ASCENDING)]),
            IndexModel([("genres", ASCENDING)]),
            IndexModel([("languages", ASCENDING)]),
            IndexModel([("monthly_listeners", DESCENDING)]),
            IndexModel([("verified", ASCENDING)]),
            IndexModel([
                ("name_normalized", TEXT),
            ], name="artist_text_search"),
        ], "artists")

        # Albums collection indexes
        await safe_create_indexes(cls.db.albums, [
            IndexModel([("title_normalized", ASCENDING)]),
            IndexModel([("artist_ids", ASCENDING)]),
            IndexModel([("release_date", DESCENDING)]),
            IndexModel([("type", ASCENDING)]),
        ], "albums")

        # Charts collection indexes
        await safe_create_indexes(cls.db.charts, [
            IndexModel([("region", ASCENDING), ("week", DESCENDING)]),
            IndexModel([("language", ASCENDING), ("week", DESCENDING)]),
            IndexModel([("generated_at", DESCENDING)]),
        ], "charts")

        # Users collection indexes
        await safe_create_indexes(cls.db.users, [
            IndexModel([("phone", ASCENDING)], unique=True, sparse=True),
            IndexModel([("email", ASCENDING)], unique=True, sparse=True),
            IndexModel([("username", ASCENDING)], unique=True, sparse=True),
            IndexModel([("created_at", DESCENDING)]),
        ], "users")

        # Playlists collection indexes
        await safe_create_indexes(cls.db.playlists, [
            IndexModel([("user_id", ASCENDING)]),
            IndexModel([("visibility", ASCENDING)]),
            IndexModel([("play_count", DESCENDING)]),
            IndexModel([("created_at", DESCENDING)]),
        ], "playlists")

        # User library (favorites, history) indexes
        await safe_create_indexes(cls.db.favorites, [
            IndexModel([("user_id", ASCENDING), ("song_id", ASCENDING)], unique=True),
            IndexModel([("user_id", ASCENDING), ("added_at", DESCENDING)]),
        ], "favorites")

        await safe_create_indexes(cls.db.history, [
            IndexModel([("user_id", ASCENDING), ("played_at", DESCENDING)]),
            IndexModel([("user_id", ASCENDING), ("song_id", ASCENDING)]),
        ], "history")

        # Queue indexes (one queue per user)
        await safe_create_indexes(cls.db.queue, [
            IndexModel([("user_id", ASCENDING)], unique=True),
        ], "queue")

        logger.info("Database indexes created")

    # Collection accessors
    @classmethod
    def songs(cls):
        return cls.db.songs

    @classmethod
    def artists(cls):
        return cls.db.artists

    @classmethod
    def albums(cls):
        return cls.db.albums

    @classmethod
    def charts(cls):
        return cls.db.charts

    @classmethod
    def users(cls):
        return cls.db.users

    @classmethod
    def playlists(cls):
        return cls.db.playlists

    @classmethod
    def favorites(cls):
        return cls.db.favorites

    @classmethod
    def history(cls):
        return cls.db.history

    @classmethod
    def queue(cls):
        return cls.db.queue

    @classmethod
    def sessions(cls):
        return cls.db.sessions


# Convenience function
async def get_database() -> AsyncIOMotorDatabase:
    """Get database instance for dependency injection"""
    return Database.db
