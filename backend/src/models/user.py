"""
User Model - User accounts and authentication
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class AuthProvider(str, Enum):
    PHONE = "phone"
    GOOGLE = "google"
    EMAIL = "email"  # Future


class RepeatMode(str, Enum):
    OFF = "off"
    ALL = "all"
    ONE = "one"


class AudioQualityPreference(str, Enum):
    AUTO = "auto"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class UserPreferences(BaseModel):
    """User playback and UI preferences"""
    shuffle: bool = False
    repeat: RepeatMode = RepeatMode.OFF
    quality: AudioQualityPreference = AudioQualityPreference.AUTO
    language_filter: List[str] = Field(default_factory=list)  # Preferred languages
    autoplay: bool = True
    notifications_enabled: bool = True
    theme: str = "dark"  # "dark", "light", "system"


class LinkedAccount(BaseModel):
    """Linked authentication provider"""
    provider: AuthProvider
    provider_user_id: str
    email: Optional[str] = None
    phone: Optional[str] = None
    linked_at: datetime = Field(default_factory=datetime.utcnow)


class User(BaseModel):
    """
    User entity

    Represents a registered user with authentication and preferences.
    """
    id: str = Field(..., description="Unique identifier (UUID)")

    # Profile
    display_name: Optional[str] = None
    name: Optional[str] = None  # Alias for display_name (for frontend compatibility)
    username: Optional[str] = None  # Unique handle
    avatar_url: Optional[str] = None
    picture: Optional[str] = None  # Alias for avatar_url (Google OAuth)
    bio: Optional[str] = None

    # Contact
    phone: Optional[str] = None
    phone_verified: bool = False
    email: Optional[str] = None
    email_verified: bool = False

    # Authentication
    auth_providers: List[LinkedAccount] = Field(default_factory=list)
    primary_auth: AuthProvider = AuthProvider.PHONE

    # Preferences
    preferences: UserPreferences = Field(default_factory=UserPreferences)

    # Stats
    total_play_time_ms: int = 0
    songs_played: int = 0
    favorite_count: int = 0
    playlist_count: int = 0
    follower_count: int = 0
    following_count: int = 0

    # Status
    is_active: bool = True
    is_premium: bool = False  # Future: premium features

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_seen_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class UserCreate(BaseModel):
    """Schema for creating a new user"""
    phone: Optional[str] = None
    email: Optional[str] = None
    display_name: Optional[str] = None
    auth_provider: AuthProvider


class UserUpdate(BaseModel):
    """Schema for updating user profile"""
    display_name: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    preferences: Optional[UserPreferences] = None


class UserPublicProfile(BaseModel):
    """
    Public user profile (visible to others)
    """
    id: str
    display_name: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    follower_count: int = 0
    following_count: int = 0
    playlist_count: int = 0  # Public playlists only
    is_premium: bool = False
    created_at: datetime


# ============== Authentication ==============

class PhoneAuthRequest(BaseModel):
    """Request OTP for phone authentication"""
    phone: str = Field(..., pattern=r'^\+?[1-9]\d{9,14}$')


class PhoneVerifyRequest(BaseModel):
    """Verify OTP for phone authentication"""
    phone: str
    otp: str = Field(..., min_length=4, max_length=6)


class GoogleAuthRequest(BaseModel):
    """Google OAuth token exchange"""
    id_token: str


class AuthResponse(BaseModel):
    """Authentication response with tokens"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # Seconds
    user: User


class TokenRefreshRequest(BaseModel):
    """Refresh access token"""
    refresh_token: str
