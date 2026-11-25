from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.client import Client
from backend.app.models.recovery import (
    CreditNote,
    Dispute,
    Invoice,
    Payment,
    PaymentAllocation,
    PromiseToPay,
    Reminder,
)
from backend.app.models.settings import AppMeta

CONFIRMED_PAYMENT_STATUSES = {"CONFIRMED", "RECORDED"}
PENDING_PAYMENT_STATUSES = {"DECLARED", "RECEIPT_RECEIVED", "PENDING_VERIFICATION"}
ACTIVE_DISPUTE_STATUSES = {"OPEN", "IN_REVIEW"}


def to_decimal(value: int | str | Decimal | None) -> Decimal:
    """Convertit un montant en Decimal exact sans recourir aux flottants binaires."""
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def dec_to_amount(value: Decimal | int | str | None) -> int:
    """Convertit un Decimal monétaire XOF en entier arrondi au franc le plus proche."""
    return int(to_decimal(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


@dataclass
class ComputedInvoice:
    id: str
    reference: str
    client_id: str
    client_name: str
    issue_date: str
    due_date: str
    currency: str
    description: str | None
    total_amount: int
    confirmed_paid_amount: int
    validated_credit_notes_amount: int
    pending_verification_amount: int
    remaining_amount: int
    has_negative_balance_guard: bool
    delay_days: int
    is_overdue: bool
    is_partially_paid: bool
    has_dispute: bool
    dispute_reason: str | None
    active_promise_date: str | None
    active_promise_amount: int | None
    is_promise_overdue: bool
    is_archived: bool
    status: str


def _parse_date(date_str: str) -> date:
    return date.fromisoformat(date_str[:10])


def diff_days_utc(later_date_str: str, earlier_date_str: str) -> int:
    return (_parse_date(later_date_str) - _parse_date(earlier_date_str)).days


def _add_days_iso(base_date_str: str, delta_days: int) -> str:
    return (_parse_date(base_date_str) + timedelta(days=delta_days)).isoformat()


def _format_short_date_label(date_str: str) -> str:
    parts = date_str.split("-")
    return f"{parts[2]}/{parts[1]}" if len(parts) == 3 else date_str


def _load_allocation_and_credit_totals(
    db: Session,
    organization_id: str,
    payments: list[Payment],
) -> tuple[
    dict[str, Decimal],
    dict[str, Decimal],
    dict[str, Decimal],
    Decimal,
    Decimal,
    int,
    list[tuple[str, Decimal, str]],
]:
    """Calcule exactement (Decimal) les paiements confirmés/en attente et avoirs validés par facture."""
    allocations = (
        db.execute(
            select(PaymentAllocation).where(PaymentAllocation.organization_id == organization_id)
        )
        .scalars()
        .all()
    )
    allocs_by_payment: dict[str, list[PaymentAllocation]] = {}
    for alloc in allocations:
        allocs_by_payment.setdefault(alloc.payment_id, []).append(alloc)

    credit_notes = (
        db.execute(
            select(CreditNote).where(
                CreditNote.organization_id == organization_id,
                CreditNote.status == "VALIDATED",
            )
        )
        .scalars()
        .all()
    )
    credits_by_invoice: dict[str, Decimal] = {}
    for cn in credit_notes:
        credits_by_invoice[cn.invoice_id] = credits_by_invoice.get(cn.invoice_id, Decimal("0")) + to_decimal(cn.amount)

    confirmed_by_invoice: dict[str, Decimal] = {}
    pending_by_invoice: dict[str, Decimal] = {}
    confirmed_recovered_total = Decimal("0")
    pending_verification_amount = Decimal("0")
    pending_payments_count = 0
    confirmed_timeline_entries: list[tuple[str, Decimal, str]] = []

    for pay in payments:
        pay_allocs = allocs_by_payment.get(pay.id, [])
        if pay_allocs:
            targets = [(a.invoice_id, to_decimal(a.allocated_amount)) for a in pay_allocs]
        elif pay.invoice_id:
            targets = [(pay.invoice_id, to_decimal(pay.amount))]
        else:
            targets = []

        if pay.status in CONFIRMED_PAYMENT_STATUSES:
            confirmed_recovered_total += to_decimal(pay.amount)
            for inv_id, alloc_amt in targets:
                confirmed_by_invoice[inv_id] = confirmed_by_invoice.get(inv_id, Decimal("0")) + alloc_amt
                if pay.confirmed_at:
                    confirmed_timeline_entries.append((inv_id, alloc_amt, pay.confirmed_at[:10]))
        elif pay.status in PENDING_PAYMENT_STATUSES:
            pending_verification_amount += to_decimal(pay.amount)
            pending_payments_count += 1
            for inv_id, alloc_amt in targets:
                pending_by_invoice[inv_id] = pending_by_invoice.get(inv_id, Decimal("0")) + alloc_amt

    return (
        confirmed_by_invoice,
        pending_by_invoice,
        credits_by_invoice,
        confirmed_recovered_total,
        pending_verification_amount,
        pending_payments_count,
        confirmed_timeline_entries,
    )


def compute_invoices_snapshot(
    db: Session,
    organization_id: str,
    *,
    include_archived: bool = False,
    reference_date: str | None = None,
) -> list[ComputedInvoice]:
    ref_date = reference_date or datetime.now(timezone.utc).date().isoformat()

    clients_map = {
        c.id: c
        for c in db.execute(select(Client).where(Client.organization_id == organization_id))
        .scalars()
        .all()
    }

    inv_stmt = select(Invoice).where(Invoice.organization_id == organization_id)
    if not include_archived:
        inv_stmt = inv_stmt.where(Invoice.is_archived == 0)
    invoices = db.execute(inv_stmt.order_by(Invoice.due_date.asc())).scalars().all()

    payments = (
        db.execute(select(Payment).where(Payment.organization_id == organization_id))
        .scalars()
        .all()
    )
    promises = (
        db.execute(
            select(PromiseToPay)
            .where(
                PromiseToPay.organization_id == organization_id,
                PromiseToPay.status == "ACTIVE",
            )
            .order_by(PromiseToPay.promised_date.asc())
        )
        .scalars()
        .all()
    )
    active_disputes = (
        db.execute(
            select(Dispute).where(
                Dispute.organization_id == organization_id,
                Dispute.status.in_(list(ACTIVE_DISPUTE_STATUSES)),
            )
        )
        .scalars()
        .all()
    )

    (
        confirmed_by_invoice,
        pending_by_invoice,
        credits_by_invoice,
        _,
        _,
        _,
        _,
    ) = _load_allocation_and_credit_totals(db, organization_id, payments)

    active_promise_by_invoice: dict[str, tuple[str, int]] = {}
    for pr in promises:
        if pr.invoice_id not in active_promise_by_invoice:
            active_promise_by_invoice[pr.invoice_id] = (pr.promised_date, int(pr.promised_amount))

    open_dispute_by_invoice: dict[str, str] = {
        d.invoice_id: d.reason for d in active_disputes
    }

    computed: list[ComputedInvoice] = []
    for inv in invoices:
        client = clients_map.get(inv.client_id)
        client_name = client.name if client else "Client inconnu"

        total_dec = to_decimal(inv.total_amount)
        raw_confirmed_dec = confirmed_by_invoice.get(inv.id, Decimal("0"))
        raw_credits_dec = credits_by_invoice.get(inv.id, Decimal("0"))
        pending_dec = pending_by_invoice.get(inv.id, Decimal("0"))

        raw_remaining_dec = total_dec - raw_credits_dec - raw_confirmed_dec
        has_negative_guard = raw_remaining_dec < Decimal("0")
        remaining_dec = max(Decimal("0"), raw_remaining_dec)

        # Montants effectifs plafonnés de manière cohérente si une anomalie historique existait
        credits_dec = min(total_dec, raw_credits_dec)
        confirmed_dec = min(max(Decimal("0"), total_dec - credits_dec), raw_confirmed_dec)

        raw_delay = diff_days_utc(ref_date, inv.due_date)
        delay_days = raw_delay if (remaining_dec > 0 and raw_delay > 0) else 0
        is_overdue = remaining_dec > 0 and delay_days > 0
        is_partially_paid = remaining_dec > 0 and (confirmed_dec > 0 or credits_dec > 0)

        has_dispute = bool(inv.has_dispute == 1 or inv.id in open_dispute_by_invoice)
        dispute_reason = open_dispute_by_invoice.get(inv.id) or inv.dispute_reason
        active_promise = active_promise_by_invoice.get(inv.id)
        is_promise_overdue = bool(
            active_promise is not None and active_promise[0] < ref_date and remaining_dec > 0
        )

        # Règles de priorité des statuts financiers
        if remaining_dec == 0:
            status = "PAID"
        elif has_dispute:
            status = "DISPUTE"
        elif active_promise is not None:
            status = "PROMISE"
        elif is_overdue:
            status = "OVERDUE"
        elif confirmed_dec > 0 or credits_dec > 0:
            status = "PARTIAL"
        else:
            status = "UPCOMING"

        computed.append(
            ComputedInvoice(
                id=inv.id,
                reference=inv.reference,
                client_id=inv.client_id,
                client_name=client_name,
                issue_date=inv.issue_date,
                due_date=inv.due_date,
                currency=getattr(inv, "currency", None) or "XOF",
                description=getattr(inv, "description", None),
                total_amount=dec_to_amount(total_dec),
                confirmed_paid_amount=dec_to_amount(confirmed_dec),
                validated_credit_notes_amount=dec_to_amount(credits_dec),
                pending_verification_amount=dec_to_amount(pending_dec),
                remaining_amount=dec_to_amount(remaining_dec),
                has_negative_balance_guard=has_negative_guard,
                delay_days=delay_days,
                is_overdue=is_overdue,
                is_partially_paid=is_partially_paid,
                has_dispute=has_dispute,
                dispute_reason=dispute_reason,
                active_promise_date=active_promise[0] if active_promise else None,
                active_promise_amount=active_promise[1] if active_promise else None,
                is_promise_overdue=is_promise_overdue,
                is_archived=inv.is_archived == 1,
                status=status,
            )
        )

    return computed


def compute_client_financials_map(
    db: Session,
    organization_id: str,
    reference_date: str | None = None,
) -> dict[str, dict[str, Any]]:
    ref_date = reference_date or datetime.now(timezone.utc).date().isoformat()

    clients = (
        db.execute(select(Client).where(Client.organization_id == organization_id))
        .scalars()
        .all()
    )
    computed_invoices = compute_invoices_snapshot(
        db,
        organization_id,
        include_archived=False,
        reference_date=ref_date,
    )
    payments = (
        db.execute(select(Payment).where(Payment.organization_id == organization_id))
        .scalars()
        .all()
    )

    confirmed_by_invoice_int = {inv.id: inv.confirmed_paid_amount for inv in computed_invoices}
    pending_by_invoice_int = {inv.id: inv.pending_verification_amount for inv in computed_invoices}

    pending_count_by_client: dict[str, int] = {}
    pending_amount_by_client: dict[str, Decimal] = {}
    for pay in payments:
        if pay.status in PENDING_PAYMENT_STATUSES:
            pending_count_by_client[pay.client_id] = pending_count_by_client.get(pay.client_id, 0) + 1
            pending_amount_by_client[pay.client_id] = (
                pending_amount_by_client.get(pay.client_id, Decimal("0")) + to_decimal(pay.amount)
            )

    invoices_by_client: dict[str, list[ComputedInvoice]] = {}
    for inv in computed_invoices:
        invoices_by_client.setdefault(inv.client_id, []).append(inv)

    result: dict[str, dict[str, Any]] = {}
    for client in clients:
        client_invoices = invoices_by_client.get(client.id, [])
        total_billed = Decimal("0")
        total_paid_confirmed = Decimal("0")
        remaining_amount = Decimal("0")
        overdue_amount = Decimal("0")
        open_invoices_count = 0
        overdue_invoices_count = 0
        active_promises_count = 0
        open_disputes_count = 0

        for inv in client_invoices:
            total_billed += to_decimal(inv.total_amount)
            total_paid_confirmed += to_decimal(inv.confirmed_paid_amount)
            if inv.remaining_amount > 0:
                open_invoices_count += 1
                remaining_amount += to_decimal(inv.remaining_amount)
                if inv.is_overdue:
                    overdue_invoices_count += 1
                    overdue_amount += to_decimal(inv.remaining_amount)
                if inv.has_dispute:
                    open_disputes_count += 1
                if inv.active_promise_date is not None:
                    active_promises_count += 1

        if client.is_archived == 1:
            global_status = "ARCHIVED"
        elif open_disputes_count > 0:
            global_status = "DISPUTE"
        elif overdue_invoices_count > 0:
            global_status = "OVERDUE"
        elif active_promises_count > 0:
            global_status = "PROMISE"
        elif len(client_invoices) > 0 and remaining_amount == 0:
            global_status = "SETTLED"
        else:
            global_status = "UP_TO_DATE"

        result[client.id] = {
            "totalBilled": dec_to_amount(total_billed),
            "totalPaidConfirmed": dec_to_amount(total_paid_confirmed),
            "remainingAmount": dec_to_amount(remaining_amount),
            "overdueAmount": dec_to_amount(overdue_amount),
            "pendingVerificationAmount": dec_to_amount(
                pending_amount_by_client.get(client.id, Decimal("0"))
            ),
            "invoicesCount": len(client_invoices),
            "openInvoicesCount": open_invoices_count,
            "overdueInvoicesCount": overdue_invoices_count,
            "pendingPaymentsCount": pending_count_by_client.get(client.id, 0),
            "activePromisesCount": active_promises_count,
            "openDisputesCount": open_disputes_count,
            "globalStatus": global_status,
            "confirmedByInvoice": confirmed_by_invoice_int,
            "pendingByInvoice": pending_by_invoice_int,
        }

    return result


def compute_dashboard_metrics(
    db: Session,
    organization_id: str,
    period_days: int = 30,
    reference_date: str | None = None,
) -> dict[str, Any]:
    ref_date = reference_date or datetime.now(timezone.utc).date().isoformat()
    safe_period = period_days if period_days in (7, 30, 90) else 30

    demo_meta = db.get(AppMeta, f"demo_data_active:{organization_id}") or db.get(
        AppMeta, "demo_data_active"
    )
    is_demo_data_active = demo_meta is not None and demo_meta.meta_value == "1"

    clients = (
        db.execute(
            select(Client).where(
                Client.organization_id == organization_id,
                Client.is_archived == 0,
            )
        )
        .scalars()
        .all()
    )

    payments = (
        db.execute(select(Payment).where(Payment.organization_id == organization_id))
        .scalars()
        .all()
    )

    reminders = (
        db.execute(
            select(Reminder).where(
                Reminder.organization_id == organization_id,
                Reminder.status.in_(["PLANNED", "PREPARED"]),
            )
        )
        .scalars()
        .all()
    )

    (
        _,
        _,
        credits_by_invoice,
        confirmed_recovered_total_dec,
        pending_verification_amount_dec,
        pending_payments_count,
        confirmed_timeline_entries,
    ) = _load_allocation_and_credit_totals(db, organization_id, payments)

    computed_invoices = compute_invoices_snapshot(
        db,
        organization_id,
        include_archived=False,
        reference_date=ref_date,
    )

    total_open_receivables_dec = Decimal("0")
    overdue_receivables_dec = Decimal("0")
    not_yet_due_receivables_dec = Decimal("0")
    total_billed_portfolio_dec = Decimal("0")
    open_invoices_count = 0
    overdue_invoices_count = 0
    active_promises_count = 0
    disputes_count = 0

    for inv in computed_invoices:
        total_billed_portfolio_dec += to_decimal(inv.total_amount)
        if inv.remaining_amount > 0:
            open_invoices_count += 1
            rem_dec = to_decimal(inv.remaining_amount)
            total_open_receivables_dec += rem_dec
            if inv.is_overdue:
                overdue_receivables_dec += rem_dec
                overdue_invoices_count += 1
            else:
                not_yet_due_receivables_dec += rem_dec
            if inv.has_dispute:
                disputes_count += 1
            elif inv.active_promise_date is not None:
                active_promises_count += 1

    if total_billed_portfolio_dec > 0:
        rate_dec = (confirmed_recovered_total_dec / total_billed_portfolio_dec) * Decimal("100")
        recovery_rate_percent = float(rate_dec.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
    else:
        recovery_rate_percent = None

    status_defs = [
        ("UPCOMING", "À échoir", False),
        ("OVERDUE", "En retard", False),
        ("PARTIAL", "Partiellement payées", False),
        ("DISPUTE", "En litige", False),
        ("PROMISE", "Promesse en cours", False),
        ("PAID", "Soldées", True),
    ]
    status_breakdown: list[dict[str, Any]] = []
    for st_key, st_label, excluded in status_defs:
        matching = [inv for inv in computed_invoices if inv.status == st_key]
        amount_dec = sum(
            (to_decimal(inv.total_amount) if st_key == "PAID" else to_decimal(inv.remaining_amount) for inv in matching),
            Decimal("0"),
        )
        status_breakdown.append(
            {
                "status": st_key,
                "label": st_label,
                "count": len(matching),
                "amount": dec_to_amount(amount_dec),
                "excludedFromOpen": excluded,
            }
        )

    invoice_map = {inv.id: inv for inv in computed_invoices}
    priorities: list[dict[str, Any]] = []

    for pay in payments:
        if pay.status in PENDING_PAYMENT_STATUSES:
            target_inv_id = pay.invoice_id
            if not target_inv_id:
                continue
            inv = invoice_map.get(target_inv_id)
            if not inv or inv.remaining_amount == 0:
                continue
            reason = (
                f"Justificatif reçu ({pay.payment_method or 'Paiement'}) en attente de confirmation."
                if pay.status == "RECEIPT_RECEIVED"
                else "Paiement déclaré par le client sans confirmation définitive."
            )
            priorities.append(
                {
                    "id": f"pay-{pay.id}",
                    "kind": "PAYMENT_TO_VERIFY",
                    "clientName": inv.client_name,
                    "invoiceReference": inv.reference,
                    "remainingAmount": inv.remaining_amount,
                    "pendingAmount": int(pay.amount),
                    "delayDays": inv.delay_days,
                    "reason": reason,
                    "recommendedAction": "Contrôler le justificatif",
                    "targetSection": "payments",
                    "targetFilter": "pending",
                    "urgencyRank": 90,
                    "isAiGenerated": False,
                }
            )

    for inv in computed_invoices:
        if inv.remaining_amount == 0:
            continue
        if inv.has_dispute:
            priorities.append(
                {
                    "id": f"dispute-{inv.id}",
                    "kind": "DISPUTE",
                    "clientName": inv.client_name,
                    "invoiceReference": inv.reference,
                    "remainingAmount": inv.remaining_amount,
                    "delayDays": inv.delay_days,
                    "reason": (
                        f"Litige actif : {inv.dispute_reason}"
                        if inv.dispute_reason
                        else "Litige actif suspendant les relances automatiques."
                    ),
                    "recommendedAction": "Traiter le litige client",
                    "targetSection": "invoices",
                    "targetFilter": "dispute",
                    "urgencyRank": 85,
                    "isAiGenerated": False,
                }
            )
            continue

        if inv.active_promise_date:
            days_until = diff_days_utc(inv.active_promise_date, ref_date)
            if days_until <= 3:
                if days_until < 0:
                    p_reason = f"Promesse de règlement dépassée depuis {abs(days_until)} jour(s)."
                elif days_until == 0:
                    p_reason = "Promesse de paiement arrivant à échéance aujourd’hui."
                else:
                    p_reason = f"Promesse de paiement attendue sous {days_until} jour(s)."
                priorities.append(
                    {
                        "id": f"promise-{inv.id}",
                        "kind": "PROMISE_DUE",
                        "clientName": inv.client_name,
                        "invoiceReference": inv.reference,
                        "remainingAmount": inv.remaining_amount,
                        "delayDays": inv.delay_days,
                        "reason": p_reason,
                        "recommendedAction": "Vérifier le respect de la promesse",
                        "targetSection": "invoices",
                        "targetFilter": "promise",
                        "urgencyRank": 95 if days_until < 0 else 80,
                        "isAiGenerated": False,
                    }
                )
            continue

        if inv.delay_days >= 15:
            priorities.append(
                {
                    "id": f"overdue-{inv.id}",
                    "kind": "OVERDUE_CRITICAL",
                    "clientName": inv.client_name,
                    "invoiceReference": inv.reference,
                    "remainingAmount": inv.remaining_amount,
                    "delayDays": inv.delay_days,
                    "reason": f"Retard critique de {inv.delay_days} jours sans règlement confirmé.",
                    "recommendedAction": "Préparer une relance prioritaire",
                    "targetSection": "reminders",
                    "targetFilter": "priority",
                    "urgencyRank": 88 + min(10, inv.delay_days // 10),
                    "isAiGenerated": False,
                }
            )
        elif inv.delay_days > 0 and inv.remaining_amount >= 1_000_000:
            priorities.append(
                {
                    "id": f"high-{inv.id}",
                    "kind": "HIGH_AMOUNT_OVERDUE",
                    "clientName": inv.client_name,
                    "invoiceReference": inv.reference,
                    "remainingAmount": inv.remaining_amount,
                    "delayDays": inv.delay_days,
                    "reason": f"Créance d’un montant élevé arrivée à échéance ({inv.delay_days} j de retard).",
                    "recommendedAction": "Planifier un rappel client",
                    "targetSection": "reminders",
                    "targetFilter": "priority",
                    "urgencyRank": 75,
                    "isAiGenerated": False,
                }
            )

    prepared_reminders_count = sum(1 for r in reminders if r.status == "PREPARED")
    for rem in reminders:
        if rem.status != "PREPARED":
            continue
        inv = invoice_map.get(rem.invoice_id)
        if not inv or inv.remaining_amount == 0 or inv.has_dispute:
            continue
        ch_label = "WhatsApp" if rem.channel == "WHATSAPP" else "Email"
        priorities.append(
            {
                "id": f"rem-{rem.id}",
                "kind": "REMINDER_TO_VALIDATE",
                "clientName": inv.client_name,
                "invoiceReference": inv.reference,
                "remainingAmount": inv.remaining_amount,
                "delayDays": inv.delay_days,
                "reason": f"Relance {ch_label} préparée en attente de validation humaine.",
                "recommendedAction": "Relire et valider l’envoi",
                "targetSection": "reminders",
                "targetFilter": "to-validate",
                "urgencyRank": 72,
                "isAiGenerated": False,
            }
        )

    priorities.sort(key=lambda item: (-int(item["urgencyRank"]), -int(item["remainingAmount"])))

    evolution: list[dict[str, Any]] = []
    if computed_invoices:
        step_days = 1 if safe_period == 7 else (5 if safe_period == 30 else 15)
        start_offset = -(safe_period - 1)
        point_dates: list[str] = []
        offset = start_offset
        while offset <= 0:
            point_dates.append(_add_days_iso(ref_date, offset))
            offset += step_days
        if not point_dates or point_dates[-1] != ref_date:
            point_dates.append(ref_date)

        for point_date in point_dates:
            recovered_at_date = sum(
                (amt for _inv_id, amt, conf_date in confirmed_timeline_entries if conf_date <= point_date),
                Decimal("0"),
            )
            open_at_date = Decimal("0")
            overdue_at_date = Decimal("0")
            for inv in computed_invoices:
                if inv.issue_date > point_date:
                    continue
                paid_until = sum(
                    (
                        amt
                        for inv_id, amt, conf_date in confirmed_timeline_entries
                        if inv_id == inv.id and conf_date <= point_date
                    ),
                    Decimal("0"),
                )
                credits_inv = credits_by_invoice.get(inv.id, Decimal("0"))
                rem_at = max(Decimal("0"), to_decimal(inv.total_amount) - credits_inv - paid_until)
                open_at_date += rem_at
                if rem_at > 0 and inv.due_date < point_date:
                    overdue_at_date += rem_at
            evolution.append(
                {
                    "date": point_date,
                    "label": _format_short_date_label(point_date),
                    "openAmount": dec_to_amount(open_at_date),
                    "recoveredAmount": dec_to_amount(recovered_at_date),
                    "overdueAmount": dec_to_amount(overdue_at_date),
                }
            )

    return {
        "referenceDate": ref_date,
        "isEmpty": len(computed_invoices) == 0 and len(clients) == 0,
        "isDemoDataActive": is_demo_data_active,
        "counts": {
            "clientsCount": len(clients),
            "invoicesCount": len(computed_invoices),
            "openInvoicesCount": open_invoices_count,
            "overdueInvoicesCount": overdue_invoices_count,
            "pendingPaymentsCount": pending_payments_count,
            "preparedRemindersCount": prepared_reminders_count,
            "activePromisesCount": active_promises_count,
            "disputesCount": disputes_count,
        },
        "kpis": {
            "totalOpenReceivables": dec_to_amount(total_open_receivables_dec),
            "overdueReceivables": dec_to_amount(overdue_receivables_dec),
            "notYetDueReceivables": dec_to_amount(not_yet_due_receivables_dec),
            "pendingVerificationAmount": dec_to_amount(pending_verification_amount_dec),
            "confirmedRecoveredTotal": dec_to_amount(confirmed_recovered_total_dec),
            "totalBilledPortfolio": dec_to_amount(total_billed_portfolio_dec),
            "recoveryRatePercent": recovery_rate_percent,
            "recoveryFormula": "Montants confirmés et enregistrés divisés par le total facturé du portefeuille suivi",
            "recoveryPeriodLabel": "Portefeuille global suivi",
        },
        "priorities": priorities[:8],
        "statusBreakdown": status_breakdown,
        "evolution": evolution,
    }
