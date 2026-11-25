from __future__ import annotations

import math
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.core.errors import AppError
from backend.app.core.security import utc_now_iso
from backend.app.models.client import Client, CommunicationPreference
from backend.app.models.documents import Document
from backend.app.models.recovery import Dispute, Invoice, PromiseToPay, Reminder
from backend.app.schemas.clients import (
    ClientCreateRequest,
    ClientUpdateRequest,
)
from backend.app.services.audit_service import (
    list_entity_audit_events,
    record_audit_event,
)
from backend.app.services.financial_calc import (
    compute_client_financials_map,
    compute_invoices_snapshot,
)


def _get_client_or_404(
    db: Session,
    organization_id: str,
    client_id: str,
) -> Client:
    client = db.execute(
        select(Client).where(
            Client.id == client_id,
            Client.organization_id == organization_id,
        )
    ).scalar_one_or_none()
    if client is None:
        raise AppError("Dossier client introuvable.", status_code=404)
    return client


def _get_or_init_preferences(
    db: Session,
    client: Client,
) -> CommunicationPreference:
    prefs = db.execute(
        select(CommunicationPreference).where(
            CommunicationPreference.client_id == client.id,
            CommunicationPreference.organization_id == client.organization_id,
        )
    ).scalar_one_or_none()
    if prefs is not None:
        return prefs

    now_iso = utc_now_iso()
    prefs = CommunicationPreference(
        id=f"pref-{client.id}",
        organization_id=client.organization_id,
        client_id=client.id,
        preferred_channel=client.preferred_channel or "EMAIL",
        contact_allowed=1,
        contact_hours=None,
        restrictions_note=None,
        created_at=client.created_at or now_iso,
        updated_at=now_iso,
    )
    db.add(prefs)
    db.flush()
    return prefs


def _check_duplicate_client(
    db: Session,
    organization_id: str,
    name: str,
    email: str | None,
    exclude_client_id: str | None = None,
) -> None:
    norm_name = name.strip().lower()
    stmt = select(Client).where(
        Client.organization_id == organization_id,
        func.lower(func.trim(Client.name)) == norm_name,
    )
    if exclude_client_id:
        stmt = stmt.where(Client.id != exclude_client_id)
    if db.execute(stmt).scalar_one_or_none() is not None:
        raise AppError(
            "Un client portant déjà ce nom ou cette raison sociale existe dans votre organisation.",
            status_code=409,
        )

    if email:
        norm_email = email.strip().lower()
        email_stmt = select(Client).where(
            Client.organization_id == organization_id,
            func.lower(func.trim(Client.email)) == norm_email,
        )
        if exclude_client_id:
            email_stmt = email_stmt.where(Client.id != exclude_client_id)
        if db.execute(email_stmt).scalar_one_or_none() is not None:
            raise AppError(
                "Un client utilise déjà cette adresse e-mail dans votre organisation.",
                status_code=409,
            )


