from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["Santé"])


@router.get("/health")
def get_health() -> dict[str, str]:
    return {"status": "ok"}
