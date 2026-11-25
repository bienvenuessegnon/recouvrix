from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from backend.app.core.security import utc_now_iso
from backend.app.models.audit import ActivityLog


def record_audit_event(
    db: Session,
    *,
    organization_id: str,
    event_type: str,
    actor_label: str,
    summary: str,
    category: str = "SECURITY",
    actor_user_id: str | None = None,
    target_user_id: str | None = None,
    target_label: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    created_at: str | None = None,
) -> ActivityLog:
    entry = ActivityLog(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        event_type=event_type,
        category=category,
        actor_user_id=actor_user_id,
        actor_label=actor_label,
        target_user_id=target_user_id,
        target_label=target_label,
        entity_type=entity_type,
        entity_id=entity_id,
        summary=summary,
        created_at=created_at or utc_now_iso(),
    )
    db.add(entry)
    return entry


def serialize_audit_log(row: ActivityLog) -> dict[str, Any]:
    return {
        "id": row.id,
        "eventType": row.event_type,
        "category": row.category,
        "actorUserId": row.actor_user_id,
        "actorLabel": row.actor_label,
        "targetUserId": row.target_user_id,
        "targetLabel": row.target_label,
        "entityType": row.entity_type,
        "entityId": row.entity_id,
        "summary": row.summary,
        "createdAt": row.created_at,
    }


def list_all_audit_events(db: Session, organization_id: str, limit: int = 80) -> list[dict[str, Any]]:
    rows = (
        db.execute(
            select(ActivityLog)
            .where(ActivityLog.organization_id == organization_id)
            .order_by(desc(ActivityLog.created_at))
            .limit(limit)
        )
        .scalars()
        .all()
    )
    return [serialize_audit_log(row) for row in rows]


def list_recovery_events(db: Session, organization_id: str, limit: int = 20) -> list[dict[str, Any]]:
    rows = (
        db.execute(
            select(ActivityLog)
            .where(
                ActivityLog.organization_id == organization_id,
                ActivityLog.category == "RECOVERY",
            )
            .order_by(desc(ActivityLog.created_at))
            .limit(limit)
        )
        .scalars()
        .all()
    )
    return [serialize_audit_log(row) for row in rows]


def list_user_audit_events(
    db: Session,
    organization_id: str,
    user_id: str,
    limit: int = 50,
) -> list[dict[str, Any]]:
    rows = (
        db.execute(
            select(ActivityLog)
            .where(
                ActivityLog.organization_id == organization_id,
                (
                    (ActivityLog.actor_user_id == user_id)
                    | (ActivityLog.target_user_id == user_id)
                    | (ActivityLog.category == "RECOVERY")
                ),
            )
            .order_by(desc(ActivityLog.created_at))
            .limit(limit)
        )
        .scalars()
        .all()
    )
    return [serialize_audit_log(row) for row in rows]


def list_entity_audit_events(
    db: Session,
    organization_id: str,
    entity_type: str,
    entity_id: str,
    limit: int = 40,
) -> list[dict[str, Any]]:
    rows = (
        db.execute(
            select(ActivityLog)
            .where(
                ActivityLog.organization_id == organization_id,
                ActivityLog.entity_type == entity_type,
                ActivityLog.entity_id == entity_id,
            )
            .order_by(desc(ActivityLog.created_at))
            .limit(limit)
        )
        .scalars()
        .all()
    )
    return [serialize_audit_log(row) for row in rows]
