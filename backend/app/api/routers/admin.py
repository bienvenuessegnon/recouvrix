from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.auth.dependencies import require_admin
from backend.app.auth.service import (
    DEMO_ADMIN_EMAIL,
    DEMO_MANAGER_EMAIL,
    AuthContext,
    list_org_users,
    revoke_all_user_sessions,
    serialize_user,
    sync_env_demo_accounts,
)
from backend.app.core.config import get_settings
from backend.app.core.database import get_db
from backend.app.core.errors import AppError
from backend.app.core.security import (
    hash_password,
    is_valid_email,
    normalize_email,
    utc_now_iso,
    validate_password_strength,
)
from backend.app.models.user import User
from backend.app.schemas.auth import (
    AdminCreateUserRequest,
    AdminUpdateUserRequest,
    ResetDemoAccountsRequest,
)
from backend.app.services.audit_service import record_audit_event

router = APIRouter(prefix="/api/admin", tags=["Administration"])


@router.get("/users")
def get_users(
    ctx: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return {"users": list_org_users(db, ctx.user.organization_id)}


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(
    payload: AdminCreateUserRequest,
    ctx: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    actor = ctx.user
    full_name = payload.fullName.strip()
    email = normalize_email(payload.email)
    role = payload.role

    if len(full_name) < 2:
        raise AppError("Le nom complet doit contenir au moins 2 caractères.", status_code=400)
    if not is_valid_email(email):
        raise AppError("Veuillez saisir une adresse e-mail professionnelle valide.", status_code=400)
    if role not in ("ADMIN", "MANAGER"):
        raise AppError("Le rôle sélectionné n’est pas autorisé.", status_code=400)

    pw_err = validate_password_strength(payload.password)
    if pw_err:
        raise AppError(pw_err, status_code=400)

    existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if existing is not None:
        raise AppError("Un compte utilisateur existe déjà avec cette adresse e-mail.", status_code=409)

    now_iso = utc_now_iso()
    user = User(
        id=str(uuid.uuid4()),
        organization_id=actor.organization_id,
        email=email,
        full_name=full_name,
        role=role,
        password_hash=hash_password(payload.password),
        is_active=1,
        is_demo=0,
        created_at=now_iso,
        updated_at=now_iso,
        last_login_at=None,
    )
    db.add(user)
    record_audit_event(
        db,
        organization_id=actor.organization_id,
        event_type="USER_CREATED",
        category="SECURITY",
        actor_user_id=actor.id,
        actor_label=actor.email,
        target_user_id=user.id,
        target_label=email,
        summary=f"Création du compte {email} avec le rôle {'Administrateur' if role == 'ADMIN' else 'Gestionnaire'}.",
        created_at=now_iso,
    )
    db.commit()
    return {"user": serialize_user(user)}


@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    payload: AdminUpdateUserRequest,
    ctx: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    actor = ctx.user
    target = db.execute(
        select(User).where(
            User.id == user_id,
            User.organization_id == actor.organization_id,
        )
    ).scalar_one_or_none()
    if target is None:
        raise AppError("Compte utilisateur introuvable.", status_code=404)

    current_role = target.role
    current_active = target.is_active == 1
    current_name = target.full_name

    next_full_name = payload.fullName.strip() if payload.fullName is not None else current_name
    if len(next_full_name) < 2:
        raise AppError("Le nom complet doit contenir au moins 2 caractères.", status_code=400)

    next_role = current_role
    if payload.role is not None:
        if payload.role not in ("ADMIN", "MANAGER"):
            raise AppError("Rôle invalide.", status_code=400)
        next_role = payload.role

    next_active = current_active if payload.isActive is None else payload.isActive

    if target.id == actor.id and not next_active:
        raise AppError(
            "Vous ne pouvez pas désactiver votre propre compte administrateur connecté.",
            status_code=400,
        )
    if target.id == actor.id and next_role != "ADMIN":
        raise AppError(
            "Vous ne pouvez pas rétrograder votre propre rôle administrateur.",
            status_code=400,
        )

    now_iso = utc_now_iso()
    target.full_name = next_full_name
    target.role = next_role
    target.is_active = 1 if next_active else 0
    target.updated_at = now_iso

    if current_role != next_role:
        record_audit_event(
            db,
            organization_id=actor.organization_id,
            event_type="USER_ROLE_CHANGED",
            category="SECURITY",
            actor_user_id=actor.id,
            actor_label=actor.email,
            target_user_id=target.id,
            target_label=target.email,
            summary=f"Rôle modifié pour {target.email} : {'Administrateur' if next_role == 'ADMIN' else 'Gestionnaire'}.",
            created_at=now_iso,
        )

    if current_active != next_active:
        if not next_active:
            revoke_all_user_sessions(db, target.id)
        record_audit_event(
            db,
            organization_id=actor.organization_id,
            event_type="USER_STATUS_CHANGED",
            category="SECURITY",
            actor_user_id=actor.id,
            actor_label=actor.email,
            target_user_id=target.id,
            target_label=target.email,
            summary=(
                f"Réactivation du compte {target.email}."
                if next_active
                else f"Désactivation du compte {target.email} et révocation des sessions actives."
            ),
            created_at=now_iso,
        )

    if current_role == next_role and current_active == next_active and next_full_name != current_name:
        record_audit_event(
            db,
            organization_id=actor.organization_id,
            event_type="USER_UPDATED",
            category="SECURITY",
            actor_user_id=actor.id,
            actor_label=actor.email,
            target_user_id=target.id,
            target_label=target.email,
            summary=f"Mise à jour des informations de {target.email}.",
            created_at=now_iso,
        )

    db.commit()
    return {"user": serialize_user(target)}


@router.post("/users/reset-demo")
def reset_demo_accounts(
    payload: ResetDemoAccountsRequest,
    ctx: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    actor = ctx.user
    settings = get_settings()

    if settings.demo_admin_password and settings.demo_manager_password:
        sync_env_demo_accounts(db)
        record_audit_event(
            db,
            organization_id=actor.organization_id,
            event_type="DEMO_ACCOUNTS_RESET",
            category="SECURITY",
            actor_user_id=actor.id,
            actor_label=actor.email,
            summary="Réinitialisation des comptes de présentation depuis la configuration serveur.",
        )
        db.commit()
        return {
            "message": "Les comptes de présentation ont été réinitialisés sans doublon.",
            "users": list_org_users(db, actor.organization_id),
        }

    admin_err = validate_password_strength(payload.adminPassword)
    if admin_err:
        raise AppError(f"Administrateur : {admin_err}", status_code=400)
    manager_err = validate_password_strength(payload.managerPassword)
    if manager_err:
        raise AppError(f"Gestionnaire : {manager_err}", status_code=400)

    now_iso = utc_now_iso()
    for email, full_name, role, pw in (
        (DEMO_ADMIN_EMAIL, "Administrateur Recouvrix", "ADMIN", payload.adminPassword),
        (DEMO_MANAGER_EMAIL, "Gestionnaire Recouvrix", "MANAGER", payload.managerPassword),
    ):
        existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        pw_hash = hash_password(pw)
        if existing is None:
            db.add(
                User(
                    id=str(uuid.uuid4()),
                    organization_id=actor.organization_id,
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
            existing.full_name = full_name
            existing.role = role
            existing.password_hash = pw_hash
            existing.is_active = 1
            existing.is_demo = 1
            existing.updated_at = now_iso

    record_audit_event(
        db,
        organization_id=actor.organization_id,
        event_type="DEMO_ACCOUNTS_RESET",
        category="SECURITY",
        actor_user_id=actor.id,
        actor_label=actor.email,
        summary="Réinitialisation sécurisée des comptes de présentation effectuée sans doublon.",
        created_at=now_iso,
    )
    db.commit()

    return {
        "message": "Les comptes de présentation ont été réinitialisés sans doublon.",
        "users": list_org_users(db, actor.organization_id),
    }
