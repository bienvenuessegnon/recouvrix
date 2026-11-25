from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from backend.app.auth.dependencies import get_auth_context
from backend.app.auth.service import (
    AuthContext,
    authenticate_user,
    bootstrap_presentation_accounts,
    has_any_admin,
    revoke_session,
    serialize_user,
)
from backend.app.core.config import get_settings
from backend.app.core.database import get_db
from backend.app.schemas.auth import (
    AuthStatusOut,
    BootstrapRequest,
    LoginRequest,
    LoginResponseOut,
    MeResponseOut,
)

router = APIRouter(prefix="/api/auth", tags=["Authentification"])


@router.get("/status", response_model=AuthStatusOut)
def auth_status(db: Session = Depends(get_db)) -> dict[str, bool]:
    settings = get_settings()
    env_configured = bool(settings.demo_admin_password and settings.demo_manager_password)
    return {
        "requiresInitialSetup": not has_any_admin(db),
        "envDemoConfigured": env_configured,
    }


@router.post("/bootstrap", status_code=status.HTTP_201_CREATED)
def bootstrap_accounts(
    payload: BootstrapRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    bootstrap_presentation_accounts(db, payload.adminPassword, payload.managerPassword)
    return {"message": "Les comptes de présentation ont été initialisés de manière sécurisée."}


@router.post("/login", response_model=LoginResponseOut)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    client_ip = forwarded_for or (request.client.host if request.client else "127.0.0.1")
    ttl_override = getattr(request.app.state, "session_ttl_seconds", None)
    return authenticate_user(
        db,
        email_input=payload.email,
        password_input=payload.password,
        client_ip=client_ip,
        session_ttl_seconds=ttl_override,
    )


@router.post("/logout")
def logout(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    revoke_session(db, ctx.session_id, ctx.user)
    return {"message": "Vous avez été déconnecté."}


@router.get("/me", response_model=MeResponseOut)
def get_me(ctx: AuthContext = Depends(get_auth_context)) -> dict[str, object]:
    return {
        "user": serialize_user(ctx.user),
        "expiresAt": ctx.expires_at,
    }
