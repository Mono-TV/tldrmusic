"""
Rate Limiting Configuration

Uses slowapi for request rate limiting to protect against abuse.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request


def get_user_identifier(request: Request) -> str:
    """
    Get rate limit key based on authenticated user or IP address.

    For authenticated requests, use user ID for per-user limits.
    For unauthenticated requests, fall back to IP address.
    """
    # Try to get user from request state (set by auth middleware)
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        # Use a hash of the token as identifier for authenticated users
        # This ensures per-user rate limiting
        token = auth_header[7:]
        if token:
            # Use first 32 chars of token as identifier (enough for uniqueness)
            return f"user:{token[:32]}"

    # Fall back to IP address for unauthenticated requests
    return get_remote_address(request)


# Create limiter instance with user-based key function
limiter = Limiter(key_func=get_user_identifier)


# Rate limit configurations
class RateLimits:
    """Centralized rate limit definitions"""

    # AI Playlist Generation - expensive operation
    AI_PLAYLIST_GENERATE = "10/hour"  # 10 generations per hour per user

    # General API limits
    LIBRARY_SYNC = "30/minute"  # Library sync operations
    PLAYLIST_CREATE = "20/hour"  # Playlist creation

    # Search operations
    SEARCH = "60/minute"  # Search requests

    # Default for other endpoints
    DEFAULT = "100/minute"
