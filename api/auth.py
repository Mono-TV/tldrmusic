"""
Google OAuth and JWT authentication module
"""

from datetime import datetime, timedelta
from typing import Optional, Dict
from fastapi import HTTPException, Header
from google.oauth2 import id_token
from google.auth.transport import requests
import jwt
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-jwt-secret-change-me-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30


async def verify_google_token(token: str) -> Dict:
    """
    Verify Google ID token and return user info.

    Args:
        token: Google ID token from client-side sign-in

    Returns:
        Dict with google_id, email, name, picture

    Raises:
        HTTPException 401 if token is invalid
    """
    try:
        idinfo = id_token.verify_oauth2_token(
            token, requests.Request(), GOOGLE_CLIENT_ID
        )

        # Verify the token is from Google
        if idinfo["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Invalid issuer")

        return {
            "google_id": idinfo["sub"],
            "email": idinfo["email"],
            "name": idinfo.get("name", ""),
            "picture": idinfo.get("picture", "")
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")


def create_access_token(user_id: str, user_data: Dict) -> str:
    """
    Create short-lived access token (15 minutes).

    Args:
        user_id: MongoDB user ID
        user_data: Dict with email, name, picture

    Returns:
        JWT access token string
    """
    payload = {
        "sub": user_id,
        "email": user_data.get("email", ""),
        "name": user_data.get("name", ""),
        "picture": user_data.get("picture", ""),
        "type": "access",
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """
    Create long-lived refresh token (30 days).

    Args:
        user_id: MongoDB user ID

    Returns:
        JWT refresh token string
    """
    payload = {
        "sub": user_id,
        "type": "refresh",
        "exp": datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> Dict:
    """
    Verify and decode JWT token.

    Args:
        token: JWT token string

    Returns:
        Decoded token payload

    Raises:
        HTTPException 401 if token is invalid or expired
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict:
    """
    FastAPI dependency to get current authenticated user from Authorization header.

    Args:
        authorization: Authorization header value (Bearer <token>)

    Returns:
        Decoded token payload with user info

    Raises:
        HTTPException 401 if not authenticated or token invalid
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    token = authorization.split(" ")[1]
    payload = verify_token(token)

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type - expected access token")

    return payload


def get_optional_user(authorization: Optional[str] = Header(None)) -> Optional[Dict]:
    """
    FastAPI dependency to get current user if authenticated, None otherwise.
    Useful for endpoints that work both with and without auth.

    Args:
        authorization: Authorization header value (Bearer <token>)

    Returns:
        Decoded token payload or None
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None

    try:
        token = authorization.split(" ")[1]
        payload = verify_token(token)
        if payload.get("type") == "access":
            return payload
    except:
        pass

    return None
