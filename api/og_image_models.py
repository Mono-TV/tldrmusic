"""
OG Image Generation Models
Pydantic models for OG image generation system
"""

from pydantic import BaseModel
from typing import Optional
from enum import Enum


class OGImageStatus(str, Enum):
    """Status of OG image generation"""
    NONE = "none"
    PENDING = "pending"
    GENERATING = "generating"
    READY = "ready"
    FAILED = "failed"


class OGImageTemplate(str, Enum):
    """Available OG image templates"""
    DEFAULT = "default"
    MINIMAL = "minimal"
    VIBRANT = "vibrant"
    DARK = "dark"


class OGImageConfig(BaseModel):
    """Configuration for OG image generation"""
    width: int = 1200
    height: int = 630
    grid_size: int = 2  # 2x2 grid
    padding: int = 60
    artwork_size: int = 220
    artwork_gap: int = 12
    artwork_radius: int = 12
    text_color: str = "#FFFFFF"
    secondary_text_color: str = "#AAAAAA"
    background_color: str = "#1a1a2e"
    accent_color: str = "#6366F1"
    overlay_opacity: float = 0.85


class RegenerateOGImageRequest(BaseModel):
    """Request to manually trigger OG image regeneration"""
    template: Optional[str] = "default"


class OGImageStatusResponse(BaseModel):
    """Response for OG image status check"""
    status: str
    og_image_url: Optional[str] = None
    updated_at: Optional[int] = None
    template: str = "default"
    error: Optional[str] = None
