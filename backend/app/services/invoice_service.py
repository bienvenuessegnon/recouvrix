from __future__ import annotations

import math
import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.core.errors import AppError
from backend.app.core.security import utc_now_iso
from backend.app.documents.service import save_invoice_document
from backend.app.models.client import Client
from backend.app.models.documents import Document
from backend.app.models.recovery import (
    CreditNote,
    Dispute,
    Invoice,
    Payment,
    PaymentAllocation,
    PromiseToPay,
    Reminder,
)
from backend.app.schemas.invoices import (
    CreditNoteCreateRequest,
    DisputeCreateRequest,
    DisputeUpdateRequest,
    InvoiceMetadataUpdateRequest,
    PaymentAllocateRequest,
    PromiseCreateRequest,
    PromiseUpdateRequest,
)
from backend.app.services.audit_service import (
    list_entity_audit_events,
    record_audit_event,
)
from backend.app.services.financial_calc import (
    ACTIVE_DISPUTE_STATUSES,
    CONFIRMED_PAYMENT_STATUSES,
    PENDING_PAYMENT_STATUSES,
    ComputedInvoice,
    compute_invoices_snapshot,
    dec_to_amount,
    to_decimal,
)
from backend.app.services.idempotency_service import (
    get_idempotent_response,
    save_idempotent_response,
)

DISPUTE_CATEGORY_LABELS = {
    "QUANTITY_DISCREPANCY": "Écart de quantité livrée",
    "PRICING_ERROR": "Erreur de tarif ou de facturation",
    "QUALITY_ISSUE": "Non-conformité / Qualité",
    "ALREADY_PAID": "Règlement déjà effectué selon le client",
    "MISSING_DOCUMENT": "Pièce justificative ou bon de commande manquant",
    "OTHER": "Autre motif de contestation",
}


def _get_invoice_or_404(
    db: Session,
    organization_id: str,
    invoice_id: str,
) -> Invoice:
    inv = db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.organization_id == organization_id,
        )
    ).scalar_one_or_none()
    if inv is None:
        raise AppError("Facture introuvable dans votre organisation.", status_code=404)
    return inv


def _compute_single_invoice_remaining_decimal(
    db: Session,
    organization_id: str,
    invoice: Invoice,
) -> tuple[Decimal, Decimal, Decimal]:
    """Retourne (solde_restant_decimal, credits_valides_decimal, paiements_confirmes_decimal)."""
    payments = (
        db.execute(
            select(Payment).where(
                Payment.organization_id == organization_id,
                Payment.client_id == invoice.client_id,
                Payment.status.in_(list(CONFIRMED_PAYMENT_STATUSES)),
            )
        )
        .scalars()
        .all()
    )
    pay_ids = [p.id for p in payments]
    allocs = []
    if pay_ids:
        allocs = (
            db.execute(
                select(PaymentAllocation).where(
                    PaymentAllocation.organization_id == organization_id,
                    PaymentAllocation.payment_id.in_(pay_ids),
                )
            )
            .scalars()
            .all()
        )
    alloc_by_pay: dict[str, list[PaymentAllocation]] = {}
    for a in allocs:
        alloc_by_pay.setdefault(a.payment_id, []).append(a)

    confirmed_dec = Decimal("0")
    for p in payments:
        p_allocs = alloc_by_pay.get(p.id, [])
        if p_allocs:
            for a in p_allocs:
                if a.invoice_id == invoice.id:
                    confirmed_dec += to_decimal(a.allocated_amount)
        elif p.invoice_id == invoice.id:
            confirmed_dec += to_decimal(p.amount)

    credits = (
        db.execute(
            select(CreditNote).where(
                CreditNote.organization_id == organization_id,
                CreditNote.invoice_id == invoice.id,
                CreditNote.status == "VALIDATED",
            )
        )
        .scalars()
        .all()
    )
    credits_dec = sum((to_decimal(cn.amount) for cn in credits), Decimal("0"))
    remaining_dec = to_decimal(invoice.total_amount) - credits_dec - confirmed_dec
    return remaining_dec, credits_dec, confirmed_dec


def _build_status_explanation(snap: ComputedInvoice) -> tuple[str, bool, str | None]:
    if snap.status == "PAID":
        return (
            "Facture intégralement soldée par les paiements confirmés et avoirs validés. Exclue des créances ouvertes.",
            False,
            None,
        )
    if snap.status == "DISPUTE":
        reason_txt = (
            f"Motif : {snap.dispute_reason}"
            if snap.dispute_reason
            else "Un litige est ouvert sur cette créance."
        )
        return (
            f"Facture en litige actif : les relances automatiques sont suspendues tout en conservant le solde dans les créances ouvertes. {reason_txt}",
            True,
            snap.dispute_reason or "Litige ouvert sur la facture",
        )
    if snap.status == "PROMISE":
        if snap.is_promise_overdue:
            return (
                "Promesse de paiement dépassée sans encaissement confirmé : vérification requise par le gestionnaire.",
                False,
                None,
            )
        return (
            "Promesse de paiement en cours. Une promesse ne réduit jamais le solde tant que le règlement n’est pas confirmé.",
            False,
            None,
        )
    if snap.status == "OVERDUE":
        if snap.is_partially_paid:
            return (
                f"Facture en retard de {snap.delay_days} jour(s) malgré un règlement partiel confirmé.",
                False,
                None,
            )
        return (
            f"Échéance dépassée de {snap.delay_days} jour(s) sans règlement confirmé.",
            False,
            None,
        )
    if snap.status == "PARTIAL":
        return (
            "Règlement partiel confirmé avant l’échéance : le solde restant reste suivi jusqu’à apurement.",
            False,
            None,
        )
    return (
        "Facture à échoir : la date d’échéance n’est pas encore dépassée.",
        False,
        None,
    )


