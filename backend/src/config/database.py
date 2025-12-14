"""
Database Connection and Collections
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import IndexModel, ASCENDING, DESCENDING, TEXT
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
        if cls.client:
            cls.client.close()
            logger.info("Disconnected from MongoDB")

    @classmethod
    async def _create_indexes(cls):
        """Create database indexes for optimal query performance"""
        if not cls.db:
            return

        # Songs collection indexes
        await cls.db.songs.create_indexes([
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
        ])

        # Artists collection indexes
        await cls.db.artists.create_indexes([
            IndexModel([("name_normalized", ASCENDING)]),
            IndexModel([("genres", ASCENDING)]),
            IndexModel([("languages", ASCENDING)]),
            IndexModel([("monthly_listeners", DESCENDING)]),
            IndexModel([("verified", ASCENDING)]),
            IndexModel([
                ("name_normalized", TEXT),
            ], name="artist_text_search"),
        ])

        # Albums collection indexes
        await cls.db.albums.create_indexes([
            IndexModel([("title_normalized", ASCENDING)]),
            IndexModel([("artist_ids", ASCENDING)]),
            IndexModel([("release_date", DESCENDING)]),
            IndexModel([("type", ASCENDING)]),
        ])

        # Charts collection indexes
        await cls.db.charts.create_indexes([
            IndexModel([("region", ASCENDING), ("week", DESCENDING)]),
            IndexModel([("language", ASCENDING), ("week", DESCENDING)]),
            IndexModel([("generated_at", DESCENDING)]),
        ])

        # Users collection indexes
        await cls.db.users.create_indexes([
            IndexModel([("phone", ASCENDING)], unique=True, sparse=True),
            IndexModel([("email", ASCENDING)], unique=True, sparse=True),
            IndexModel([("username", ASCENDING)], unique=True, sparse=True),
            IndexModel([("created_at", DESCENDING)]),
        ])

        # Playlists collection indexes
        await cls.db.playlists.create_indexes([
            IndexModel([("user_id", ASCENDING)]),
            IndexModel([("visibility", ASCENDING)]),
            IndexModel([("play_count", DESCENDING)]),
            IndexModel([("created_at", DESCENDING)]),
        ])

        # User library (favorites, history) indexes
        await cls.db.favorites.create_indexes([
            IndexModel([("user_id", ASCENDING), ("song_id", ASCENDING)], unique=True),
            IndexModel([("user_id", ASCENDING), ("added_at", DESCENDING)]),
        ])

        await cls.db.history.create_indexes([
            IndexModel([("user_id", ASCENDING), ("played_at", DESCENDING)]),
            IndexModel([("user_id", ASCENDING), ("song_id", ASCENDING)]),
        ])

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
    def sessions(cls):
        return cls.db.sessions


# Convenience function
async def get_database() -> AsyncIOMotorDatabase:
    """Get database instance for dependency injection"""
    return Database.db
