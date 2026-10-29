"""Authentication API router."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    limiter = Limiter(key_func=get_remote_address)
except ImportError:
    class DummyLimiter:
        def __init__(self, *args, **kwargs):
            pass
        def limit(self, *args, **kwargs):
            def decorator(func):
                return func
            return decorator
    limiter = DummyLimiter()

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.db.models.user import User
from app.db.session import get_session
from app.schemas.auth import (
    LoginDirectResponse,
    LoginRequest,
    LoginResponse,
    MeResponse,
    RefreshRequest,
    TokenResponse,
    VerifyOtpRequest,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/login", response_model=LoginResponse | LoginDirectResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def login(
    request: Request,
    body: LoginRequest,
    session: AsyncSession = Depends(get_session),
):
    ip = request.client.host if request.client else None
    result = await AuthService.login(
        session=session,
        email=body.email,
        password=body.password,
        ip_address=ip,
    )

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=result["error"],
        )

    return result


@router.post("/verify-otp", response_model=TokenResponse)
@limiter.limit(settings.RATE_LIMIT_AUTH)
async def verify_otp_endpoint(
    request: Request,
    body: VerifyOtpRequest,
    session: AsyncSession = Depends(get_session),
):
    ip = request.client.host if request.client else None
    result = await AuthService.verify_otp_challenge(
        session=session,
        challenge_id=body.challenge_id,
        otp=body.otp,
        ip_address=ip,
    )

    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=result["error"],
        )

    return result


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token_endpoint(
    body: RefreshRequest,
    session: AsyncSession = Depends(get_session),
):
    result = await AuthService.refresh(session, body.refresh_token)
    if "error" in result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=result["error"],
        )
    return result


@router.post("/logout")
async def logout(
    body: RefreshRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    success = await AuthService.logout(session, body.refresh_token, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to revoke token",
        )
    return {"status": "logged_out"}


@router.get("/me", response_model=MeResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return MeResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        institution_id=current_user.institution_id,
        is_active=current_user.is_active,
    )