def list_invoices(
    db: Session,
    *,
    organization_id: str,
    search: str = "",
    status: str = "ALL",
    client_id: str = "",
    date_from: str = "",
    date_to: str = "",
    date_field: str = "due_date",
    sort_by: str = "due_date",
    sort_dir: str = "asc",
    page: int = 1,
    page_size: int = 10,
    reference_date: str | None = None,
) -> dict[str, Any]:
    ref_date = reference_date or utc_now_iso()[:10]
    all_snapshots = compute_invoices_snapshot(
        db,
        organization_id,
        include_archived=True,
        reference_date=ref_date,
    )

    active_snaps = [s for s in all_snapshots if not s.is_archived]
    archived_snaps = [s for s in all_snapshots if s.is_archived]

    summary = {
        "totalCount": len(active_snaps),
        "openCount": sum(1 for s in active_snaps if s.remaining_amount > 0),
        "overdueCount": sum(1 for s in active_snaps if s.is_overdue),
        "upcomingCount": sum(1 for s in active_snaps if s.status == "UPCOMING"),
        "partialCount": sum(1 for s in active_snaps if s.is_partially_paid),
        "disputeCount": sum(1 for s in active_snaps if s.status == "DISPUTE"),
        "promiseCount": sum(1 for s in active_snaps if s.status == "PROMISE"),
        "paidCount": sum(1 for s in active_snaps if s.status == "PAID"),
        "archivedCount": len(archived_snaps),
        "totalOpenAmount": dec_to_amount(
            sum((to_decimal(s.remaining_amount) for s in active_snaps if s.remaining_amount > 0), Decimal("0"))
        ),
        "totalOverdueAmount": dec_to_amount(
            sum((to_decimal(s.remaining_amount) for s in active_snaps if s.is_overdue), Decimal("0"))
        ),
        "pendingVerificationAmount": dec_to_amount(
            sum((to_decimal(s.pending_verification_amount) for s in active_snaps), Decimal("0"))
        ),
    }

    norm_status = status.strip().upper()
    if norm_status == "ARCHIVED":
        filtered = list(archived_snaps)
    else:
        filtered = list(active_snaps)
        if norm_status == "OPEN":
            filtered = [s for s in filtered if s.remaining_amount > 0]
        elif norm_status == "NOT_DUE":
            filtered = [s for s in filtered if s.remaining_amount > 0 and not s.is_overdue]
        elif norm_status in ("OVERDUE", "IS_OVERDUE"):
            filtered = [s for s in filtered if s.is_overdue]
        elif norm_status == "PARTIAL":
            filtered = [s for s in filtered if s.is_partially_paid]
        elif norm_status in ("UPCOMING", "DISPUTE", "PROMISE", "PAID"):
            filtered = [s for s in filtered if s.status == norm_status]

    if client_id.strip():
        cid = client_id.strip()
        filtered = [s for s in filtered if s.client_id == cid]

    d_from = date_from.strip()[:10]
    d_to = date_to.strip()[:10]
    if d_from:
        filtered = [
            s
            for s in filtered
            if (s.issue_date if date_field == "issue_date" else s.due_date) >= d_from
        ]
    if d_to:
        filtered = [
            s
            for s in filtered
            if (s.issue_date if date_field == "issue_date" else s.due_date) <= d_to
        ]

    q = search.strip().lower()
    if q:
        filtered = [
            s
            for s in filtered
            if q in s.reference.lower()
            or q in s.client_name.lower()
            or q in (s.description or "").lower()
        ]

    reverse = sort_dir.lower() == "desc"
    if sort_by == "remaining_amount":
        filtered.sort(key=lambda s: (s.remaining_amount, s.delay_days, s.due_date), reverse=reverse)
    elif sort_by == "total_amount":
        filtered.sort(key=lambda s: (s.total_amount, s.due_date), reverse=reverse)
    elif sort_by == "delay_days":
        filtered.sort(key=lambda s: (s.delay_days, s.remaining_amount), reverse=reverse)
    elif sort_by == "issue_date":
        filtered.sort(key=lambda s: (s.issue_date, s.reference), reverse=reverse)
    elif sort_by == "reference":
        filtered.sort(key=lambda s: s.reference.lower(), reverse=reverse)
    else:
        filtered.sort(key=lambda s: (s.due_date, -s.remaining_amount), reverse=reverse)

    safe_page_size = max(1, min(page_size, 50))
    total = len(filtered)
    total_pages = max(1, math.ceil(total / safe_page_size))
    safe_page = max(1, min(page, total_pages))
    start = (safe_page - 1) * safe_page_size
    paginated = filtered[start : start + safe_page_size]

    return {
        "items": [
            {
                "id": s.id,
                "reference": s.reference,
                "clientId": s.client_id,
                "clientName": s.client_name,
                "issueDate": s.issue_date,
                "dueDate": s.due_date,
                "currency": s.currency,
                "description": s.description,
                "totalAmount": s.total_amount,
                "confirmedPaidAmount": s.confirmed_paid_amount,
                "validatedCreditNotesAmount": s.validated_credit_notes_amount,
                "pendingVerificationAmount": s.pending_verification_amount,
                "remainingAmount": s.remaining_amount,
                "delayDays": s.delay_days,
                "isOverdue": s.is_overdue,
                "isPartiallyPaid": s.is_partially_paid,
                "hasDispute": s.has_dispute,
                "activePromiseDate": s.active_promise_date,
                "isPromiseOverdue": s.is_promise_overdue,
                "isArchived": s.is_archived,
                "status": s.status,
            }
            for s in paginated
        ],
        "total": total,
        "page": safe_page,
        "pageSize": safe_page_size,
        "totalPages": total_pages,
        "referenceDate": ref_date,
        "summary": summary,
    }


