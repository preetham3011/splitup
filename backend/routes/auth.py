"""
Authentication routes

Handles Google OAuth authentication and JWT token management.
"""

import os
import jwt
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, status, Depends, Header
from pydantic import BaseModel, Field

from data.storage import create_or_get_user, get_user_by_id

# Google OAuth imports (guarded to allow running without google-auth installed)
try:
    from google.auth.transport import requests
    from google.oauth2 import id_token
    GOOGLE_AUTH_AVAILABLE = True
except ImportError:
    GOOGLE_AUTH_AVAILABLE = False
    print("WARNING: google-auth library not available, Google OAuth will not work")

router = APIRouter(prefix="/auth")


# Environment variables
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
JWT_SECRET = os.getenv("JWT_SECRET")

if not GOOGLE_CLIENT_ID:
    print("WARNING: GOOGLE_CLIENT_ID not set, Google OAuth will not work")
if not JWT_SECRET:
    print("WARNING: JWT_SECRET not set, JWT signing will not work")


# Request/Response models
class GoogleAuthRequest(BaseModel):
    """Request model for Google OAuth"""
    id_token: str = Field(..., description="Google ID token")


class AuthResponse(BaseModel):
    """Response model for authentication"""
    access_token: str
    user: dict


class UserResponse(BaseModel):
    """Response model for user info"""
    id: str
    email: str
    name: str


# JWT utilities
def create_jwt(user_id: str, email: str, expires_days: int = 7) -> str:
    """
    Create a JWT token for a user.
    
    Args:
        user_id: User ID
        email: User email
        expires_days: Token expiration in days (default: 7)
    
    Returns:
        JWT token string
    """
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET not configured")
    
    expiration = datetime.utcnow() + timedelta(days=expires_days)
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": expiration,
        "iat": datetime.utcnow()
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return token


def verify_jwt(token: str) -> dict:
    """
    Verify and decode a JWT token.
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded token payload
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    if not JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT_SECRET not configured"
        )
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


def verify_google_token(id_token_str: str) -> dict:
    """
    Verify Google ID token and extract user information.
    
    Args:
        id_token_str: Google ID token string
    
    Returns:
        Decoded token payload with user info
    
    Raises:
        HTTPException: If token is invalid
    """
    if not GOOGLE_AUTH_AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth library not available"
        )
    
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GOOGLE_CLIENT_ID not configured"
        )
    
    try:
        # Verify the token
        idinfo = id_token.verify_oauth2_token(
            id_token_str,
            requests.Request(),
            GOOGLE_CLIENT_ID
        )
        
        # Verify email is verified
        if not idinfo.get("email_verified", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email not verified by Google"
            )
        
        return idinfo
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}"
        )


# Auth dependency (required)
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    FastAPI dependency to get current authenticated user from JWT.
    
    Args:
        authorization: Authorization header (Bearer <token>)
    
    Returns:
        User dict from MongoDB
    
    Raises:
        HTTPException: If token is missing or invalid
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Extract token from "Bearer <token>"
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            raise ValueError("Invalid authorization scheme")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify JWT
    payload = verify_jwt(token)
    user_id = payload.get("user_id")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    # Load user from MongoDB
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return user


# Optional auth dependency (for backward compatibility - falls back to mock user)
async def get_current_user_optional(authorization: Optional[str] = Header(None)) -> dict:
    """
    FastAPI dependency to get current authenticated user from JWT, with fallback to mock user.
    Used for backward compatibility during migration.
    
    Returns:
        User dict from MongoDB, or mock user if no auth header
    """
    if not authorization:
        # Fallback to mock user for backward compatibility
        return {
            "id": "user_123",
            "email": "test@example.com",
            "name": "Test User",
            "provider": "mock",
            "created_at": datetime.now()
        }
    
    # Extract token from "Bearer <token>"
    try:
        scheme, token = authorization.split()
        if scheme.lower() != "bearer":
            # Fallback to mock user
            return {
                "id": "user_123",
                "email": "test@example.com",
                "name": "Test User",
                "provider": "mock",
                "created_at": datetime.now()
            }
    except ValueError:
        # Fallback to mock user
        return {
            "id": "user_123",
            "email": "test@example.com",
            "name": "Test User",
            "provider": "mock",
            "created_at": datetime.now()
        }
    
    # Try to verify JWT
    try:
        payload = verify_jwt(token)
        user_id = payload.get("user_id")
        
        if user_id:
            user = await get_user_by_id(user_id)
            if user:
                return user
    except HTTPException:
        # Token invalid, fallback to mock user
        pass
    
    # Fallback to mock user
    return {
        "id": "user_123",
        "email": "test@example.com",
        "name": "Test User",
        "provider": "mock",
        "created_at": datetime.now()
    }


# Routes
@router.post("/google", response_model=AuthResponse, status_code=status.HTTP_200_OK)
async def google_auth(auth_data: GoogleAuthRequest):
    """
    Authenticate with Google OAuth.
    
    - **id_token**: Google ID token from client
    
    Returns JWT access token and user information.
    """
    # Verify Google token
    google_user = verify_google_token(auth_data.id_token)
    
    # Extract user info
    email = google_user.get("email")
    name = google_user.get("name", email.split("@")[0])  # Fallback to email prefix if no name
    
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not found in Google token"
        )
    
    # Create or get user in MongoDB
    user = await create_or_get_user(email=email, name=name, provider="google")
    
    # Create JWT
    access_token = create_jwt(user_id=user["id"], email=user["email"])
    
    return AuthResponse(
        access_token=access_token,
        user={
            "id": user["id"],
            "email": user["email"],
            "name": user["name"]
        }
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user information.
    
    Requires valid JWT in Authorization header.
    """
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"]
    )
