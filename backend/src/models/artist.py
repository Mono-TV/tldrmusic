"""
Artist Model - Represents musicians, bands, composers
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class ArtistType(str, Enum):
    SOLO = "solo"
    BAND = "band"
    COMPOSER = "composer"
    DJ = "dj"
    PRODUCER = "producer"


class ArtistImages(BaseModel):
    """Artist image URLs"""
    thumbnail: Optional[str] = None   # 150x150
    profile: Optional[str] = None     # 400x400
    banner: Optional[str] = None      # 1500x500


class SocialLinks(BaseModel):
    """Artist social media links"""
    instagram: Optional[str] = None
    twitter: Optional[str] = None
    spotify: Optional[str] = None
    youtube: Optional[str] = None
    apple_music: Optional[str] = None
    website: Optional[str] = None


class Artist(BaseModel):
    """
    Artist entity

    Represents a music artist, band, composer, or producer.
    """
    id: str = Field(..., description="Unique identifier (UUID)")
    name: str
    name_normalized: str = Field(..., description="Lowercase for search")

    # Bio
    bio: Optional[str] = None

    # Images
    images: ArtistImages = Field(default_factory=ArtistImages)

    # Social links
    social: SocialLinks = Field(default_factory=SocialLinks)

    # Classification
    genres: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)  # Languages they sing in
    type: ArtistType = ArtistType.SOLO

    # Stats (denormalized)
    monthly_listeners: int = 0
    total_plays: int = 0
    follower_count: int = 0

    # Relationships (cached for quick access)
    top_song_ids: List[str] = Field(default_factory=list, max_length=10)
    album_ids: List[str] = Field(default_factory=list)

    # Verification
    verified: bool = False

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ArtistCreate(BaseModel):
    """Schema for creating a new artist"""
    name: str
    bio: Optional[str] = None
    images: Optional[ArtistImages] = None
    social: Optional[SocialLinks] = None
    genres: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)
    type: ArtistType = ArtistType.SOLO


class ArtistUpdate(BaseModel):
    """Schema for updating an artist"""
    name: Optional[str] = None
    bio: Optional[str] = None
    images: Optional[ArtistImages] = None
    social: Optional[SocialLinks] = None
    genres: Optional[List[str]] = None
    languages: Optional[List[str]] = None
    type: Optional[ArtistType] = None
    verified: Optional[bool] = None


class ArtistSummary(BaseModel):
    """
    Lightweight artist representation for embedding
    """
    id: str
    name: str
    image_url: Optional[str] = None
    verified: bool = False
