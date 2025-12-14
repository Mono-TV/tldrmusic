"""
Phone OTP Utilities - Twilio/Firebase integration
"""
import logging
import secrets
from typing import Optional
from datetime import datetime, timedelta

from ..config import settings

logger = logging.getLogger(__name__)

# In-memory OTP store (replace with Redis in production)
_otp_store: dict = {}


async def send_otp(phone: str) -> bool:
    """
    Send OTP to phone number

    Uses configured provider (Twilio, Firebase, MSG91)
    """
    provider = settings.PHONE_AUTH_PROVIDER

    if provider == "twilio":
        return await _send_otp_twilio(phone)
    elif provider == "firebase":
        return await _send_otp_firebase(phone)
    elif provider == "mock":
        return await _send_otp_mock(phone)
    else:
        logger.error(f"Unknown phone auth provider: {provider}")
        return False


async def verify_otp(phone: str, otp: str) -> bool:
    """
    Verify OTP for phone number
    """
    provider = settings.PHONE_AUTH_PROVIDER

    if provider == "twilio":
        return await _verify_otp_twilio(phone, otp)
    elif provider == "firebase":
        return await _verify_otp_firebase(phone, otp)
    elif provider == "mock":
        return await _verify_otp_mock(phone, otp)
    else:
        logger.error(f"Unknown phone auth provider: {provider}")
        return False


# ============== Twilio Implementation ==============

async def _send_otp_twilio(phone: str) -> bool:
    """Send OTP via Twilio Verify"""
    try:
        from twilio.rest import Client

        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

        verification = client.verify.v2.services(
            settings.TWILIO_VERIFY_SERVICE_SID
        ).verifications.create(
            to=phone,
            channel="sms"
        )

        logger.info(f"Twilio OTP sent: status={verification.status}")
        return verification.status == "pending"

    except Exception as e:
        logger.error(f"Twilio send OTP failed: {e}")
        return False


async def _verify_otp_twilio(phone: str, otp: str) -> bool:
    """Verify OTP via Twilio Verify"""
    try:
        from twilio.rest import Client

        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

        verification_check = client.verify.v2.services(
            settings.TWILIO_VERIFY_SERVICE_SID
        ).verification_checks.create(
            to=phone,
            code=otp
        )

        logger.info(f"Twilio OTP verify: status={verification_check.status}")
        return verification_check.status == "approved"

    except Exception as e:
        logger.error(f"Twilio verify OTP failed: {e}")
        return False


# ============== Firebase Implementation ==============

async def _send_otp_firebase(phone: str) -> bool:
    """
    Firebase phone auth is client-side
    Server just validates the ID token after client verification
    """
    # Firebase phone auth is handled on client
    # This is a placeholder - actual verification happens via ID token
    logger.info(f"Firebase phone auth initiated for {phone}")
    return True


async def _verify_otp_firebase(phone: str, otp: str) -> bool:
    """
    For Firebase, the OTP is actually the Firebase ID token
    Verify it server-side
    """
    try:
        import firebase_admin
        from firebase_admin import auth

        # Initialize Firebase if not already done
        if not firebase_admin._apps:
            cred = firebase_admin.credentials.Certificate({
                "project_id": settings.FIREBASE_PROJECT_ID,
                "private_key": settings.FIREBASE_PRIVATE_KEY,
                "client_email": settings.FIREBASE_CLIENT_EMAIL,
            })
            firebase_admin.initialize_app(cred)

        # Verify the ID token
        decoded_token = auth.verify_id_token(otp)  # otp is actually ID token
        token_phone = decoded_token.get("phone_number")

        if token_phone == phone:
            return True
        else:
            logger.warning(f"Phone mismatch: expected {phone}, got {token_phone}")
            return False

    except Exception as e:
        logger.error(f"Firebase verify failed: {e}")
        return False


# ============== Mock Implementation (Development) ==============

async def _send_otp_mock(phone: str) -> bool:
    """
    Mock OTP for development/testing
    Always uses OTP: 123456
    """
    otp = "123456"  # Fixed OTP for testing
    expires_at = datetime.utcnow() + timedelta(minutes=5)

    _otp_store[phone] = {
        "otp": otp,
        "expires_at": expires_at,
    }

    logger.info(f"[MOCK] OTP for {phone}: {otp}")
    return True


async def _verify_otp_mock(phone: str, otp: str) -> bool:
    """
    Mock OTP verification for development
    """
    stored = _otp_store.get(phone)

    if not stored:
        logger.warning(f"[MOCK] No OTP found for {phone}")
        return False

    if datetime.utcnow() > stored["expires_at"]:
        logger.warning(f"[MOCK] OTP expired for {phone}")
        del _otp_store[phone]
        return False

    if stored["otp"] == otp:
        del _otp_store[phone]
        logger.info(f"[MOCK] OTP verified for {phone}")
        return True

    logger.warning(f"[MOCK] Invalid OTP for {phone}")
    return False