def list_clients(
    db: Session,
    *,
    organization_id: str,
    search: str = "",
    status: str = "ALL",
    client_type: str = "ALL",
    channel: str = "ALL",
    include_archived: bool = False,
    sort_by: str = "remaining_amount",
    sort_dir: str = "desc",
    page: int = 1,
    page_size: int = 10,
    reference_date: str | None = None,
) -> dict[str, Any]:
    clients = (
        db.execute(
            select(Client).where(Client.organization_id == organization_id)
        )
        .scalars()
        .all()
    )
    prefs_map = {
        p.client_id: p
        for p in db.execute(
            select(CommunicationPreference).where(
                CommunicationPreference.organization_id == organization_id
            )
        )
        .scalars()
        .all()
    }

    financials_map = compute_client_financials_map(
        db, organization_id, reference_date=reference_date
    )

    enriched: list[dict[str, Any]] = []
    active_count = 0
    archived_count = 0
    overdue_clients_count = 0
    dispute_clients_count = 0
    total_remaining_portfolio = 0

    for c in clients:
        fin = financials_map.get(c.id, {})
        prefs = prefs_map.get(c.id)
        global_status = fin.get("globalStatus", "UP_TO_DATE")
        is_archived = c.is_archived == 1

        if is_archived:
            archived_count += 1
        else:
            active_count += 1
            total_remaining_portfolio += int(fin.get("remainingAmount", 0))
            if global_status == "OVERDUE":
                overdue_clients_count += 1
            elif global_status == "DISPUTE":
                dispute_clients_count += 1

        item = {
            "id": c.id,
            "name": c.name,
            "clientType": c.client_type,
            "taxId": c.tax_id,
            "email": c.email,
            "phone": c.phone,
            "contactName": c.contact_name,
            "preferredChannel": prefs.preferred_channel if prefs else c.preferred_channel,
            "contactAllowed": (prefs.contact_allowed == 1) if prefs else True,
            "isArchived": is_archived,
            "archivedAt": c.archived_at,
            "invoicesCount": int(fin.get("invoicesCount", 0)),
            "overdueInvoicesCount": int(fin.get("overdueInvoicesCount", 0)),
            "remainingAmount": int(fin.get("remainingAmount", 0)),
            "overdueAmount": int(fin.get("overdueAmount", 0)),
            "pendingVerificationAmount": int(fin.get("pendingVerificationAmount", 0)),
            "globalStatus": global_status,
            "createdAt": c.created_at,
            "updatedAt": c.updated_at,
        }
        enriched.append(item)

    # Filtrage
    filtered = enriched
    if status == "ARCHIVED":
        filtered = [c for c in filtered if c["isArchived"]]
    elif not include_archived:
        filtered = [c for c in filtered if not c["isArchived"]]

    if status not in ("ALL", "ARCHIVED"):
        filtered = [c for c in filtered if c["globalStatus"] == status]

    if client_type in ("COMPANY", "INDIVIDUAL"):
        filtered = [c for c in filtered if c["clientType"] == client_type]

    if channel in ("EMAIL", "WHATSAPP", "PHONE"):
        filtered = [c for c in filtered if c["preferredChannel"] == channel]

    q = search.strip().lower()
    if q:
        filtered = [
            c
            for c in filtered
            if q in (c["name"] or "").lower()
            or q in (c["contactName"] or "").lower()
            or q in (c["email"] or "").lower()
            or q in (c["phone"] or "").lower()
            or q in (c["taxId"] or "").lower()
        ]

    # Tri
    reverse = sort_dir.lower() != "asc"
    if sort_by == "name":
        filtered.sort(key=lambda c: (c["name"] or "").lower(), reverse=reverse)
    elif sort_by == "invoices_count":
        filtered.sort(key=lambda c: (c["invoicesCount"], c["remainingAmount"]), reverse=reverse)
    elif sort_by == "status":
        filtered.sort(key=lambda c: (c["globalStatus"], c["remainingAmount"]), reverse=reverse)
    elif sort_by == "created_at":
        filtered.sort(key=lambda c: c["createdAt"], reverse=reverse)
    else:
        filtered.sort(
            key=lambda c: (c["remainingAmount"], c["overdueAmount"], (c["name"] or "").lower()),
            reverse=reverse,
        )

    safe_page_size = max(1, min(page_size, 50))
    total = len(filtered)
    total_pages = max(1, math.ceil(total / safe_page_size))
    safe_page = max(1, min(page, total_pages))
    start = (safe_page - 1) * safe_page_size
    paginated = filtered[start : start + safe_page_size]

    return {
        "items": paginated,
        "total": total,
        "page": safe_page,
        "pageSize": safe_page_size,
        "totalPages": total_pages,
        "summary": {
            "activeClients": active_count,
            "archivedClients": archived_count,
            "overdueClients": overdue_clients_count,
            "disputeClients": dispute_clients_count,
            "totalRemainingPortfolio": total_remaining_portfolio,
        },
    }


