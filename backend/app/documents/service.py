from __future__ import annotations

from pathlib import Path
import re
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.core.errors import AppError
from backend.app.core.security import utc_now_iso
from backend.app.models.documents import Document

MAX_DOCUMENT_BYTES = 10 * 1024 * 1024  # 10 Mo
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".csv", ".xlsx"}
ALLOWED_DOC_TYPES = {
    "ORIGINAL_INVOICE",
    "FACTURE_PDF",
    "CREDIT_NOTE",
    "JUSTIFICATIF_PAIEMENT",
    "DISPUTE_EVIDENCE",
    "SUPPORTING_DOC",
}
EXTENSION_MIME_FALLBACK = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".csv": "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def resolve_confined_document_path(storage_key: str) -> Path:
    base_dir = get_settings().upload_dir.resolve()
    base_dir.mkdir(parents=True, exist_ok=True)
    target = (base_dir / storage_key).resolve()
    if not str(target).startswith(str(base_dir) + "/"):
        raise AppError("Chemin documentaire non autorisé.", status_code=400)
    return target


def _sanitize_filename(raw_name: str) -> str:
    base = Path(raw_name or "document.pdf").name
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._")
    return cleaned[:160] or "document.pdf"


def save_invoice_document(
    db: Session,
    *,
    organization_id: str,
    invoice_id: str,
    client_id: str,
    doc_type: str,
    title: str | None,
    filename: str,
    content_type: str | None,
    content_bytes: bytes,
    uploaded_by: str,
) -> Document:
    if doc_type not in ALLOWED_DOC_TYPES:
        raise AppError("Type de document non reconnu.", status_code=400)

    safe_name = _sanitize_filename(filename)
    ext = Path(safe_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise AppError(
            "Format de fichier non autorisé. Formats acceptés : PDF, PNG, JPG, WEBP, CSV ou XLSX.",
            status_code=400,
        )

    size = len(content_bytes)
    if size <= 0:
        raise AppError("Le fichier sélectionné est vide.", status_code=400)
    if size > MAX_DOCUMENT_BYTES:
        raise AppError(
            "La taille du fichier dépasse la limite autorisée de 10 Mo.",
            status_code=400,
        )

    safe_org = re.sub(r"[^A-Za-z0-9_-]+", "_", organization_id)
    safe_inv = re.sub(r"[^A-Za-z0-9_-]+", "_", invoice_id)
    doc_id = str(uuid.uuid4())
    storage_key = f"{safe_org}/invoices/{safe_inv}/{doc_id}_{safe_name}"
    target_path = resolve_confined_document_path(storage_key)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(content_bytes)

    resolved_mime = (
        content_type
        if content_type and content_type != "application/octet-stream"
        else EXTENSION_MIME_FALLBACK.get(ext, "application/octet-stream")
    )
    resolved_title = (title or "").strip()[:220] or safe_name
    now_iso = utc_now_iso()

    doc = Document(
        id=doc_id,
        organization_id=organization_id,
        client_id=client_id,
        invoice_id=invoice_id,
        payment_id=None,
        import_id=None,
        doc_type=doc_type,
        title=resolved_title,
        file_name=safe_name,
        mime_type=resolved_mime[:120],
        file_size=size,
        storage_key=storage_key,
        uploaded_by=uploaded_by,
        created_at=now_iso,
        updated_at=now_iso,
    )
    db.add(doc)
    return doc


def get_document_for_download(
    db: Session,
    *,
    organization_id: str,
    document_id: str,
) -> tuple[Document, Path]:
    doc = db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.organization_id == organization_id,
        )
    ).scalar_one_or_none()
    if doc is None:
        raise AppError("Document introuvable dans votre organisation.", status_code=404)

    file_path = resolve_confined_document_path(doc.storage_key)
    if not file_path.is_file():
        raise AppError(
            "La pièce jointe d’origine n’est pas stockée physiquement sur cet environnement.",
            status_code=404,
        )
    return doc, file_path


def list_client_documents(
    db: Session,
    *,
    organization_id: str,
    client_id: str,
) -> list[Document]:
    return list(
        db.execute(
            select(Document)
            .where(
                Document.organization_id == organization_id,
                Document.client_id == client_id,
            )
            .order_by(Document.created_at.desc())
        )
        .scalars()
        .all()
    )
