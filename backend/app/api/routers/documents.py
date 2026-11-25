from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from backend.app.auth.dependencies import get_auth_context
from backend.app.auth.service import AuthContext
from backend.app.core.database import get_db
from backend.app.documents.service import get_document_for_download

router = APIRouter(prefix="/api/documents", tags=["Documents"])


@router.get("/{document_id}/download")
def download_document_route(
    document_id: str,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> FileResponse:
    doc, file_path = get_document_for_download(
        db,
        organization_id=ctx.user.organization_id,
        document_id=document_id,
    )
    return FileResponse(
        path=str(file_path),
        media_type=doc.mime_type or "application/octet-stream",
        filename=doc.file_name,
    )
