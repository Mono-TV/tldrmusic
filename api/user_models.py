"""
Pydantic models for user authentication and data
"""

from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime


# ============================================================
# USER DATA ITEMS
# ============================================================

class FavoriteItem(BaseModel):
    """A favorited song"""
    title: str
    artist: str
    videoId: Optional[str] = None
    artwork: Optional[str] = None
    addedAt: int  # Unix timestamp in ms

    class Config:
        extra = "allow"


class HistoryItem(BaseModel):
    """A played song in history"""
    title: str
    artist: str
    videoId: Optional[str] = None
    artwork: Optional[str] = None
    playedAt: int  # Unix timestamp in ms

    class Config:
        extra = "allow"


class QueueItem(BaseModel):
    """A song in the play queue"""
    title: str
    artist: str
    videoId: Optional[str] = None
    artwork: Optional[str] = None
    id: int  # Unique queue item ID

    class Config:
        extra = "allow"


class UserPreferences(BaseModel):
    """User playback preferences"""
    shuffle: bool = False
    repeat: str = "off"  # 'off' | 'all' | 'one'


# ============================================================
# AUTH REQUESTS/RESPONSES
# ============================================================

class LocalData(BaseModel):
    """Local data to sync on first login"""
    favorites: List[FavoriteItem] = []
    history: List[HistoryItem] = []
    queue: List[QueueItem] = []
    preferences: Optional[UserPreferences] = None


class GoogleLoginRequest(BaseModel):
    """Request body for Google login"""
    google_token: str
    local_data: Optional[LocalData] = None


class RefreshTokenRequest(BaseModel):
    """Request body for token refresh"""
    refresh_token: str


class UserInfo(BaseModel):
    """Basic user info returned in auth responses"""
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    username: Optional[str] = None


class TokenResponse(BaseModel):
    """Response for login/refresh endpoints"""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "Bearer"
    expires_in: int = 900  # 15 minutes in seconds
    user: Optional[UserInfo] = None


# ============================================================
# USER PROFILE
# ============================================================

class UserProfile(BaseModel):
    """Full user profile with all synced data"""
    id: str
    email: str
    name: str
    username: Optional[str] = None
    picture: Optional[str] = None
    favorites: List[FavoriteItem] = []
    history: List[HistoryItem] = []
    queue: List[QueueItem] = []
    preferences: UserPreferences = UserPreferences()


class PublicProfile(BaseModel):
    """Public profile visible to other users"""
    id: str
    name: str
    username: str
    picture: Optional[str] = None
    playlist_count: int = 0


class UsernameCheck(BaseModel):
    """Response for username availability check"""
    username: str
    available: bool
    message: Optional[str] = None


class UsernameUpdate(BaseModel):
    """Request to update username"""
    username: str


# ============================================================
# SYNC REQUESTS/RESPONSES
# ============================================================

class SyncRequest(BaseModel):
    """Request for full bidirectional sync"""
    local_favorites: List[FavoriteItem] = []
    local_history: List[HistoryItem] = []
    local_queue: List[QueueItem] = []
    local_preferences: Optional[UserPreferences] = None


class SyncResponse(BaseModel):
    """Response with merged data from sync"""
    merged_favorites: List[FavoriteItem]
    merged_history: List[HistoryItem]
    merged_queue: List[QueueItem]
    preferences: UserPreferences
    merged_playlists: List[Dict[str, Any]] = []


# ============================================================
# UPDATE REQUESTS
# ============================================================

class FavoritesUpdate(BaseModel):
    """Update user favorites"""
    favorites: List[FavoriteItem]


class HistoryUpdate(BaseModel):
    """Update user history"""
    history: List[HistoryItem]


class QueueUpdate(BaseModel):
    """Update user queue"""
    queue: List[QueueItem]


class SuccessResponse(BaseModel):
    """Generic success response"""
    success: bool = True
    message: Optional[str] = None
    count: Optional[int] = None