def get_invoice_detail(
    db: Session,
    *,
    organization_id: str,
    invoice_id: str,
    reference_date: str | None = None,
) -> dict[str, Any]:
    inv = _get_invoice_or_404(db, organization_id, invoice_id)
    ref_date = reference_date or utc_now_iso()[:10]

    snapshots = compute_invoices_snapshot(
        db,
        organization_id,
        include_archived=True,
        reference_date=ref_date,
    )
    snap = next((s for s in snapshots if s.id == inv.id), None)
    if snap is None:
        raise AppError("Facture introuvable dans votre organisation.", status_code=404)

    client = db.execute(
        select(Client).where(
            Client.id == inv.client_id,
            Client.organization_id == organization_id,
        )
    ).scalar_one_or_none()

    # Paiements liés (via PaymentAllocation ou invoice_id direct)
    allocs = (
        db.execute(
            select(PaymentAllocation).where(
                PaymentAllocation.organization_id == organization_id,
                PaymentAllocation.invoice_id == inv.id,
            )
        )
        .scalars()
        .all()
    )
    alloc_payment_ids = {a.payment_id for a in allocs}

    direct_payments = (
        db.execute(
            select(Payment).where(
                Payment.organization_id == organization_id,
                (Payment.invoice_id == inv.id) | (Payment.id.in_(list(alloc_payment_ids) or ["__none__"])),
            )
        )
        .scalars()
        .all()
    )
    payment_map = {p.id: p for p in direct_payments}

    confirmed_allocations_out: list[dict[str, Any]] = []
    seen_alloc_pay_ids: set[str] = set()
    for a in allocs:
        pay = payment_map.get(a.payment_id)
        if not pay:
            continue
        seen_alloc_pay_ids.add(pay.id)
        if pay.status in CONFIRMED_PAYMENT_STATUSES:
            confirmed_allocations_out.append(
                {
                    "id": a.id,
                    "paymentId": pay.id,
                    "paymentReference": pay.reference,
                    "paymentMethod": pay.payment_method,
                    "paymentStatus": pay.status,
                    "allocatedAmount": int(a.allocated_amount),
                    "declaredAt": pay.declared_at,
                    "confirmedAt": pay.confirmed_at,
                    "createdAt": a.created_at,
                }
            )

    for pay in direct_payments:
        if pay.id in seen_alloc_pay_ids:
            continue
        if pay.status in CONFIRMED_PAYMENT_STATUSES and pay.invoice_id == inv.id:
            confirmed_allocations_out.append(
                {
                    "id": f"direct-{pay.id}",
                    "paymentId": pay.id,
                    "paymentReference": pay.reference,
                    "paymentMethod": pay.payment_method,
                    "paymentStatus": pay.status,
                    "allocatedAmount": int(pay.amount),
                    "declaredAt": pay.declared_at,
                    "confirmedAt": pay.confirmed_at,
                    "createdAt": pay.created_at,
                }
            )

    declared_payments_out = [
        {
            "id": p.id,
            "reference": p.reference,
            "amount": int(p.amount),
            "status": p.status,
            "paymentMethod": p.payment_method,
            "declaredAt": p.declared_at,
            "createdBy": p.created_by,
        }
        for p in sorted(direct_payments, key=lambda x: x.declared_at, reverse=True)
        if p.status in PENDING_PAYMENT_STATUSES or p.status == "REJECTED"
    ]

    credit_notes = (
        db.execute(
            select(CreditNote)
            .where(
                CreditNote.organization_id == organization_id,
                CreditNote.invoice_id == inv.id,
            )
            .order_by(CreditNote.created_at.desc())
        )
        .scalars()
        .all()
    )

    promises = (
        db.execute(
            select(PromiseToPay)
            .where(
                PromiseToPay.organization_id == organization_id,
                PromiseToPay.invoice_id == inv.id,
            )
            .order_by(PromiseToPay.promised_date.desc(), PromiseToPay.created_at.desc())
        )
        .scalars()
        .all()
    )

    disputes = (
        db.execute(
            select(Dispute)
            .where(
                Dispute.organization_id == organization_id,
                Dispute.invoice_id == inv.id,
            )
            .order_by(Dispute.opened_at.desc())
        )
        .scalars()
        .all()
    )

    reminders = (
        db.execute(
            select(Reminder)
            .where(
                Reminder.organization_id == organization_id,
                Reminder.invoice_id == inv.id,
            )
            .order_by(Reminder.created_at.desc())
        )
        .scalars()
        .all()
    )

    documents = (
        db.execute(
            select(Document)
            .where(
                Document.organization_id == organization_id,
                Document.invoice_id == inv.id,
            )
            .order_by(Document.created_at.desc())
        )
        .scalars()
        .all()
    )

    history = list_entity_audit_events(
        db,
        organization_id=organization_id,
        entity_type="INVOICE",
        entity_id=inv.id,
        limit=60,
    )

    status_explanation, reminders_suspended, suspension_reason = _build_status_explanation(snap)

    return {
        "id": inv.id,
        "reference": inv.reference,
        "clientId": inv.client_id,
        "clientName": snap.client_name,
        "clientEmail": client.email if client else None,
        "clientPhone": client.phone if client else None,
        "issueDate": inv.issue_date,
        "dueDate": inv.due_date,
        "currency": snap.currency,
        "description": inv.description,
        "isArchived": inv.is_archived == 1,
        "archivedAt": inv.archived_at,
        "archivedBy": inv.archived_by,
        "createdAt": inv.created_at,
        "updatedAt": inv.updated_at,
        "referenceDate": ref_date,
        "totalAmount": snap.total_amount,
        "confirmedPaidAmount": snap.confirmed_paid_amount,
        "validatedCreditNotesAmount": snap.validated_credit_notes_amount,
        "pendingVerificationAmount": snap.pending_verification_amount,
        "remainingAmount": snap.remaining_amount,
        "delayDays": snap.delay_days,
        "isOverdue": snap.is_overdue,
        "isPartiallyPaid": snap.is_partially_paid,
        "hasDispute": snap.has_dispute,
        "remindersSuspended": reminders_suspended,
        "suspensionReason": suspension_reason,
        "status": snap.status,
        "statusExplanation": status_explanation,
        "allocations": confirmed_allocations_out,
        "declaredPayments": declared_payments_out,
        "creditNotes": [
            {
                "id": cn.id,
                "reference": cn.reference,
                "amount": int(cn.amount),
                "status": cn.status,
                "reason": cn.reason,
                "validatedAt": cn.validated_at,
                "validatedBy": cn.validated_by,
                "createdBy": cn.created_by,
                "createdAt": cn.created_at,
            }
            for cn in credit_notes
        ],
        "promises": [
            {
                "id": p.id,
                "promisedAmount": int(p.promised_amount),
                "promisedDate": p.promised_date,
                "status": p.status,
                "isOverdue": bool(
                    p.status == "ACTIVE" and p.promised_date < ref_date and snap.remaining_amount > 0
                ),
                "note": p.note,
                "recordedBy": p.recorded_by,
                "evaluatedAt": p.evaluated_at,
                "createdAt": p.created_at,
            }
            for p in promises
        ],
        "disputes": [
            {
                "id": d.id,
                "category": d.category,
                "reason": d.reason,
                "status": d.status,
                "openedBy": d.opened_by,
                "openedAt": d.opened_at,
                "resolvedAt": d.resolved_at,
                "resolutionNote": d.resolution_note,
            }
            for d in disputes
        ],
        "reminders": [
            {
                "id": r.id,
                "channel": r.channel,
                "status": r.status,
                "scheduledFor": r.scheduled_for,
                "subject": r.subject,
                "createdAt": r.created_at,
            }
            for r in reminders
        ],
        "documents": [
            {
                "id": doc.id,
                "docType": doc.doc_type,
                "title": doc.title,
                "fileName": doc.file_name,
                "mimeType": doc.mime_type,
                "fileSize": int(doc.file_size),
                "uploadedBy": doc.uploaded_by,
                "createdAt": doc.created_at,
            }
            for doc in documents
        ],
        "history": [
            {
                "id": h["id"],
                "eventType": h["eventType"],
                "category": h["category"],
                "actorLabel": h["actorLabel"],
                "summary": h["summary"],
                "createdAt": h["createdAt"],
            }
            for h in history
        ],
    }


