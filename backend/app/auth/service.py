from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import time
from typing import Any
import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.core.errors import AppError
from backend.app.core.security import (
    generate_raw_token,
    hash_password,
    hash_session_token,
    is_valid_email,
    normalize_email,
    utc_now_iso,
    validate_password_strength,
    verify_password,
)
from backend.app.models.organization import Organization
from backend.app.models.user import LoginAttempt, User, UserSession
from backend.app.services.audit_service import record_audit_event
from backend.app.services.demo_service import seed_demo_portfolio

DEMO_ADMIN_EMAIL = "admin@recouvrix.demo"
DEMO_MANAGER_EMAIL = "gestionnaire@recouvrix.demo"

MAX_FAILED_ATTEMPTS = 5
ATTEMPT_WINDOW_MS = 10 * 60 * 1000
LOCK_DURATION_MS = 5 * 60 * 1000


@dataclass
class AuthContext:
    session_id: str
    expires_at: str
    user: User


def serialize_user(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "organizationId": user.organization_id,
        "email": user.email,
        "fullName": user.full_name,
        "role": user.role,
        "isActive": user.is_active == 1,
        "isDemo": user.is_demo == 1,
        "createdAt": user.created_at,
        "updatedAt": user.updated_at,
        "lastLoginAt": user.last_login_at,
    }


def ensure_default_organization(db: Session) -> Organization:
    settings = get_settings()
    org = db.get(Organization, settings.default_org_id)
    if org is not None:
        return org
    now_iso = utc_now_iso()
    org = Organization(
        id=settings.default_org_id,
        name=settings.default_org_name,
        slug="recouvrix-default",
        currency="XOF",
        default_payment_terms_days=30,
        created_at=now_iso,
        updated_at=now_iso,
    )
    db.add(org)
    db.flush()
    return org


def has_any_admin(db: Session) -> bool:
    row = db.execute(
        select(User.id).where(User.role == "ADMIN").limit(1)
    ).scalar_one_or_none()
    return row is not None


def sync_env_demo_accounts(db: Session) -> None:
    settings = get_settings()
    env_admin_pass = settings.demo_admin_password
    env_manager_pass = settings.demo_manager_password
    if not env_admin_pass and not env_manager_pass:
        return

    org = ensure_default_organization(db)
    now_iso = utc_now_iso()

    def _upsert_demo(email: str, full_name: str, role: str, password: str) -> None:
        existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        pw_hash = hash_password(password)
        if existing is None:
            db.add(
                User(
                    id=str(uuid.uuid4()),
                    organization_id=org.id,
                    email=email,
                    full_name=full_name,
                    role=role,
                    password_hash=pw_hash,
                    is_active=1,
                    is_demo=1,
                    created_at=now_iso,
                    updated_at=now_iso,
                )
            )
        else:
            existing.password_hash = pw_hash
            existing.role = role
            existing.is_active = 1
            existing.is_demo = 1
            existing.updated_at = now_iso

    if env_admin_pass:
        _upsert_demo(DEMO_ADMIN_EMAIL, "Administrateur Recouvrix", "ADMIN", env_admin_pass)
    if env_manager_pass:
        _upsert_demo(DEMO_MANAGER_EMAIL, "Gestionnaire Recouvrix", "MANAGER", env_manager_pass)
    db.commit()

    seed_demo_portfolio(db, organization_id=org.id, only_if_never_seeded=True)


