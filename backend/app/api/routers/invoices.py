from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, Form, Header, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from backend.app.auth.dependencies import get_auth_context
from backend.app.auth.service import AuthContext
from backend.app.core.database import get_db
from backend.app.schemas.invoices import (
    CreditNoteCreateRequest,
    DisputeCreateRequest,
    DisputeUpdateRequest,
    InvoiceDetailOut,
    InvoiceListResponseOut,
    InvoiceMetadataUpdateRequest,
    PaymentAllocateRequest,
    PromiseCreateRequest,
    PromiseUpdateRequest,
)
from backend.app.services import invoice_service

router = APIRouter(tags=["Factures et créances"])


@router.get("/api/invoices", response_model=InvoiceListResponseOut)
def list_invoices_route(
    request: Request,
    search: str = Query(default=""),
    status_filter: str = Query(default="ALL", alias="status"),
    client_id: str = Query(default=""),
    date_from: str = Query(default=""),
    date_to: str = Query(default=""),
    date_field: str = Query(default="due_date"),
    sort_by: str = Query(default="due_date"),
    sort_dir: str = Query(default="asc"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ref_override = getattr(request.app.state, "reference_date_override", None)
    return invoice_service.list_invoices(
        db,
        organization_id=ctx.user.organization_id,
        search=search,
        status=status_filter,
        client_id=client_id,
        date_from=date_from,
        date_to=date_to,
        date_field=date_field,
        sort_by=sort_by,
        sort_dir=sort_dir,
        page=page,
        page_size=page_size,
        reference_date=ref_override,
    )


@router.get("/api/invoices/{invoice_id}", response_model=InvoiceDetailOut)
def get_invoice_detail_route(
    invoice_id: str,
    request: Request,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ref_override = getattr(request.app.state, "reference_date_override", None)
    return invoice_service.get_invoice_detail(
        db,
        organization_id=ctx.user.organization_id,
        invoice_id=invoice_id,
        reference_date=ref_override,
    )


@router.patch("/api/invoices/{invoice_id}", response_model=InvoiceDetailOut)
def update_invoice_metadata_route(
    invoice_id: str,
    payload: InvoiceMetadataUpdateRequest,
    request: Request,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ref_override = getattr(request.app.state, "reference_date_override", None)
    return invoice_service.update_invoice_metadata(
        db,
        organization_id=ctx.user.organization_id,
        invoice_id=invoice_id,
        actor_user_id=ctx.user.id,
        actor_label=ctx.user.email,
        payload=payload,
        reference_date=ref_override,
    )


@router.post("/api/invoices/{invoice_id}/archive", response_model=InvoiceDetailOut)
def archive_invoice_route(
    invoice_id: str,
    request: Request,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ref_override = getattr(request.app.state, "reference_date_override", None)
    return invoice_service.archive_invoice(
        db,
        organization_id=ctx.user.organization_id,
        invoice_id=invoice_id,
        actor_user_id=ctx.user.id,
        actor_label=ctx.user.email,
        reference_date=ref_override,
    )


@router.post("/api/invoices/{invoice_id}/restore", response_model=InvoiceDetailOut)
def restore_invoice_route(
    invoice_id: str,
    request: Request,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ref_override = getattr(request.app.state, "reference_date_override", None)
    return invoice_service.restore_invoice(
        db,
        organization_id=ctx.user.organization_id,
        invoice_id=invoice_id,
        actor_user_id=ctx.user.id,
        actor_label=ctx.user.email,
        reference_date=ref_override,
    )


@router.post(
    "/api/invoices/{invoice_id}/disputes",
    response_model=InvoiceDetailOut,
    status_code=status.HTTP_201_CREATED,
)
def open_dispute_route(
    invoice_id: str,
    payload: DisputeCreateRequest,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ref_override = getattr(request.app.state, "reference_date_override", None)
    return invoice_service.open_dispute(
        db,
        organization_id=ctx.user.organization_id,
        invoice_id=invoice_id,
        actor_user_id=ctx.user.id,
        actor_label=ctx.user.email,
        payload=payload,
        idempotency_key=idempotency_key,
        reference_date=ref_override,
    )


@router.patch(
    "/api/invoices/{invoice_id}/disputes/{dispute_id}",
    response_model=InvoiceDetailOut,
)
def update_dispute_route(
    invoice_id: str,
    dispute_id: str,
    payload: DisputeUpdateRequest,
    request: Request,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ref_override = getattr(request.app.state, "reference_date_override", None)
    return invoice_service.update_dispute(
        db,
        organization_id=ctx.user.organization_id,
        invoice_id=invoice_id,
        dispute_id=dispute_id,
        actor_user_id=ctx.user.id,
        actor_label=ctx.user.email,
        payload=payload,
        reference_date=ref_override,
    )


@router.post(
    "/api/invoices/{invoice_id}/promises",
    response_model=InvoiceDetailOut,
    status_code=status.HTTP_201_CREATED,
)
def record_promise_route(
    invoice_id: str,
    payload: PromiseCreateRequest,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ref_override = getattr(request.app.state, "reference_date_override", None)
    return invoice_service.record_promise(
        db,
        organization_id=ctx.user.organization_id,
        invoice_id=invoice_id,
        actor_user_id=ctx.user.id,
        actor_label=ctx.user.email,
        payload=payload,
        idempotency_key=idempotency_key,
        reference_date=ref_override,
    )


@router.patch(
    "/api/invoices/{invoice_id}/promises/{promise_id}",
    response_model=InvoiceDetailOut,
)
def update_promise_route(
    invoice_id: str,
    promise_id: str,
    payload: PromiseUpdateRequest,
    request: Request,
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ref_override = getattr(request.app.state, "reference_date_override", None)
    return invoice_service.update_promise(
        db,
        organization_id=ctx.user.organization_id,
        invoice_id=invoice_id,
        promise_id=promise_id,
        actor_user_id=ctx.user.id,
        actor_label=ctx.user.email,
        payload=payload,
        reference_date=ref_override,
    )


@router.post(
    "/api/invoices/{invoice_id}/credit-notes",
    response_model=InvoiceDetailOut,
    status_code=status.HTTP_201_CREATED,
)
def create_credit_note_route(
    invoice_id: str,
    payload: CreditNoteCreateRequest,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ref_override = getattr(request.app.state, "reference_date_override", None)
    return invoice_service.create_credit_note(
        db,
        organization_id=ctx.user.organization_id,
        invoice_id=invoice_id,
        actor_user_id=ctx.user.id,
        actor_label=ctx.user.email,
        payload=payload,
        idempotency_key=idempotency_key,
        reference_date=ref_override,
    )


@router.post(
    "/api/invoices/{invoice_id}/credit-notes/{credit_id}/validate",
    response_model=InvoiceDetailOut,
)
def validate_credit_note_route(
    invoice_id: str,
    credit_id: str,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    ref_override = getattr(request.app.state, "reference_date_override", None)
    return invoice_service.validate_credit_note(
        db,
        organization_id=ctx.user.organization_id,
        invoice_id=invoice_id,
        credit_id=credit_id,
        actor_user_id=ctx.user.id,
        actor_label=ctx.user.email,
        idempotency_key=idempotency_key,
        reference_date=ref_override,
    )


@router.post("/api/payments/{payment_id}/allocate")
def allocate_payment_route(
    payment_id: str,
    payload: PaymentAllocateRequest,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    return invoice_service.allocate_payment(
        db,
        organization_id=ctx.user.organization_id,
        payment_id=payment_id,
        actor_user_id=ctx.user.id,
        actor_label=ctx.user.email,
        payload=payload,
        idempotency_key=idempotency_key,
    )


@router.post(
    "/api/invoices/{invoice_id}/documents",
    response_model=InvoiceDetailOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_invoice_document_route(
    invoice_id: str,
    request: Request,
    docType: str = Form(default="SUPPORTING_DOC"),
    title: str | None = Form(default=None),
    file: UploadFile = File(...),
    ctx: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    content_bytes = await file.read()
    ref_override = getattr(request.app.state, "reference_date_override", None)
    return invoice_service.attach_invoice_document(
        db,
        organization_id=ctx.user.organization_id,
        invoice_id=invoice_id,
        actor_user_id=ctx.user.id,
        actor_label=ctx.user.email,
        doc_type=docType,
        title=title,
        filename=file.filename or "document.pdf",
        content_type=file.content_type,
        content_bytes=content_bytes,
        reference_date=ref_override,
    )
