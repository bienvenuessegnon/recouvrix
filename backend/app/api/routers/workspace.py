from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.auth.dependencies import get_auth_context
from backend.app.auth.service import AuthContext, list_org_users
from backend.app.core.database import get_db
from backend.app.services.audit_service import list_all_audit_events, list_user_audit_events

router = APIRouter(prefix="/api/workspace", tags=["Espace de travail"])


@router.get("/overview")
def get_overview(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    current_user = ctx.user
    if current_user.role == "ADMIN":
        users = list_org_users(db, current_user.organization_id)
        active_users = sum(1 for u in users if u["isActive"])
        manager_count = sum(1 for u in users if u["role"] == "MANAGER" and u["isActive"])
        recent_events = list_all_audit_events(db, current_user.organization_id, 10)
        return {
            "workspace": "ADMIN_SUPERVISION",
            "summary": {
                "totalUsers": len(users),
                "activeUsers": active_users,
                "managerCount": manager_count,
                "recentEventCount": len(recent_events),
            },
        }

    return {
        "workspace": "MANAGER_OPERATIONS",
        "summary": {
            "roleLabel": "Gestionnaire de recouvrement",
            "authorizedModules": [
                "Tableau de bord",
                "Clients",
                "Factures et créances",
                "Importation",
                "Relances",
                "Paiements",
                "Historique",
            ],
        },
    }


@router.get("/activity-logs")
def get_activity_logs(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    current_user = ctx.user
    logs = (
        list_all_audit_events(db, current_user.organization_id, 100)
        if current_user.role == "ADMIN"
        else list_user_audit_events(db, current_user.organization_id, current_user.id, 50)
    )
    return {"logs": logs}
