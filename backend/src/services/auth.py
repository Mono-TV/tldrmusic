"""
Authentication Service - Phone and Google Auth
"""
import secrets
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple
from jose import jwt, JWTError
from passlib.context import CryptContext
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from ..config import settings, Database
from ..models import (
    User,
    UserCreate,
    AuthProvider,
    LinkedAccount,
    AuthResponse,
    PhoneAuthRequest,
    PhoneVerifyRequest,
    GoogleAuthRequest,
)
from ..utils.phone import send_otp, verify_otp

logger = logging.getLogger(__name__)

# Password hashing (for future email auth)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _doc_to_user(doc: dict) -> User:
    """Convert MongoDB document to User model, handling _id -> id conversion"""
    if doc is None:
        return None
    # Handle _id -> id conversion for legacy documents
    if "_id" in doc and "id" not in doc:
        doc["id"] = str(doc["_id"])
    # Remove _id to avoid Pydantic errors
    doc.pop("_id", None)

    # Handle name/display_name - use name if display_name not set
    if doc.get("name") and not doc.get("display_name"):
        doc["display_name"] = doc["name"]

    # Handle picture/avatar_url - use picture if avatar_url not set
    if doc.get("picture") and not doc.get("avatar_url"):
        doc["avatar_url"] = doc["picture"]

    # Remove fields not in User model (embedded arrays from old format)
    doc.pop("favorites", None)
    doc.pop("history", None)
    doc.pop("queue", None)
    doc.pop("google_id", None)
    doc.pop("last_login", None)

    return User(**doc)


async def _find_user_by_id(user_id: str) -> Optional[dict]:
    """Find user by id, checking both 'id' field and '_id' for legacy support"""
    from bson import ObjectId

    # First try the 'id' field
    user_doc = await Database.users().find_one({"id": user_id})
    if user_doc:
        return user_doc

    # Fall back to checking _id (for legacy documents)
    try:
        user_doc = await Database.users().find_one({"_id": ObjectId(user_id)})
        return user_doc
    except:
        return None


