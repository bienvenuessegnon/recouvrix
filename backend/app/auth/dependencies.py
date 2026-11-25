from __future__ import annotations

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from backend.app.auth.service import AuthContext, ensure_default_organization, validate_bearer_session
from backend.app.core.database import get_db
from backend.app.core.errors import AppError
from backend.app.services.audit_service import record_audit_event


def get_auth_context(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> AuthContext:
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError(
            "Votre session a expiré ou n’est pas valide. Veuillez vous reconnecter.",
            status_code=401,
            code="SESSION_EXPIRED",
        )

    raw_token = authorization[7:].strip()
    ctx = validate_bearer_session(db, raw_token)
    if ctx is None:
        raise AppError(
            "Votre session a expiré ou a été fermée. Veuillez vous reconnecter.",
            status_code=401,
            code="SESSION_EXPIRED",
        )
    return ctx


def require_admin(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> AuthContext:
    if ctx.user.role != "ADMIN":
        org = ensure_default_organization(db)
        record_audit_event(
            db,
            organization_id=ctx.user.organization_id or org.id,
            event_type="ACCESS_DENIED",
            category="SECURITY",
            actor_user_id=ctx.user.id,
            actor_label=ctx.user.email,
            summary="Tentative d’accès refusée à une fonction réservée aux administrateurs.",
        )
        db.commit()
        raise AppError(
            "Vous ne disposez pas des droits nécessaires pour effectuer cette opération.",
            status_code=403,
            code="FORBIDDEN",
        )
    return ctx
