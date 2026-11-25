from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.auth.dependencies import get_auth_context
from backend.app.auth.service import AuthContext
from backend.app.core.database import get_db
from backend.app.models.documents import ImportBatch
from backend.app.services import import_service

router = APIRouter(prefix="/api/imports", tags=["Importation"])


class ImportCommitRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255)
    sourceType: str = Field(..., min_length=1, max_length=32)
    rows: list[dict[str, Any]] = Field(..., min_length=1)


@router.post("/preview")
async def preview_import_route(
    file: UploadFile = File(...),
    sourceType: str = Form(default="CSV"),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    content = await file.read()
    filename = file.filename or "donnees_import.csv"
    return import_service.preview_import_data(
        db,
        organization_id=ctx.user.organization_id,
        filename=filename,
        content=content,
        source_type=sourceType,
    )


@router.post("/commit")
def commit_import_route(
    payload: ImportCommitRequest,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return import_service.commit_import_batch(
        db,
        organization_id=ctx.user.organization_id,
        actor_label=ctx.user.email,
        filename=payload.filename,
        source_type=payload.sourceType,
        rows=payload.rows,
    )


@router.get("/history")
def list_import_history_route(
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    batches = db.execute(
        select(ImportBatch)
        .where(ImportBatch.organization_id == ctx.user.organization_id)
        .order_by(ImportBatch.created_at.desc())
        .limit(20)
    ).scalars().all()

    return {
        "batches": [
            {
                "id": b.id,
                "filename": b.filename,
                "sourceType": b.source_type,
                "status": b.status,
                "totalRows": b.total_rows,
                "importedRows": b.imported_rows,
                "duplicateRows": b.duplicate_rows,
                "errorRows": b.error_rows,
                "createdBy": b.created_by,
                "createdAt": b.created_at,
            }
            for b in batches
        ]
    }