class AuthService:
    """
    Handles user authentication via Phone OTP and Google OAuth
    """

    # ============== Token Management ==============

    @staticmethod
    def create_access_token(user_id: str, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        if expires_delta is None:
            expires_delta = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

        expire = datetime.utcnow() + expires_delta
        payload = {
            "sub": user_id,
            "type": "access",
            "exp": expire,
            "iat": datetime.utcnow(),
        }
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    @staticmethod
    def create_refresh_token(user_id: str) -> str:
        """Create JWT refresh token"""
        expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
        payload = {
            "sub": user_id,
            "type": "refresh",
            "exp": expire,
            "iat": datetime.utcnow(),
            "jti": secrets.token_urlsafe(32),  # Unique token ID
        }
        return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    @staticmethod
    def verify_token(token: str, token_type: str = "access") -> Optional[str]:
        """Verify JWT token and return user_id"""
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM]
            )
            if payload.get("type") != token_type:
                return None
            return payload.get("sub")
        except JWTError as e:
            logger.warning(f"Token verification failed: {e}")
            return None

    @staticmethod
    def create_auth_response(user: User) -> AuthResponse:
        """Create authentication response with tokens"""
        access_token = AuthService.create_access_token(user.id)
        refresh_token = AuthService.create_refresh_token(user.id)

        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user,
        )

    # ============== Phone Authentication ==============

    @staticmethod
    async def request_phone_otp(request: PhoneAuthRequest) -> dict:
        """
        Request OTP for phone number

        Returns: {"message": "OTP sent", "expires_in": 300}
        """
        phone = AuthService._normalize_phone(request.phone)

        # Send OTP via configured provider (Twilio, Firebase, etc.)
        success = await send_otp(phone)

        if not success:
            raise Exception("Failed to send OTP")

        logger.info(f"OTP sent to {phone[:4]}****{phone[-2:]}")

        return {
            "message": "OTP sent successfully",
            "expires_in": 300,  # 5 minutes
        }

    @staticmethod
    async def verify_phone_otp(request: PhoneVerifyRequest) -> AuthResponse:
        """
        Verify OTP and authenticate/create user

        Returns: AuthResponse with tokens and user
        """
        phone = AuthService._normalize_phone(request.phone)

        # Verify OTP
        is_valid = await verify_otp(phone, request.otp)
        if not is_valid:
            raise ValueError("Invalid or expired OTP")

        # Find or create user
        user = await AuthService._get_or_create_user_by_phone(phone)

        logger.info(f"User authenticated via phone: {user.id}")

        return AuthService.create_auth_response(user)

    @staticmethod
    async def _get_or_create_user_by_phone(phone: str) -> User:
        """Get existing user or create new one by phone"""
        # Try to find existing user
        user_doc = await Database.users().find_one({"phone": phone})

        if user_doc:
            return _doc_to_user(user_doc)

        # Create new user
        import uuid
        user_id = str(uuid.uuid4())

        user = User(
            id=user_id,
            phone=phone,
            phone_verified=True,
            primary_auth=AuthProvider.PHONE,
            auth_providers=[
                LinkedAccount(
                    provider=AuthProvider.PHONE,
                    provider_user_id=phone,
                    phone=phone,
                )
            ],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        await Database.users().insert_one(user.model_dump())
        logger.info(f"Created new user via phone: {user_id}")

        return user

    @staticmethod
    def _normalize_phone(phone: str) -> str:
        """Normalize phone number to E.164 format"""
        # Remove spaces, dashes, etc.
        phone = "".join(c for c in phone if c.isdigit() or c == "+")

        # Add India country code if not present
        if not phone.startswith("+"):
            if phone.startswith("91") and len(phone) == 12:
                phone = "+" + phone
            elif len(phone) == 10:
                phone = "+91" + phone

        return phone

    # ============== Google Authentication ==============

    @staticmethod
    async def authenticate_google(request: GoogleAuthRequest) -> AuthResponse:
        """
        Authenticate user via Google OAuth

        Verifies the Google ID token and creates/updates user
        """
        try:
            # Verify the Google ID token
            idinfo = id_token.verify_oauth2_token(
                request.id_token,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID
            )

            # Extract user info
            google_user_id = idinfo["sub"]
            email = idinfo.get("email")
            email_verified = idinfo.get("email_verified", False)
            name = idinfo.get("name")
            picture = idinfo.get("picture")

            if not email:
                raise ValueError("Email not provided by Google")

            # Find or create user
            user = await AuthService._get_or_create_user_by_google(
                google_user_id=google_user_id,
                email=email,
                email_verified=email_verified,
                name=name,
                picture=picture,
            )

            logger.info(f"User authenticated via Google: {user.id}")

            return AuthService.create_auth_response(user)

        except ValueError as e:
            logger.error(f"Google auth failed: {e}")
            raise

    @staticmethod
    async def _get_or_create_user_by_google(
        google_user_id: str,
        email: str,
        email_verified: bool,
        name: Optional[str],
        picture: Optional[str],
    ) -> User:
        """Get existing user or create new one by Google account"""

        # Try to find by Google provider ID
        user_doc = await Database.users().find_one({
            "auth_providers.provider": "google",
            "auth_providers.provider_user_id": google_user_id,
        })

        if user_doc:
            user = _doc_to_user(user_doc)
            # Update last seen (use $or for legacy support)
            from bson import ObjectId
            try:
                await Database.users().update_one(
                    {"$or": [{"id": user.id}, {"_id": ObjectId(user.id)}]},
                    {"$set": {"last_seen_at": datetime.utcnow()}}
                )
            except:
                pass
            return user

        # Try to find by email (maybe user registered with phone first)
        user_doc = await Database.users().find_one({"email": email})

        if user_doc:
            # Link Google account to existing user
            user = _doc_to_user(user_doc)
            google_account = LinkedAccount(
                provider=AuthProvider.GOOGLE,
                provider_user_id=google_user_id,
                email=email,
            )
            user.auth_providers.append(google_account)
            user.email_verified = email_verified
            user.updated_at = datetime.utcnow()

            from bson import ObjectId
            try:
                await Database.users().update_one(
                    {"$or": [{"id": user.id}, {"_id": ObjectId(user.id)}]},
                    {"$set": user.model_dump()}
                )
            except:
                pass
            logger.info(f"Linked Google account to existing user: {user.id}")
            return user

        # Create new user
        import uuid
        user_id = str(uuid.uuid4())

        user = User(
            id=user_id,
            email=email,
            email_verified=email_verified,
            display_name=name,
            avatar_url=picture,
            primary_auth=AuthProvider.GOOGLE,
            auth_providers=[
                LinkedAccount(
                    provider=AuthProvider.GOOGLE,
                    provider_user_id=google_user_id,
                    email=email,
                )
            ],
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        await Database.users().insert_one(user.model_dump())
        logger.info(f"Created new user via Google: {user_id}")

        return user

    # ============== Token Refresh ==============

    @staticmethod
    async def refresh_access_token(refresh_token: str) -> AuthResponse:
        """
        Refresh access token using refresh token
        """
        user_id = AuthService.verify_token(refresh_token, token_type="refresh")

        if not user_id:
            raise ValueError("Invalid or expired refresh token")

        # Get user
        user_doc = await _find_user_by_id(user_id)
        if not user_doc:
            raise ValueError("User not found")

        user = _doc_to_user(user_doc)

        # Update last seen (use $or for legacy support)
        from bson import ObjectId
        try:
            await Database.users().update_one(
                {"$or": [{"id": user.id}, {"_id": ObjectId(user.id)}]},
                {"$set": {"last_seen_at": datetime.utcnow()}}
            )
        except:
            pass

        return AuthService.create_auth_response(user)

    # ============== User Lookup ==============

    @staticmethod
    async def get_current_user(token: str) -> Optional[User]:
        """Get current user from access token"""
        user_id = AuthService.verify_token(token, token_type="access")

        if not user_id:
            return None

        user_doc = await _find_user_by_id(user_id)
        if not user_doc:
            return None

        return _doc_to_user(user_doc)
