from __future__ import annotations

import json
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.security import utc_now_iso
from backend.app.models.idempotency import IdempotencyRecord


def get_idempotent_response(
    db: Session,
    *,
    organization_id: str,
    actor_user_id: str,
    action_name: str,
    idempotency_key: str | None,
) -> tuple[int, dict[str, Any]] | None:
    if not idempotency_key:
        return None
    cleaned = idempotency_key.strip()[:128]
    if not cleaned:
        return None
    rec = db.execute(
        select(IdempotencyRecord).where(
            IdempotencyRecord.organization_id == organization_id,
            IdempotencyRecord.actor_user_id == actor_user_id,
            IdempotencyRecord.action_name == action_name,
            IdempotencyRecord.idempotency_key == cleaned,
        )
    ).scalar_one_or_none()
    if rec is None:
        return None
    return rec.response_status, json.loads(rec.response_body)


def save_idempotent_response(
    db: Session,
    *,
    organization_id: str,
    actor_user_id: str,
    action_name: str,
    idempotency_key: str | None,
    target_id: str | None,
    response_status: int,
    payload: dict[str, Any],
) -> None:
    if not idempotency_key:
        return
    cleaned = idempotency_key.strip()[:128]
    if not cleaned:
        return
    db.add(
        IdempotencyRecord(
            id=str(uuid.uuid4()),
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            action_name=action_name,
            idempotency_key=cleaned,
            target_id=target_id,
            response_status=response_status,
            response_body=json.dumps(payload, ensure_ascii=False),
            created_at=utc_now_iso(),
        )
    )