def update_invoice_metadata(
    db: Session,
    *,
    organization_id: str,
    invoice_id: str,
    actor_user_id: str,
    actor_label: str,
    payload: InvoiceMetadataUpdateRequest,
    reference_date: str | None = None,
) -> dict[str, Any]:
    inv = _get_invoice_or_404(db, organization_id, invoice_id)
    now_iso = utc_now_iso()

    if "description" in payload.model_fields_set and payload.description != inv.description:
        inv.description = payload.description
        inv.updated_at = now_iso
        record_audit_event(
            db,
            organization_id=organization_id,
            event_type="INVOICE_UPDATED",
            category="RECOVERY",
            actor_user_id=actor_user_id,
            actor_label=actor_label,
            target_label=inv.reference,
            entity_type="INVOICE",
            entity_id=inv.id,
            summary=f"Mise à jour de l’objet / description de la facture {inv.reference}.",
            created_at=now_iso,
        )
        db.commit()

    return get_invoice_detail(
        db,
        organization_id=organization_id,
        invoice_id=inv.id,
        reference_date=reference_date,
    )


def archive_invoice(
    db: Session,
    *,
    organization_id: str,
    invoice_id: str,
    actor_user_id: str,
    actor_label: str,
    reference_date: str | None = None,
) -> dict[str, Any]:
    inv = _get_invoice_or_404(db, organization_id, invoice_id)
    if inv.is_archived == 1:
        return get_invoice_detail(
            db,
            organization_id=organization_id,
            invoice_id=inv.id,
            reference_date=reference_date,
        )
    now_iso = utc_now_iso()
    inv.is_archived = 1
    inv.archived_at = now_iso
    inv.archived_by = actor_label
    inv.updated_at = now_iso

    try:
        for ent_type, ent_id in [("INVOICE", inv.id), ("CLIENT", inv.client_id)]:
            record_audit_event(
                db,
                organization_id=organization_id,
                event_type="INVOICE_ARCHIVED",
                category="RECOVERY",
                actor_user_id=actor_user_id,
                actor_label=actor_label,
                target_label=inv.reference,
                entity_type=ent_type,
                entity_id=ent_id,
                summary=f"Archivage de la facture {inv.reference} (paiements et historique conservés).",
                created_at=now_iso,
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return get_invoice_detail(
        db,
        organization_id=organization_id,
        invoice_id=inv.id,
        reference_date=reference_date,
    )


def restore_invoice(
    db: Session,
    *,
    organization_id: str,
    invoice_id: str,
    actor_user_id: str,
    actor_label: str,
    reference_date: str | None = None,
) -> dict[str, Any]:
    inv = _get_invoice_or_404(db, organization_id, invoice_id)
    if inv.is_archived == 0:
        return get_invoice_detail(
            db,
            organization_id=organization_id,
            invoice_id=inv.id,
            reference_date=reference_date,
        )
    now_iso = utc_now_iso()
    inv.is_archived = 0
    inv.archived_at = None
    inv.archived_by = None
    inv.updated_at = now_iso

    try:
        for ent_type, ent_id in [("INVOICE", inv.id), ("CLIENT", inv.client_id)]:
            record_audit_event(
                db,
                organization_id=organization_id,
                event_type="INVOICE_RESTORED",
                category="RECOVERY",
                actor_user_id=actor_user_id,
                actor_label=actor_label,
                target_label=inv.reference,
                entity_type=ent_type,
                entity_id=ent_id,
                summary=f"Restauration de la facture {inv.reference}.",
                created_at=now_iso,
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return get_invoice_detail(
        db,
        organization_id=organization_id,
        invoice_id=inv.id,
        reference_date=reference_date,
    )


def open_dispute(
    db: Session,
    *,
    organization_id: str,
    invoice_id: str,
    actor_user_id: str,
    actor_label: str,
    payload: DisputeCreateRequest,
    idempotency_key: str | None = None,
    reference_date: str | None = None,
) -> dict[str, Any]:
    cached = get_idempotent_response(
        db,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        action_name=f"OPEN_DISPUTE:{invoice_id}",
        idempotency_key=idempotency_key,
    )
    if cached is not None:
        return cached[1]

    inv = _get_invoice_or_404(db, organization_id, invoice_id)
    if inv.is_archived == 1:
        raise AppError("Impossible d’ouvrir un litige sur une facture archivée.", status_code=400)

    remaining_dec, _, _ = _compute_single_invoice_remaining_decimal(db, organization_id, inv)
    if remaining_dec <= 0:
        raise AppError("Impossible d’ouvrir un litige sur une facture déjà soldée.", status_code=400)

    now_iso = utc_now_iso()
    dispute = Dispute(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        invoice_id=inv.id,
        client_id=inv.client_id,
        category=payload.category,
        reason=payload.reason,
        status="OPEN",
        opened_by=actor_label,
        opened_at=now_iso,
        created_at=now_iso,
        updated_at=now_iso,
    )
    inv.has_dispute = 1
    inv.dispute_reason = payload.reason
    inv.updated_at = now_iso

    cat_label = DISPUTE_CATEGORY_LABELS.get(payload.category, payload.category)

    try:
        db.add(dispute)
        for ent_type, ent_id in [("INVOICE", inv.id), ("CLIENT", inv.client_id)]:
            record_audit_event(
                db,
                organization_id=organization_id,
                event_type="DISPUTE_OPENED",
                category="RECOVERY",
                actor_user_id=actor_user_id,
                actor_label=actor_label,
                target_label=inv.reference,
                entity_type=ent_type,
                entity_id=ent_id,
                summary=f"Ouverture d’un litige ({cat_label}) sur {inv.reference} : relances automatiques suspendues.",
                created_at=now_iso,
            )
        db.flush()
        detail = get_invoice_detail(
            db,
            organization_id=organization_id,
            invoice_id=inv.id,
            reference_date=reference_date,
        )
        save_idempotent_response(
            db,
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            action_name=f"OPEN_DISPUTE:{invoice_id}",
            idempotency_key=idempotency_key,
            target_id=dispute.id,
            response_status=201,
            payload=detail,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return detail


def update_dispute(
    db: Session,
    *,
    organization_id: str,
    invoice_id: str,
    dispute_id: str,
    actor_user_id: str,
    actor_label: str,
    payload: DisputeUpdateRequest,
    reference_date: str | None = None,
) -> dict[str, Any]:
    inv = _get_invoice_or_404(db, organization_id, invoice_id)
    dispute = db.execute(
        select(Dispute).where(
            Dispute.id == dispute_id,
            Dispute.invoice_id == inv.id,
            Dispute.organization_id == organization_id,
        )
    ).scalar_one_or_none()
    if dispute is None:
        raise AppError("Litige introuvable pour cette facture.", status_code=404)

    now_iso = utc_now_iso()
    dispute.status = payload.status
    if payload.category is not None:
        dispute.category = payload.category
    if payload.reason is not None:
        dispute.reason = payload.reason
    if payload.resolutionNote is not None:
        dispute.resolution_note = payload.resolutionNote

    is_closing = payload.status in ("RESOLVED", "CANCELLED")
    if is_closing:
        dispute.resolved_at = now_iso
    else:
        dispute.resolved_at = None
    dispute.updated_at = now_iso

    try:
        db.flush()
        remaining_active = (
            db.execute(
                select(Dispute).where(
                    Dispute.organization_id == organization_id,
                    Dispute.invoice_id == inv.id,
                    Dispute.status.in_(list(ACTIVE_DISPUTE_STATUSES)),
                )
            )
            .scalars()
            .all()
        )
        if remaining_active:
            inv.has_dispute = 1
            inv.dispute_reason = remaining_active[0].reason
        else:
            inv.has_dispute = 0
            inv.dispute_reason = None
        inv.updated_at = now_iso

        if is_closing:
            ev_type = "DISPUTE_RESOLVED"
            summary = (
                f"Clôture du litige sur {inv.reference} ({'résolu' if payload.status == 'RESOLVED' else 'annulé'}). "
                "Aucune relance automatique déclenchée sans nouvelle vérification."
            )
        else:
            ev_type = "DISPUTE_UPDATED"
            st_lbl = "En cours d’instruction" if payload.status == "IN_REVIEW" else "Ouvert"
            summary = f"Mise à jour du litige sur {inv.reference} (statut : {st_lbl})."

        for ent_type, ent_id in [("INVOICE", inv.id), ("CLIENT", inv.client_id)]:
            record_audit_event(
                db,
                organization_id=organization_id,
                event_type=ev_type,
                category="RECOVERY",
                actor_user_id=actor_user_id,
                actor_label=actor_label,
                target_label=inv.reference,
                entity_type=ent_type,
                entity_id=ent_id,
                summary=summary,
                created_at=now_iso,
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return get_invoice_detail(
        db,
        organization_id=organization_id,
        invoice_id=inv.id,
        reference_date=reference_date,
    )


def record_promise(
    db: Session,
    *,
    organization_id: str,
    invoice_id: str,
    actor_user_id: str,
    actor_label: str,
    payload: PromiseCreateRequest,
    idempotency_key: str | None = None,
    reference_date: str | None = None,
) -> dict[str, Any]:
    cached = get_idempotent_response(
        db,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        action_name=f"RECORD_PROMISE:{invoice_id}",
        idempotency_key=idempotency_key,
    )
    if cached is not None:
        return cached[1]

    inv = _get_invoice_or_404(db, organization_id, invoice_id)
    if inv.is_archived == 1:
        raise AppError("Impossible d’enregistrer une promesse sur une facture archivée.", status_code=400)

    remaining_dec, _, _ = _compute_single_invoice_remaining_decimal(db, organization_id, inv)
    if remaining_dec <= 0:
        raise AppError("Impossible d’enregistrer une promesse sur une facture déjà soldée.", status_code=400)

    if to_decimal(payload.promisedAmount) > remaining_dec:
        raise AppError(
            "Le montant promis ne peut pas dépasser le solde restant dû de la facture.",
            status_code=400,
        )

    now_iso = utc_now_iso()
    promise = PromiseToPay(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        invoice_id=inv.id,
        client_id=inv.client_id,
        promised_amount=payload.promisedAmount,
        promised_date=payload.promisedDate,
        status="ACTIVE",
        note=payload.note,
        recorded_by=actor_label,
        created_at=now_iso,
        updated_at=now_iso,
    )

    try:
        db.add(promise)
        for ent_type, ent_id in [("INVOICE", inv.id), ("CLIENT", inv.client_id)]:
            record_audit_event(
                db,
                organization_id=organization_id,
                event_type="PROMISE_RECORDED",
                category="RECOVERY",
                actor_user_id=actor_user_id,
                actor_label=actor_label,
                target_label=inv.reference,
                entity_type=ent_type,
                entity_id=ent_id,
                summary=f"Promesse de paiement enregistrée sur {inv.reference} pour {payload.promisedAmount:,} {inv.currency} au {payload.promisedDate}.".replace(",", " "),
                created_at=now_iso,
            )
        db.flush()
        detail = get_invoice_detail(
            db,
            organization_id=organization_id,
            invoice_id=inv.id,
            reference_date=reference_date,
        )
        save_idempotent_response(
            db,
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            action_name=f"RECORD_PROMISE:{invoice_id}",
            idempotency_key=idempotency_key,
            target_id=promise.id,
            response_status=201,
            payload=detail,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return detail


def update_promise(
    db: Session,
    *,
    organization_id: str,
    invoice_id: str,
    promise_id: str,
    actor_user_id: str,
    actor_label: str,
    payload: PromiseUpdateRequest,
    reference_date: str | None = None,
) -> dict[str, Any]:
    inv = _get_invoice_or_404(db, organization_id, invoice_id)
    promise = db.execute(
        select(PromiseToPay).where(
            PromiseToPay.id == promise_id,
            PromiseToPay.invoice_id == inv.id,
            PromiseToPay.organization_id == organization_id,
        )
    ).scalar_one_or_none()
    if promise is None:
        raise AppError("Promesse de paiement introuvable pour cette facture.", status_code=404)

    now_iso = utc_now_iso()
    promise.status = payload.status
    if payload.note is not None:
        promise.note = payload.note
    if payload.status in ("KEPT", "BROKEN", "CANCELLED"):
        promise.evaluated_at = now_iso
    else:
        promise.evaluated_at = None
    promise.updated_at = now_iso

    status_labels = {
        "ACTIVE": "En attente",
        "KEPT": "Respectée (sans valoir encaissement)",
        "BROKEN": "Non respectée",
        "CANCELLED": "Annulée",
    }

    try:
        for ent_type, ent_id in [("INVOICE", inv.id), ("CLIENT", inv.client_id)]:
            record_audit_event(
                db,
                organization_id=organization_id,
                event_type="PROMISE_UPDATED",
                category="RECOVERY",
                actor_user_id=actor_user_id,
                actor_label=actor_label,
                target_label=inv.reference,
                entity_type=ent_type,
                entity_id=ent_id,
                summary=f"Mise à jour de la promesse sur {inv.reference} : {status_labels.get(payload.status, payload.status)}.",
                created_at=now_iso,
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return get_invoice_detail(
        db,
        organization_id=organization_id,
        invoice_id=inv.id,
        reference_date=reference_date,
    )


def create_credit_note(
    db: Session,
    *,
    organization_id: str,
    invoice_id: str,
    actor_user_id: str,
    actor_label: str,
    payload: CreditNoteCreateRequest,
    idempotency_key: str | None = None,
    reference_date: str | None = None,
) -> dict[str, Any]:
    cached = get_idempotent_response(
        db,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        action_name=f"CREATE_CREDIT_NOTE:{invoice_id}",
        idempotency_key=idempotency_key,
    )
    if cached is not None:
        return cached[1]

    inv = _get_invoice_or_404(db, organization_id, invoice_id)
    if inv.is_archived == 1:
        raise AppError("Impossible d’émettre un avoir sur une facture archivée.", status_code=400)

    existing_ref = db.execute(
        select(CreditNote).where(func.lower(CreditNote.reference) == payload.reference.lower())
    ).scalar_one_or_none()
    if existing_ref is not None:
        raise AppError("Un avoir portant cette référence existe déjà.", status_code=409)

    remaining_dec, _, _ = _compute_single_invoice_remaining_decimal(db, organization_id, inv)
    credit_dec = to_decimal(payload.amount)
    if credit_dec > remaining_dec:
        raise AppError(
            "Le montant de l’avoir dépasse le solde restant dû de la facture (solde négatif interdit).",
            status_code=400,
        )

    now_iso = utc_now_iso()
    status_val = "VALIDATED" if payload.validateNow else "DRAFT"
    cn = CreditNote(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        invoice_id=inv.id,
        client_id=inv.client_id,
        reference=payload.reference,
        amount=payload.amount,
        status=status_val,
        reason=payload.reason,
        validated_at=now_iso if payload.validateNow else None,
        validated_by=actor_label if payload.validateNow else None,
        created_by=actor_label,
        created_at=now_iso,
        updated_at=now_iso,
    )

    ev_type = "CREDIT_NOTE_VALIDATED" if payload.validateNow else "CREDIT_NOTE_CREATED"
    ev_verb = "Validation" if payload.validateNow else "Enregistrement"

    try:
        db.add(cn)
        for ent_type, ent_id in [("INVOICE", inv.id), ("CLIENT", inv.client_id)]:
            record_audit_event(
                db,
                organization_id=organization_id,
                event_type=ev_type,
                category="RECOVERY",
                actor_user_id=actor_user_id,
                actor_label=actor_label,
                target_label=inv.reference,
                entity_type=ent_type,
                entity_id=ent_id,
                summary=f"{ev_verb} de l’avoir {cn.reference} ({cn.amount:,} {inv.currency}) sur {inv.reference}.".replace(",", " "),
                created_at=now_iso,
            )
        db.flush()
        detail = get_invoice_detail(
            db,
            organization_id=organization_id,
            invoice_id=inv.id,
            reference_date=reference_date,
        )
        save_idempotent_response(
            db,
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            action_name=f"CREATE_CREDIT_NOTE:{invoice_id}",
            idempotency_key=idempotency_key,
            target_id=cn.id,
            response_status=201,
            payload=detail,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return detail


def validate_credit_note(
    db: Session,
    *,
    organization_id: str,
    invoice_id: str,
    credit_id: str,
    actor_user_id: str,
    actor_label: str,
    idempotency_key: str | None = None,
    reference_date: str | None = None,
) -> dict[str, Any]:
    cached = get_idempotent_response(
        db,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        action_name=f"VALIDATE_CREDIT_NOTE:{credit_id}",
        idempotency_key=idempotency_key,
    )
    if cached is not None:
        return cached[1]

    inv = _get_invoice_or_404(db, organization_id, invoice_id)
    cn = db.execute(
        select(CreditNote).where(
            CreditNote.id == credit_id,
            CreditNote.invoice_id == inv.id,
            CreditNote.organization_id == organization_id,
        )
    ).scalar_one_or_none()
    if cn is None:
        raise AppError("Avoir introuvable pour cette facture.", status_code=404)
    if cn.status == "VALIDATED":
        return get_invoice_detail(
            db,
            organization_id=organization_id,
            invoice_id=inv.id,
            reference_date=reference_date,
        )
    if cn.status != "DRAFT":
        raise AppError("Seul un avoir en brouillon peut être validé.", status_code=400)

    remaining_dec, _, _ = _compute_single_invoice_remaining_decimal(db, organization_id, inv)
    if to_decimal(cn.amount) > remaining_dec:
        raise AppError(
            "Validation impossible : cet avoir dépasse le solde restant dû de la facture (solde négatif interdit).",
            status_code=400,
        )

    now_iso = utc_now_iso()
    cn.status = "VALIDATED"
    cn.validated_at = now_iso
    cn.validated_by = actor_label
    cn.updated_at = now_iso

    try:
        for ent_type, ent_id in [("INVOICE", inv.id), ("CLIENT", inv.client_id)]:
            record_audit_event(
                db,
                organization_id=organization_id,
                event_type="CREDIT_NOTE_VALIDATED",
                category="RECOVERY",
                actor_user_id=actor_user_id,
                actor_label=actor_label,
                target_label=inv.reference,
                entity_type=ent_type,
                entity_id=ent_id,
                summary=f"Validation de l’avoir {cn.reference} ({cn.amount:,} {inv.currency}) sur {inv.reference}.".replace(",", " "),
                created_at=now_iso,
            )
        db.flush()
        detail = get_invoice_detail(
            db,
            organization_id=organization_id,
            invoice_id=inv.id,
            reference_date=reference_date,
        )
        save_idempotent_response(
            db,
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            action_name=f"VALIDATE_CREDIT_NOTE:{credit_id}",
            idempotency_key=idempotency_key,
            target_id=cn.id,
            response_status=200,
            payload=detail,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return detail


def allocate_payment(
    db: Session,
    *,
    organization_id: str,
    payment_id: str,
    actor_user_id: str,
    actor_label: str,
    payload: PaymentAllocateRequest,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    """Affectation atomique et idempotente d'un paiement confirmé à une ou plusieurs factures."""
    cached = get_idempotent_response(
        db,
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        action_name=f"ALLOCATE_PAYMENT:{payment_id}",
        idempotency_key=idempotency_key,
    )
    if cached is not None:
        return cached[1]

    payment = db.execute(
        select(Payment).where(
            Payment.id == payment_id,
            Payment.organization_id == organization_id,
        )
    ).scalar_one_or_none()
    if payment is None:
        raise AppError("Paiement introuvable dans votre organisation.", status_code=404)

    if payment.status not in CONFIRMED_PAYMENT_STATUSES:
        raise AppError(
            "Seul un paiement confirmé ou enregistré peut être affecté au règlement des factures.",
            status_code=400,
        )

    requested_ids = [item.invoiceId for item in payload.allocations]
    if len(set(requested_ids)) != len(requested_ids):
        raise AppError(
            "Une même facture ne peut pas être affectée deux fois dans la même opération.",
            status_code=400,
        )

    existing_allocs = (
        db.execute(
            select(PaymentAllocation).where(
                PaymentAllocation.organization_id == organization_id,
                PaymentAllocation.payment_id == payment.id,
            )
        )
        .scalars()
        .all()
    )
    already_allocated_invoice_ids = {a.invoice_id for a in existing_allocs}
    already_allocated_total = sum(
        (to_decimal(a.allocated_amount) for a in existing_allocs),
        Decimal("0"),
    )

    new_total_dec = sum((to_decimal(item.amount) for item in payload.allocations), Decimal("0"))
    available_payment_dec = to_decimal(payment.amount) - already_allocated_total
    if new_total_dec > available_payment_dec:
        raise AppError(
            "Le total des montants affectés dépasse le solde disponible sur ce paiement.",
            status_code=409,
        )

    now_iso = utc_now_iso()
    created_allocations: list[dict[str, Any]] = []

    try:
        for item in payload.allocations:
            if item.invoiceId in already_allocated_invoice_ids:
                raise AppError(
                    "Ce paiement a déjà été affecté à cette facture (double affectation interdite).",
                    status_code=409,
                )

            inv = _get_invoice_or_404(db, organization_id, item.invoiceId)
            if inv.is_archived == 1:
                raise AppError(
                    f"La facture {inv.reference} est archivée et ne peut pas recevoir d’affectation.",
                    status_code=400,
                )
            if inv.client_id != payment.client_id:
                raise AppError(
                    f"La facture {inv.reference} n’appartient pas au même client que le paiement.",
                    status_code=400,
                )

            inv_remaining_dec, _, _ = _compute_single_invoice_remaining_decimal(db, organization_id, inv)
            alloc_dec = to_decimal(item.amount)
            if alloc_dec > inv_remaining_dec:
                raise AppError(
                    f"L’affectation sur {inv.reference} dépasse le solde restant dû (solde négatif interdit).",
                    status_code=400,
                )

            alloc_row = PaymentAllocation(
                id=str(uuid.uuid4()),
                organization_id=organization_id,
                payment_id=payment.id,
                invoice_id=inv.id,
                allocated_amount=item.amount,
                created_at=now_iso,
            )
            db.add(alloc_row)
            created_allocations.append(
                {
                    "id": alloc_row.id,
                    "invoiceId": inv.id,
                    "invoiceReference": inv.reference,
                    "allocatedAmount": item.amount,
                }
            )
            for ent_type, ent_id in [("INVOICE", inv.id), ("CLIENT", inv.client_id)]:
                record_audit_event(
                    db,
                    organization_id=organization_id,
                    event_type="PAYMENT_ALLOCATED",
                    category="RECOVERY",
                    actor_user_id=actor_user_id,
                    actor_label=actor_label,
                    target_label=inv.reference,
                    entity_type=ent_type,
                    entity_id=ent_id,
                    summary=f"Affectation de {item.amount:,} {inv.currency} du paiement {payment.reference} sur la facture {inv.reference}.".replace(",", " "),
                    created_at=now_iso,
                )

        db.flush()
        response_payload: dict[str, Any] = {
            "paymentId": payment.id,
            "paymentReference": payment.reference,
            "allocatedTotal": dec_to_amount(already_allocated_total + new_total_dec),
            "remainingUnallocated": dec_to_amount(available_payment_dec - new_total_dec),
            "allocations": created_allocations,
        }
        save_idempotent_response(
            db,
            organization_id=organization_id,
            actor_user_id=actor_user_id,
            action_name=f"ALLOCATE_PAYMENT:{payment_id}",
            idempotency_key=idempotency_key,
            target_id=payment.id,
            response_status=200,
            payload=response_payload,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(
            "Conflit d’affectation : ce paiement est déjà affecté à cette facture.",
            status_code=409,
        )
    except Exception:
        db.rollback()
        raise

    return response_payload


def attach_invoice_document(
    db: Session,
    *,
    organization_id: str,
    invoice_id: str,
    actor_user_id: str,
    actor_label: str,
    doc_type: str,
    title: str | None,
    filename: str,
    content_type: str | None,
    content_bytes: bytes,
    reference_date: str | None = None,
) -> dict[str, Any]:
    inv = _get_invoice_or_404(db, organization_id, invoice_id)
    now_iso = utc_now_iso()

    try:
        doc = save_invoice_document(
            db,
            organization_id=organization_id,
            invoice_id=inv.id,
            client_id=inv.client_id,
            doc_type=doc_type,
            title=title,
            filename=filename,
            content_type=content_type,
            content_bytes=content_bytes,
            uploaded_by=actor_label,
        )
        for ent_type, ent_id in [("INVOICE", inv.id), ("CLIENT", inv.client_id)]:
            record_audit_event(
                db,
                organization_id=organization_id,
                event_type="DOCUMENT_ATTACHED",
                category="RECOVERY",
                actor_user_id=actor_user_id,
                actor_label=actor_label,
                target_label=inv.reference,
                entity_type=ent_type,
                entity_id=ent_id,
                summary=f"Ajout du document « {doc.title} » ({doc.file_name}) sur la facture {inv.reference}.",
                created_at=now_iso,
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return get_invoice_detail(
        db,
        organization_id=organization_id,
        invoice_id=inv.id,
        reference_date=reference_date,
    )