def get_client_detail(
    db: Session,
    *,
    organization_id: str,
    client_id: str,
    reference_date: str | None = None,
) -> dict[str, Any]:
    client = _get_client_or_404(db, organization_id, client_id)
    prefs = _get_or_init_preferences(db, client)

    fin_map = compute_client_financials_map(
        db, organization_id, reference_date=reference_date
    )
    fin = fin_map.get(client.id, {})
    confirmed_by_invoice: dict[str, int] = fin.get("confirmedByInvoice", {})
    pending_by_invoice: dict[str, int] = fin.get("pendingByInvoice", {})

    ref_date = reference_date or utc_now_iso()[:10]

    invoices = (
        db.execute(
            select(Invoice)
            .where(
                Invoice.organization_id == organization_id,
                Invoice.client_id == client.id,
                Invoice.is_archived == 0,
            )
            .order_by(Invoice.due_date.desc())
        )
        .scalars()
        .all()
    )
    invoice_ref_map = {inv.id: inv.reference for inv in invoices}

    promises = (
        db.execute(
            select(PromiseToPay)
            .where(
                PromiseToPay.organization_id == organization_id,
                PromiseToPay.client_id == client.id,
            )
            .order_by(PromiseToPay.promised_date.desc())
        )
        .scalars()
        .all()
    )
    active_promise_ids = {p.invoice_id for p in promises if p.status == "ACTIVE"}

    disputes = (
        db.execute(
            select(Dispute)
            .where(
                Dispute.organization_id == organization_id,
                Dispute.client_id == client.id,
            )
            .order_by(Dispute.opened_at.desc())
        )
        .scalars()
        .all()
    )
    open_dispute_ids = {d.invoice_id for d in disputes if d.status == "OPEN"}

    reminders = (
        db.execute(
            select(Reminder)
            .where(
                Reminder.organization_id == organization_id,
                Reminder.client_id == client.id,
            )
            .order_by(Reminder.created_at.desc())
            .limit(15)
        )
        .scalars()
        .all()
    )

    documents = (
        db.execute(
            select(Document)
            .where(
                Document.organization_id == organization_id,
                Document.client_id == client.id,
            )
            .order_by(Document.created_at.desc())
        )
        .scalars()
        .all()
    )

    snapshots = [
        snap
        for snap in compute_invoices_snapshot(
            db,
            organization_id,
            include_archived=False,
            reference_date=reference_date,
        )
        if snap.client_id == client.id
    ]
    snapshots.sort(key=lambda s: s.due_date, reverse=True)

    invoice_summaries: list[dict[str, Any]] = [
        {
            "id": snap.id,
            "reference": snap.reference,
            "issueDate": snap.issue_date,
            "dueDate": snap.due_date,
            "totalAmount": snap.total_amount,
            "confirmedPaidAmount": snap.confirmed_paid_amount,
            "pendingVerificationAmount": snap.pending_verification_amount,
            "remainingAmount": snap.remaining_amount,
            "delayDays": snap.delay_days,
            "status": snap.status,
        }
        for snap in snapshots
    ]

    history = list_entity_audit_events(
        db,
        organization_id=organization_id,
        entity_type="CLIENT",
        entity_id=client.id,
        limit=40,
    )

    return {
        "id": client.id,
        "name": client.name,
        "clientType": client.client_type,
        "taxId": client.tax_id,
        "address": client.address,
        "contactName": client.contact_name,
        "email": client.email,
        "phone": client.phone,
        "secondaryContact": client.secondary_contact,
        "notes": client.notes,
        "isArchived": client.is_archived == 1,
        "archivedAt": client.archived_at,
        "archivedBy": client.archived_by,
        "createdAt": client.created_at,
        "updatedAt": client.updated_at,
        "communicationPreferences": {
            "preferredChannel": prefs.preferred_channel,
            "contactAllowed": prefs.contact_allowed == 1,
            "contactHours": prefs.contact_hours,
            "restrictionsNote": prefs.restrictions_note,
        },
        "financial": {
            "totalBilled": int(fin.get("totalBilled", 0)),
            "totalPaidConfirmed": int(fin.get("totalPaidConfirmed", 0)),
            "remainingAmount": int(fin.get("remainingAmount", 0)),
            "overdueAmount": int(fin.get("overdueAmount", 0)),
            "pendingVerificationAmount": int(fin.get("pendingVerificationAmount", 0)),
            "invoicesCount": int(fin.get("invoicesCount", 0)),
            "openInvoicesCount": int(fin.get("openInvoicesCount", 0)),
            "overdueInvoicesCount": int(fin.get("overdueInvoicesCount", 0)),
            "pendingPaymentsCount": int(fin.get("pendingPaymentsCount", 0)),
            "activePromisesCount": int(fin.get("activePromisesCount", 0)),
            "openDisputesCount": int(fin.get("openDisputesCount", 0)),
            "globalStatus": fin.get("globalStatus", "UP_TO_DATE"),
        },
        "invoices": invoice_summaries,
        "promises": [
            {
                "id": p.id,
                "invoiceId": p.invoice_id,
                "invoiceReference": invoice_ref_map.get(p.invoice_id, "Facture"),
                "promisedAmount": int(p.promised_amount),
                "promisedDate": p.promised_date,
                "status": p.status,
                "note": p.note,
                "createdAt": p.created_at,
            }
            for p in promises
        ],
        "disputes": [
            {
                "id": d.id,
                "invoiceId": d.invoice_id,
                "invoiceReference": invoice_ref_map.get(d.invoice_id, "Facture"),
                "reason": d.reason,
                "status": d.status,
                "openedBy": d.opened_by,
                "openedAt": d.opened_at,
                "resolvedAt": d.resolved_at,
            }
            for d in disputes
        ],
        "reminders": [
            {
                "id": r.id,
                "invoiceId": r.invoice_id,
                "invoiceReference": invoice_ref_map.get(r.invoice_id, "Facture"),
                "channel": r.channel,
                "status": r.status,
                "scheduledFor": r.scheduled_for,
                "subject": r.subject,
                "createdAt": r.created_at,
            }
            for r in reminders
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
        "documents": [
            {
                "id": doc.id,
                "docType": doc.doc_type,
                "title": doc.title,
                "fileName": doc.file_name,
                "mimeType": doc.mime_type,
                "fileSize": int(doc.file_size),
                "createdAt": doc.created_at,
            }
            for doc in documents
        ],
    }


def create_client(
    db: Session,
    *,
    organization_id: str,
    actor_user_id: str,
    actor_label: str,
    payload: ClientCreateRequest,
) -> dict[str, Any]:
    _check_duplicate_client(db, organization_id, payload.name, payload.email)
    now_iso = utc_now_iso()
    client_id = str(uuid.uuid4())
    prefs_payload = payload.communicationPreferences

    client = Client(
        id=client_id,
        organization_id=organization_id,
        name=payload.name,
        client_type=payload.clientType,
        tax_id=payload.taxId,
        address=payload.address,
        contact_name=payload.contactName,
        email=payload.email,
        phone=payload.phone,
        secondary_contact=payload.secondaryContact,
        preferred_channel=prefs_payload.preferredChannel,
        notes=payload.notes,
        is_archived=0,
        archived_at=None,
        archived_by=None,
        created_at=now_iso,
        updated_at=now_iso,
    )
    prefs = CommunicationPreference(
        id=str(uuid.uuid4()),
        organization_id=organization_id,
        client_id=client_id,
        preferred_channel=prefs_payload.preferredChannel,
        contact_allowed=1 if prefs_payload.contactAllowed else 0,
        contact_hours=prefs_payload.contactHours,
        restrictions_note=prefs_payload.restrictionsNote,
        created_at=now_iso,
        updated_at=now_iso,
    )

    try:
        db.add(client)
        db.add(prefs)
        record_audit_event(
            db,
            organization_id=organization_id,
            event_type="CLIENT_CREATED",
            category="RECOVERY",
            actor_user_id=actor_user_id,
            actor_label=actor_label,
            target_label=client.name,
            entity_type="CLIENT",
            entity_id=client.id,
            summary=f"Création de la fiche client {client.name}.",
            created_at=now_iso,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return get_client_detail(db, organization_id=organization_id, client_id=client_id)


def update_client(
    db: Session,
    *,
    organization_id: str,
    client_id: str,
    actor_user_id: str,
    actor_label: str,
    payload: ClientUpdateRequest,
) -> dict[str, Any]:
    client = _get_client_or_404(db, organization_id, client_id)
    prefs = _get_or_init_preferences(db, client)

    next_name = payload.name if payload.name is not None else client.name
    next_email = payload.email if "email" in payload.model_fields_set else client.email
    _check_duplicate_client(
        db,
        organization_id,
        next_name,
        next_email,
        exclude_client_id=client.id,
    )

    now_iso = utc_now_iso()
    fields_set = payload.model_fields_set

    general_changed = False
    contact_changed = False
    prefs_changed = False

    if "name" in fields_set and payload.name is not None and payload.name != client.name:
        client.name = payload.name
        general_changed = True
    if "clientType" in fields_set and payload.clientType is not None and payload.clientType != client.client_type:
        client.client_type = payload.clientType
        general_changed = True
    if "taxId" in fields_set and payload.taxId != client.tax_id:
        client.tax_id = payload.taxId
        general_changed = True
    if "address" in fields_set and payload.address != client.address:
        client.address = payload.address
        general_changed = True
    if "notes" in fields_set and payload.notes != client.notes:
        client.notes = payload.notes
        general_changed = True

    if "contactName" in fields_set and payload.contactName != client.contact_name:
        client.contact_name = payload.contactName
        contact_changed = True
    if "email" in fields_set and payload.email != client.email:
        client.email = payload.email
        contact_changed = True
    if "phone" in fields_set and payload.phone != client.phone:
        client.phone = payload.phone
        contact_changed = True
    if "secondaryContact" in fields_set and payload.secondaryContact != client.secondary_contact:
        client.secondary_contact = payload.secondaryContact
        contact_changed = True

    if payload.communicationPreferences is not None:
        cp = payload.communicationPreferences
        next_allowed = 1 if cp.contactAllowed else 0
        if (
            cp.preferredChannel != prefs.preferred_channel
            or next_allowed != prefs.contact_allowed
            or cp.contactHours != prefs.contact_hours
            or cp.restrictionsNote != prefs.restrictions_note
        ):
            prefs.preferred_channel = cp.preferredChannel
            client.preferred_channel = cp.preferredChannel
            prefs.contact_allowed = next_allowed
            prefs.contact_hours = cp.contactHours
            prefs.restrictions_note = cp.restrictionsNote
            prefs.updated_at = now_iso
            prefs_changed = True

    client.updated_at = now_iso

    try:
        if general_changed:
            record_audit_event(
                db,
                organization_id=organization_id,
                event_type="CLIENT_UPDATED",
                category="RECOVERY",
                actor_user_id=actor_user_id,
                actor_label=actor_label,
                target_label=client.name,
                entity_type="CLIENT",
                entity_id=client.id,
                summary=f"Mise à jour des informations générales de {client.name}.",
                created_at=now_iso,
            )
        if contact_changed:
            record_audit_event(
                db,
                organization_id=organization_id,
                event_type="CLIENT_CONTACT_UPDATED",
                category="RECOVERY",
                actor_user_id=actor_user_id,
                actor_label=actor_label,
                target_label=client.name,
                entity_type="CLIENT",
                entity_id=client.id,
                summary=f"Modification des coordonnées ou du contact référent de {client.name}.",
                created_at=now_iso,
            )
        if prefs_changed:
            ch_label = {
                "EMAIL": "E-mail",
                "WHATSAPP": "WhatsApp",
                "PHONE": "Téléphone",
            }.get(prefs.preferred_channel, prefs.preferred_channel)
            auth_txt = "contact autorisé" if prefs.contact_allowed == 1 else "contact suspendu"
            record_audit_event(
                db,
                organization_id=organization_id,
                event_type="CLIENT_PREFERENCES_UPDATED",
                category="RECOVERY",
                actor_user_id=actor_user_id,
                actor_label=actor_label,
                target_label=client.name,
                entity_type="CLIENT",
                entity_id=client.id,
                summary=f"Préférences de communication modifiées pour {client.name} ({ch_label}, {auth_txt}).",
                created_at=now_iso,
            )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return get_client_detail(db, organization_id=organization_id, client_id=client.id)


def archive_client(
    db: Session,
    *,
    organization_id: str,
    client_id: str,
    actor_user_id: str,
    actor_label: str,
) -> dict[str, Any]:
    client = _get_client_or_404(db, organization_id, client_id)
    if client.is_archived == 1:
        return get_client_detail(db, organization_id=organization_id, client_id=client.id)

    now_iso = utc_now_iso()
    client.is_archived = 1
    client.archived_at = now_iso
    client.archived_by = actor_label
    client.updated_at = now_iso

    try:
        record_audit_event(
            db,
            organization_id=organization_id,
            event_type="CLIENT_ARCHIVED",
            category="RECOVERY",
            actor_user_id=actor_user_id,
            actor_label=actor_label,
            target_label=client.name,
            entity_type="CLIENT",
            entity_id=client.id,
            summary=f"Archivage du dossier client {client.name} (factures, paiements et historique conservés).",
            created_at=now_iso,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return get_client_detail(db, organization_id=organization_id, client_id=client.id)


def restore_client(
    db: Session,
    *,
    organization_id: str,
    client_id: str,
    actor_user_id: str,
    actor_label: str,
) -> dict[str, Any]:
    client = _get_client_or_404(db, organization_id, client_id)
    if client.is_archived == 0:
        return get_client_detail(db, organization_id=organization_id, client_id=client.id)

    now_iso = utc_now_iso()
    client.is_archived = 0
    client.archived_at = None
    client.archived_by = None
    client.updated_at = now_iso

    try:
        record_audit_event(
            db,
            organization_id=organization_id,
            event_type="CLIENT_RESTORED",
            category="RECOVERY",
            actor_user_id=actor_user_id,
            actor_label=actor_label,
            target_label=client.name,
            entity_type="CLIENT",
            entity_id=client.id,
            summary=f"Restauration du dossier client {client.name}.",
            created_at=now_iso,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return get_client_detail(db, organization_id=organization_id, client_id=client.id)
