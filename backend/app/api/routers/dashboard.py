from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.ai.dashboard_advisor import (
    clear_ai_advisor_cache,
    generate_dashboard_ai_advisory,
)
from backend.app.auth.dependencies import get_auth_context, require_admin
from backend.app.auth.service import AuthContext, list_org_users
from backend.app.core.database import get_db
from backend.app.models.audit import ActivityLog
from backend.app.services.audit_service import list_all_audit_events, list_recovery_events
from backend.app.services.demo_service import clear_business_portfolio, seed_demo_portfolio
from backend.app.services.financial_calc import compute_dashboard_metrics

router = APIRouter(prefix="/api", tags=["Tableau de bord"])


@router.get("/dashboard")
def get_dashboard(
    request: Request,
    period: int = Query(default=30),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    current_user = ctx.user
    period_days = period if period in (7, 90) else 30
    ref_override = getattr(request.app.state, "reference_date_override", None)
    sim_ai_unavailable = bool(getattr(request.app.state, "simulate_ai_unavailable", False))

    metrics = compute_dashboard_metrics(
        db,
        organization_id=current_user.organization_id,
        period_days=period_days,
        reference_date=ref_override,
    )

    recent_activity = (
        list_all_audit_events(db, current_user.organization_id, 12)
        if current_user.role == "ADMIN"
        else list_recovery_events(db, current_user.organization_id, 12)
    )

    ai_advisory = generate_dashboard_ai_advisory(
        metrics["priorities"],
        simulate_unavailable=sim_ai_unavailable,
    )

    ai_by_ref = {item["invoiceReference"]: item for item in ai_advisory.get("items", [])}
    enriched_priorities: list[dict[str, Any]] = []
    for priority in metrics["priorities"]:
        ai_item = ai_by_ref.get(priority["invoiceReference"])
        if ai_item and ai_advisory.get("status") == "available":
            enriched_priorities.append(
                {
                    **priority,
                    "isAiGenerated": True,
                    "aiJustification": ai_item["justification"],
                    "recommendedAction": ai_item["recommendedAction"],
                }
            )
        else:
            enriched_priorities.append(priority)

    admin_supervision = None
    if current_user.role == "ADMIN":
        users = list_org_users(db, current_user.organization_id)
        total_logs = db.execute(
            select(func.count(ActivityLog.id)).where(
                ActivityLog.organization_id == current_user.organization_id
            )
        ).scalar_one()
        admin_supervision = {
            "totalUsers": len(users),
            "activeUsers": sum(1 for u in users if u["isActive"]),
            "managerCount": sum(1 for u in users if u["role"] == "MANAGER" and u["isActive"]),
            "totalOperationsLogged": int(total_logs or 0),
            "aiAvailable": ai_advisory.get("status") == "available",
        }

    return {
        "role": current_user.role,
        "periodDays": period_days,
        "metrics": {**metrics, "priorities": enriched_priorities},
        "recentActivity": recent_activity,
        "aiAdvisory": ai_advisory,
        "adminSupervision": admin_supervision,
    }


@router.post("/dashboard/ai-refresh")
def refresh_dashboard_ai(
    request: Request,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    clear_ai_advisor_cache()
    ref_override = getattr(request.app.state, "reference_date_override", None)
    sim_ai_unavailable = bool(getattr(request.app.state, "simulate_ai_unavailable", False))
    metrics = compute_dashboard_metrics(
        db,
        organization_id=ctx.user.organization_id,
        period_days=30,
        reference_date=ref_override,
    )
    ai_advisory = generate_dashboard_ai_advisory(
        metrics["priorities"],
        force_refresh=True,
        simulate_unavailable=sim_ai_unavailable,
    )
    return {"aiAdvisory": ai_advisory}


@router.post("/demo/seed")
def seed_demo(
    request: Request,
    ctx: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    clear_ai_advisor_cache()
    ref_override = getattr(request.app.state, "reference_date_override", None)
    seed_demo_portfolio(
        db,
        organization_id=ctx.user.organization_id,
        actor_label=ctx.user.email,
        reference_date=ref_override,
    )
    return {"message": "Les données de démonstration du recouvrement ont été réinitialisées."}


@router.post("/demo/clear")
def clear_demo(
    ctx: AuthContext = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    clear_ai_advisor_cache()
    clear_business_portfolio(
        db,
        organization_id=ctx.user.organization_id,
        actor_label=ctx.user.email,
    )
    return {"message": "Les données métier ont été vidées pour vérifier le comportement à vide."}