def bootstrap_presentation_accounts(
    db: Session,
    admin_password: str,
    manager_password: str,
) -> None:
    if has_any_admin(db):
        raise AppError("L’initialisation des comptes a déjà été effectuée.", status_code=409)

    admin_err = validate_password_strength(admin_password)
    if admin_err:
        raise AppError(f"Administrateur : {admin_err}", status_code=400)

    manager_err = validate_password_strength(manager_password)
    if manager_err:
        raise AppError(f"Gestionnaire : {manager_err}", status_code=400)

    org = ensure_default_organization(db)
    now_iso = utc_now_iso()

    try:
        if has_any_admin(db):
            raise AppError("L’initialisation des comptes a déjà été effectuée.", status_code=409)

        for email, full_name, role, pw in (
            (DEMO_ADMIN_EMAIL, "Administrateur Recouvrix", "ADMIN", admin_password),
            (DEMO_MANAGER_EMAIL, "Gestionnaire Recouvrix", "MANAGER", manager_password),
        ):
            pw_hash = hash_password(pw)
            existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
            if existing is None:
                db.add(
                    User(
                        id=str(uuid.uuid4()),
                        organization_id=org.id,
                        email=email,
                        full_name=full_name,
                        role=role,
                        password_hash=pw_hash,
                        is_active=1,
                        is_demo=1,
                        created_at=now_iso,
                        updated_at=now_iso,
                    )
                )
            else:
                existing.password_hash = pw_hash
                existing.role = role
                existing.is_active = 1
                existing.is_demo = 1
                existing.updated_at = now_iso

        record_audit_event(
            db,
            organization_id=org.id,
            event_type="BOOTSTRAP_SETUP",
            category="SECURITY",
            actor_label="Initialisation système",
            summary="Initialisation sécurisée des comptes de présentation Administrateur et Gestionnaire.",
            created_at=now_iso,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    seed_demo_portfolio(db, organization_id=org.id, only_if_never_seeded=True)


def _check_rate_limit(db: Session, attempt_key: str) -> bool:
    now_ms = int(time.time() * 1000)
    row = db.get(LoginAttempt, attempt_key)
    if row is None:
        return False
    if row.locked_until is not None and row.locked_until > now_ms:
        return True
    if now_ms - row.first_failure_at > ATTEMPT_WINDOW_MS:
        db.execute(delete(LoginAttempt).where(LoginAttempt.attempt_key == attempt_key))
        db.commit()
    return False


def _record_failed_attempt(db: Session, attempt_key: str) -> None:
    now_ms = int(time.time() * 1000)
    row = db.get(LoginAttempt, attempt_key)
    if row is None or (now_ms - row.first_failure_at) > ATTEMPT_WINDOW_MS:
        if row is None:
            db.add(
                LoginAttempt(
                    attempt_key=attempt_key,
                    failures=1,
                    first_failure_at=now_ms,
                    locked_until=None,
                )
            )
        else:
            row.failures = 1
            row.first_failure_at = now_ms
            row.locked_until = None
        return

    next_failures = row.failures + 1
    row.failures = next_failures
    row.locked_until = now_ms + LOCK_DURATION_MS if next_failures >= MAX_FAILED_ATTEMPTS else None


def _clear_failed_attempts(db: Session, keys: list[str]) -> None:
    db.execute(delete(LoginAttempt).where(LoginAttempt.attempt_key.in_(keys)))


def authenticate_user(
    db: Session,
    *,
    email_input: str,
    password_input: str,
    client_ip: str,
    session_ttl_seconds: int | None = None,
) -> dict[str, Any]:
    norm_email = normalize_email(email_input)
    if not norm_email or not password_input:
        raise AppError("Veuillez saisir votre adresse e-mail et votre mot de passe.", status_code=400)
    if not is_valid_email(norm_email):
        raise AppError("Veuillez saisir une adresse e-mail valide.", status_code=400)

    ip_key = f"ip:{client_ip}"
    combo_key = f"acct:{client_ip}:{norm_email}"

    default_org = ensure_default_organization(db)

    if _check_rate_limit(db, combo_key) or _check_rate_limit(db, ip_key):
        record_audit_event(
            db,
            organization_id=default_org.id,
            event_type="LOGIN_FAILED",
            category="SECURITY",
            actor_label=norm_email or "Visiteur",
            summary="Tentative de connexion bloquée temporairement suite à des essais répétés.",
        )
        db.commit()
        raise AppError(
            "Trop de tentatives de connexion. Veuillez patienter quelques minutes avant de réessayer.",
            status_code=429,
        )

    user = db.execute(select(User).where(User.email == norm_email)).scalar_one_or_none()
    if user is None or not verify_password(password_input, user.password_hash):
        _record_failed_attempt(db, combo_key)
        _record_failed_attempt(db, ip_key)
        record_audit_event(
            db,
            organization_id=user.organization_id if user else default_org.id,
            event_type="LOGIN_FAILED",
            category="SECURITY",
            actor_label=norm_email or "Inconnu",
            summary="Échec de connexion : identifiants incorrects.",
        )
        db.commit()
        raise AppError("Adresse e-mail ou mot de passe incorrect.", status_code=401)

    if user.is_active != 1:
        record_audit_event(
            db,
            organization_id=user.organization_id,
            event_type="LOGIN_FAILED",
            category="SECURITY",
            actor_user_id=user.id,
            actor_label=user.email,
            target_user_id=user.id,
            target_label=user.email,
            summary="Connexion refusée : le compte utilisateur est désactivé.",
        )
        db.commit()
        raise AppError(
            "Ce compte est désactivé. Veuillez contacter un administrateur.",
            status_code=403,
        )

    _clear_failed_attempts(db, [combo_key, ip_key])

    raw_token = generate_raw_token()
    token_hash = hash_session_token(raw_token)
    ttl_seconds = (
        session_ttl_seconds
        if session_ttl_seconds is not None and session_ttl_seconds > 0
        else get_settings().session_ttl_minutes * 60
    )
    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.isoformat().replace("+00:00", "Z")
    expires_at = (now_dt + timedelta(seconds=ttl_seconds)).isoformat().replace("+00:00", "Z")

    session_row = UserSession(
        id=str(uuid.uuid4()),
        token_hash=token_hash,
        user_id=user.id,
        created_at=now_iso,
        expires_at=expires_at,
        revoked_at=None,
    )
    user.last_login_at = now_iso
    user.updated_at = now_iso

    db.add(session_row)
    record_audit_event(
        db,
        organization_id=user.organization_id,
        event_type="LOGIN_SUCCESS",
        category="SECURITY",
        actor_user_id=user.id,
        actor_label=user.email,
        summary=f"Connexion réussie ({'Administrateur' if user.role == 'ADMIN' else 'Gestionnaire'}).",
        created_at=now_iso,
    )
    db.commit()

    return {
        "token": raw_token,
        "expiresAt": expires_at,
        "user": serialize_user(user),
    }


def validate_bearer_session(db: Session, raw_token: str) -> AuthContext | None:
    if not raw_token or len(raw_token) < 16:
        return None
    token_hash = hash_session_token(raw_token)
    row = db.execute(
        select(UserSession, User)
        .join(User, User.id == UserSession.user_id)
        .where(UserSession.token_hash == token_hash)
    ).first()
    if row is None:
        return None

    sess, user = row
    if sess.revoked_at is not None or user.is_active != 1:
        return None

    try:
        exp_dt = datetime.fromisoformat(sess.expires_at.replace("Z", "+00:00"))
    except ValueError:
        return None
    if exp_dt <= datetime.now(timezone.utc):
        return None

    return AuthContext(session_id=sess.id, expires_at=sess.expires_at, user=user)


def revoke_session(db: Session, session_id: str, actor: User) -> None:
    now_iso = utc_now_iso()
    sess = db.get(UserSession, session_id)
    if sess is not None and sess.revoked_at is None:
        sess.revoked_at = now_iso
    record_audit_event(
        db,
        organization_id=actor.organization_id,
        event_type="LOGOUT",
        category="SECURITY",
        actor_user_id=actor.id,
        actor_label=actor.email,
        summary="Déconnexion effectuée par l’utilisateur.",
        created_at=now_iso,
    )
    db.commit()


def revoke_all_user_sessions(db: Session, user_id: str) -> None:
    now_iso = utc_now_iso()
    sessions = (
        db.execute(
            select(UserSession).where(
                UserSession.user_id == user_id,
                UserSession.revoked_at.is_(None),
            )
        )
        .scalars()
        .all()
    )
    for sess in sessions:
        sess.revoked_at = now_iso


def list_org_users(db: Session, organization_id: str) -> list[dict[str, Any]]:
    users = (
        db.execute(
            select(User)
            .where(User.organization_id == organization_id)
            .order_by(User.created_at.asc())
        )
        .scalars()
        .all()
    )
    return [serialize_user(u) for u in users]
