"""
Authentication routes for LeadFlow AI
Handles Email/Password and Google OAuth authentication
"""
import os
import httpx
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User, UserSession
from utils.auth import (
    hash_password, 
    verify_password, 
    create_jwt_token, 
    generate_session_token
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ─── Pydantic Schemas ────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class GoogleCallbackRequest(BaseModel):
    session_id: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str | None
    picture: str | None
    auth_provider: str
    created_at: datetime

class AuthResponse(BaseModel):
    user: UserResponse
    token: str


# ─── Helper Functions ────────────────────────────────────────────────────────────

async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    """Extract and validate user from JWT token or session cookie"""
    token = None
    
    # Check cookie first
    token = request.cookies.get("session_token")
    
    # Then check Authorization header
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        # Check if it's a session token (from OAuth)
        result = await db.execute(
            select(UserSession).where(UserSession.session_token == token)
        )
        session = result.scalar_one_or_none()
        
        if session:
            # Validate expiry
            expires_at = session.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < datetime.now(timezone.utc):
                raise HTTPException(status_code=401, detail="Session expired")
            
            # Get user
            result = await db.execute(select(User).where(User.id == session.user_id))
            user = result.scalar_one_or_none()
            if not user:
                raise HTTPException(status_code=401, detail="User not found")
            return user
        
        # Otherwise it's a JWT token
        from utils.auth import decode_jwt_token
        payload = decode_jwt_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        result = await db.execute(select(User).where(User.id == payload["sub"]))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except HTTPException:
        raise
    except Exception as e:
        # Database not configured or other error
        raise HTTPException(status_code=401, detail="Authentication failed")


# ─── Routes ──────────────────────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user with email/password"""
    # Check if user exists
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        auth_provider='email'
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Create token
    token = create_jwt_token(user.id, user.email)
    
    return AuthResponse(
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            picture=user.picture,
            auth_provider=user.auth_provider,
            created_at=user.created_at
        ),
        token=token
    )


@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """Login with email/password"""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    
    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create JWT token
    token = create_jwt_token(user.id, user.email)
    
    # Also create session for cookie
    session_token = generate_session_token()
    session = UserSession(
        user_id=user.id,
        session_token=session_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db.add(session)
    await db.commit()
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7*24*60*60,
        path="/"
    )
    
    return AuthResponse(
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            picture=user.picture,
            auth_provider=user.auth_provider,
            created_at=user.created_at
        ),
        token=token
    )


@router.post("/google/callback")
async def google_callback(data: GoogleCallbackRequest, response: Response, db: AsyncSession = Depends(get_db)):
    """
    Handle Google OAuth callback from Emergent Auth
    Frontend redirects here after receiving session_id from Emergent Auth
    """
    # Exchange session_id for user data with Emergent Auth
    emergent_auth_url = os.environ.get('EMERGENT_AUTH_URL', 'https://demobackend.emergentagent.com')
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(
                f"{emergent_auth_url}/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": data.session_id},
                timeout=10.0
            )
            if res.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session_id")
            
            auth_data = res.json()
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Failed to validate session: {str(e)}")
    
    email = auth_data.get("email")
    name = auth_data.get("name")
    picture = auth_data.get("picture")
    google_id = auth_data.get("id")
    
    # Find or create user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user:
        # Create new user
        user = User(
            email=email,
            full_name=name,
            picture=picture,
            google_id=google_id,
            auth_provider='google'
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Update existing user with Google info if needed
        if not user.google_id:
            user.google_id = google_id
        user.picture = picture
        user.full_name = name or user.full_name
        await db.commit()
        await db.refresh(user)
    
    # Create session
    session_token = generate_session_token()
    session = UserSession(
        user_id=user.id,
        session_token=session_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db.add(session)
    await db.commit()
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7*24*60*60,
        path="/"
    )
    
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "picture": user.picture,
            "auth_provider": user.auth_provider
        },
        "token": session_token
    }


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user"""
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        picture=user.picture,
        auth_provider=user.auth_provider,
        created_at=user.created_at
    )


@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Logout current user"""
    token = request.cookies.get("session_token")
    if token:
        # Delete session from database
        result = await db.execute(
            select(UserSession).where(UserSession.session_token == token)
        )
        session = result.scalar_one_or_none()
        if session:
            await db.delete(session)
            await db.commit()
    
    # Clear cookie
    response.delete_cookie(key="session_token", path="/")
    
    return {"message": "Logged out successfully"}
