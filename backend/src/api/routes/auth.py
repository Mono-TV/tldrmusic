"""
Authentication API Routes
"""
from fastapi import APIRouter, HTTPException, status

from ...models import (
    PhoneAuthRequest,
    PhoneVerifyRequest,
    GoogleAuthRequest,
    AuthResponse,
    TokenRefreshRequest,
)
from ...services.auth import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/phone/request", response_model=dict)
async def request_phone_otp(request: PhoneAuthRequest):
    """
    Request OTP for phone authentication

    Send a one-time password to the provided phone number.
    """
    try:
        result = await AuthService.request_phone_otp(request)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/phone/verify", response_model=AuthResponse)
async def verify_phone_otp(request: PhoneVerifyRequest):
    """
    Verify OTP and authenticate

    Verify the OTP sent to phone number. Returns access and refresh tokens.
    Creates a new user account if one doesn't exist.
    """
    try:
        return await AuthService.verify_phone_otp(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/google", response_model=AuthResponse)
async def authenticate_google(request: GoogleAuthRequest):
    """
    Authenticate with Google

    Exchange Google ID token for access and refresh tokens.
    Creates a new user account or links to existing one.
    """
    try:
        return await AuthService.authenticate_google(request)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(request: TokenRefreshRequest):
    """
    Refresh access token

    Use refresh token to get a new access token.
    """
    try:
        return await AuthService.refresh_access_token(request.refresh_token)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e)
        )
