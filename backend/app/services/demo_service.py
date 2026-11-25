from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import uuid

from sqlalchemy import delete
from sqlalchemy.orm import Session

from backend.app.core.security import utc_now_iso
from backend.app.models.audit import ActivityLog
from backend.app.models.client import Client, CommunicationPreference
from backend.app.models.documents import Document, ImportBatch
from backend.app.models.idempotency import IdempotencyRecord
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


def _offset_date(base_date_str: str, delta_days: int) -> str:
    return (date.fromisoformat(base_date_str) + timedelta(days=delta_days)).isoformat()


def _upsert_meta(db: Session, key: str, value: str) -> None:
    row = db.get(AppMeta, key)
    if row is None:
        db.add(AppMeta(meta_key=key, meta_value=value))
    else:
        row.meta_value = value


def seed_demo_portfolio(
    db: Session,
    *,
    organization_id: str = "org-default",
    reference_date: str | None = None,
    actor_label: str = "Initialisation démonstration",
    only_if_never_seeded: bool = False,
) -> bool:
    seeded_key = f"demo_seeded_once:{organization_id}"
    active_key = f"demo_data_active:{organization_id}"

    if only_if_never_seeded:
        existing_global = db.get(AppMeta, "demo_seeded_once")
        existing_org = db.get(AppMeta, seeded_key)
        if existing_global is not None or existing_org is not None:
            return False

    ref_date = reference_date or datetime.now(timezone.utc).date().isoformat()
    now_iso = utc_now_iso()

    try:
        # Nettoie d'abord les données métier de cette organisation
        db.execute(delete(Document).where(Document.organization_id == organization_id))
        db.execute(delete(Reminder).where(Reminder.organization_id == organization_id))
        db.execute(delete(Dispute).where(Dispute.organization_id == organization_id))
        db.execute(delete(PromiseToPay).where(PromiseToPay.organization_id == organization_id))
        db.execute(delete(CreditNote).where(CreditNote.organization_id == organization_id))
        db.execute(delete(PaymentAllocation).where(PaymentAllocation.organization_id == organization_id))
        db.execute(delete(Payment).where(Payment.organization_id == organization_id))
        db.execute(delete(Invoice).where(Invoice.organization_id == organization_id))
        db.execute(delete(ImportBatch).where(ImportBatch.organization_id == organization_id))
        db.execute(delete(IdempotencyRecord).where(IdempotencyRecord.organization_id == organization_id))
        db.execute(
            delete(CommunicationPreference).where(
                CommunicationPreference.organization_id == organization_id
            )
        )
        db.execute(delete(Client).where(Client.organization_id == organization_id))
        db.execute(
            delete(ActivityLog).where(
                ActivityLog.organization_id == organization_id,
                ActivityLog.category == "RECOVERY",
            )
        )

        import_id = f"imp-demo-{organization_id}"
        db.add(
            ImportBatch(
                id=import_id,
                organization_id=organization_id,
                filename="creances_portefeuille_benin.csv",
                source_type="CSV",
                status="VALIDATED",
                total_rows=8,
                imported_rows=8,
                duplicate_rows=0,
                error_rows=0,
                created_by="gestionnaire@recouvrix.demo",
                created_at=f"{_offset_date(ref_date, -10)}T09:10:00Z",
                updated_at=f"{_offset_date(ref_date, -10)}T09:10:00Z",
            )
        )
        db.flush()

        demo_clients = [
            (
                "cli-1",
                "SOGECOT Bénin SARL",
                "COMPANY",
                "IFU 3201810459211",
                "Boulevard Saint-Michel, Lot 412, Cotonou",
                "Kossi Agbo",
                "compta@sogecot.bj",
                "+229 01 97 12 34 00",
                "Direction financière · +229 01 97 12 34 05",
                "EMAIL",
                True,
                "Lun–Ven · 08h30 – 17h30",
                None,
            ),
            (
                "cli-2",
                "Atlantique Matériaux SA",
                "COMPANY",
                "IFU 3201409823410",
                "Zone Industrielle Akpakpa, Cotonou",
                "Amina Bello",
                "finance@atlantique-mat.bj",
                "+229 01 96 44 10 22",
                None,
                "WHATSAPP",
                True,
                "Lun–Ven · 09h00 – 16h00",
                "Privilégier les confirmations écrites avant appel téléphonique.",
            ),
            (
                "cli-3",
                "Clinique Les Palmiers",
                "COMPANY",
                "IFU 3201905541208",
                "Quartier Haie Vive, Rue 318, Cotonou",
                "Dr. Brice Houngbédji",
                "direction@lespalmiers.bj",
                "+229 01 95 30 88 14",
                "Secrétariat comptable · compta@lespalmiers.bj",
                "EMAIL",
                True,
                "Mar–Ven · 10h00 – 15h00",
                "Relances suspendues tant que le litige sur la livraison reste ouvert.",
            ),
            (
                "cli-4",
                "Transit Portuaire Cotonou",
                "COMPANY",
                "IFU 3201103349012",
                "Avenue de la Marina, Face Port Autonome, Cotonou",
                "Sèna Mensah",
                "tresorerie@tpc-benin.bj",
                "+229 01 97 80 51 09",
                None,
                "EMAIL",
                True,
                "Lun–Ven · 08h00 – 17h00",
                None,
            ),
            (
                "cli-5",
                "Éric Tossou (Imprimerie du Golfe)",
                "INDIVIDUAL",
                "IFU 1201708843201",
                "Carrefour Dantokpa, Porto-Novo / Cotonou",
                "Éric Tossou",
                "eric@imprimeriegolfe.bj",
                "+229 01 94 22 67 30",
                None,
                "WHATSAPP",
                True,
                "Lun–Sam · 09h00 – 18h00",
                None,
            ),
            (
                "cli-6",
                "Distribution Akpakpa",
                "COMPANY",
                "IFU 3202011294503",
                "Akpakpa Dodomè, Parcelle 88, Cotonou",
                "Chantal Zinsou",
                "achat@akpakpa-distrib.bj",
                "+229 01 96 11 45 77",
                None,
                "EMAIL",
                True,
                "Lun–Ven · 08h30 – 17h00",
                None,
            ),
        ]

        suffix = "" if organization_id == "org-default" else f"-{organization_id[:8]}"
        client_id_map: dict[str, str] = {}

        for (
            cid,
            name,
            ctype,
            tax_id,
            addr,
            contact,
            email,
            phone,
            sec,
            chan,
            allowed,
            hours,
            restr,
        ) in demo_clients:
            actual_cid = f"{cid}{suffix}"
            client_id_map[cid] = actual_cid
            db.add(
                Client(
                    id=actual_cid,
                    organization_id=organization_id,
                    name=name,
                    client_type=ctype,
                    tax_id=tax_id,
                    address=addr,
                    contact_name=contact,
                    email=email,
                    phone=phone,
                    secondary_contact=sec,
                    preferred_channel=chan,
                    notes=None,
                    is_archived=0,
                    created_at=now_iso,
                    updated_at=now_iso,
                )
            )
            db.add(
                CommunicationPreference(
                    id=f"pref-{actual_cid}",
                    organization_id=organization_id,
                    client_id=actual_cid,
                    preferred_channel=chan,
                    contact_allowed=1 if allowed else 0,
                    contact_hours=hours,
                    restrictions_note=restr,
                    created_at=now_iso,
                    updated_at=now_iso,
                )
            )
        db.flush()

        invoices_data = [
            ("inv-1", f"FAC-2026-0418{suffix}", "cli-1", _offset_date(ref_date, -58), _offset_date(ref_date, -28), 2450000, 0, None, "Fourniture de lots de quincaillerie industrielle — Bon de livraison BL-418"),
            ("inv-2", f"FAC-2026-0425{suffix}", "cli-2", _offset_date(ref_date, -42), _offset_date(ref_date, -12), 1850000, 0, None, "Livraison ciment et fer à béton — Chantier Akpakpa"),
            ("inv-3", f"FAC-2026-0429{suffix}", "cli-4", _offset_date(ref_date, -38), _offset_date(ref_date, -8), 3000000, 0, None, "Prestations de dédouanement et manutention conteneur #TCNU-409"),
            ("inv-4", f"FAC-2026-0421{suffix}", "cli-3", _offset_date(ref_date, -49), _offset_date(ref_date, -19), 1400000, 1, "Écart contesté sur la quantité livrée", "Équipements médicaux consommables — Commande CMP-0421"),
            ("inv-5", f"FAC-2026-0434{suffix}", "cli-5", _offset_date(ref_date, -35), _offset_date(ref_date, -5), 950000, 0, None, "Impression catalogues commerciaux et brochures institutionnelles"),
            ("inv-6", f"FAC-2026-0445{suffix}", "cli-6", _offset_date(ref_date, -15), _offset_date(ref_date, 10), 1650000, 0, None, "Approvisionnement marchandises générales — Lot novembre"),
            ("inv-7", f"FAC-2026-0402{suffix}", "cli-6", _offset_date(ref_date, -70), _offset_date(ref_date, -40), 2200000, 0, None, "Approvisionnement marchandises générales — Lot octobre"),
            ("inv-8", f"FAC-2026-0411{suffix}", "cli-1", _offset_date(ref_date, -50), _offset_date(ref_date, -20), 1100000, 0, None, "Maintenance préventive équipements de levage — Trimestre 3"),
        ]
        inv_id_map: dict[str, str] = {}
        for iid, ref, cid_key, issue_d, due_d, amt, has_disp, disp_reason, inv_desc in invoices_data:
            actual_iid = f"{iid}{suffix}"
            inv_id_map[iid] = actual_iid
            db.add(
                Invoice(
                    id=actual_iid,
                    organization_id=organization_id,
                    reference=ref,
                    client_id=client_id_map[cid_key],
                    import_id=import_id,
                    issue_date=issue_d,
                    due_date=due_d,
                    total_amount=amt,
                    currency="XOF",
                    description=inv_desc,
                    has_dispute=has_disp,
                    dispute_reason=disp_reason,
                    is_archived=0,
                    created_at=now_iso,
                    updated_at=now_iso,
                )
            )
        db.flush()

        payments_data = [
            ("pay-1", f"PAY-2026-0081{suffix}", "inv-7", "cli-6", 2200000, "RECORDED", "Virement bancaire", f"{_offset_date(ref_date, -38)}T10:15:00Z", f"{_offset_date(ref_date, -37)}T14:20:00Z"),
            ("pay-2", f"PAY-2026-0088{suffix}", "inv-8", "cli-1", 1100000, "CONFIRMED", "Virement bancaire", f"{_offset_date(ref_date, -18)}T09:00:00Z", f"{_offset_date(ref_date, -16)}T11:30:00Z"),
            ("pay-3", f"PAY-2026-0092{suffix}", "inv-3", "cli-4", 1200000, "CONFIRMED", "Virement bancaire", f"{_offset_date(ref_date, -6)}T15:10:00Z", f"{_offset_date(ref_date, -5)}T16:00:00Z"),
            ("pay-4", f"PAY-2026-0097{suffix}", "inv-2", "cli-2", 850000, "RECEIPT_RECEIVED", "MTN Mobile Money", f"{_offset_date(ref_date, -1)}T11:40:00Z", None),
            ("pay-5", f"PAY-2026-0099{suffix}", "inv-5", "cli-5", 450000, "DECLARED", "Virement bancaire", f"{ref_date}T08:15:00Z", None),
        ]
        for pid, ref, iid_key, cid_key, amt, st, method, decl_at, conf_at in payments_data:
            actual_pid = f"{pid}{suffix}"
            actual_iid = inv_id_map[iid_key]
            db.add(
                Payment(
                    id=actual_pid,
                    organization_id=organization_id,
                    reference=ref,
                    invoice_id=actual_iid,
                    client_id=client_id_map[cid_key],
                    amount=amt,
                    status=st,
                    payment_method=method,
                    declared_at=decl_at,
                    confirmed_at=conf_at,
                    created_by="gestionnaire@recouvrix.demo",
                    created_at=decl_at,
                    updated_at=conf_at or decl_at,
                )
            )
            db.flush()
            db.add(
                PaymentAllocation(
                    id=f"alloc-{actual_pid}",
                    organization_id=organization_id,
                    payment_id=actual_pid,
                    invoice_id=actual_iid,
                    allocated_amount=amt,
                    created_at=decl_at,
                )
            )
        db.flush()

        db.add(
            PromiseToPay(
                id=f"prom-1{suffix}",
                organization_id=organization_id,
                invoice_id=inv_id_map["inv-5"],
                client_id=client_id_map["cli-5"],
                promised_amount=950000,
                promised_date=_offset_date(ref_date, 1),
                status="ACTIVE",
                note="Règlement complet annoncé par virement avant fin de journée demain.",
                recorded_by="gestionnaire@recouvrix.demo",
                created_at=now_iso,
                updated_at=now_iso,
            )
        )

        db.add(
            Dispute(
                id=f"disp-1{suffix}",
                organization_id=organization_id,
                invoice_id=inv_id_map["inv-4"],
                client_id=client_id_map["cli-3"],
                category="QUANTITY_DISCREPANCY",
                reason="Écart contesté sur la quantité livrée",
                status="OPEN",
                opened_by="gestionnaire@recouvrix.demo",
                opened_at=f"{_offset_date(ref_date, -3)}T14:25:00Z",
                created_at=f"{_offset_date(ref_date, -3)}T14:25:00Z",
                updated_at=now_iso,
            )
        )

        db.add(
            Reminder(
                id=f"rem-1{suffix}",
                organization_id=organization_id,
                invoice_id=inv_id_map["inv-1"],
                client_id=client_id_map["cli-1"],
                channel="EMAIL",
                status="PREPARED",
                scheduled_for=ref_date,
                subject="Relance facture FAC-2026-0418 échue",
                created_at=now_iso,
                updated_at=now_iso,
            )
        )
        db.add(
            Reminder(
                id=f"rem-2{suffix}",
                organization_id=organization_id,
                invoice_id=inv_id_map["inv-3"],
                client_id=client_id_map["cli-4"],
                channel="EMAIL",
                status="PREPARED",
                scheduled_for=ref_date,
                subject="Suivi du solde restant sur FAC-2026-0429",
                created_at=now_iso,
                updated_at=now_iso,
            )
        )

        db.add(
            Document(
                id=f"doc-1{suffix}",
                organization_id=organization_id,
                client_id=client_id_map["cli-1"],
                invoice_id=inv_id_map["inv-1"],
                payment_id=None,
                import_id=import_id,
                doc_type="FACTURE_PDF",
                title="Facture FAC-2026-0418 — SOGECOT Bénin SARL",
                file_name="FAC-2026-0418.pdf",
                mime_type="application/pdf",
                file_size=184320,
                storage_key=f"demo/{organization_id}/FAC-2026-0418.pdf",
                uploaded_by="gestionnaire@recouvrix.demo",
                created_at=f"{_offset_date(ref_date, -10)}T09:12:00Z",
                updated_at=now_iso,
            )
        )
        db.add(
            Document(
                id=f"doc-2{suffix}",
                organization_id=organization_id,
                client_id=client_id_map["cli-2"],
                invoice_id=inv_id_map["inv-2"],
                payment_id=f"pay-4{suffix}",
                import_id=None,
                doc_type="JUSTIFICATIF_PAIEMENT",
                title="Reçu MTN Mobile Money — PAY-2026-0097",
                file_name="recu-momo-0097.pdf",
                mime_type="application/pdf",
                file_size=94210,
                storage_key=f"demo/{organization_id}/recu-momo-0097.pdf",
                uploaded_by="gestionnaire@recouvrix.demo",
                created_at=f"{_offset_date(ref_date, -1)}T11:42:00Z",
                updated_at=now_iso,
            )
        )

        logs_data = [
            ("IMPORT_BATCH", "gestionnaire@recouvrix.demo", "Import CSV", None, None, "Importation validée de 8 factures et 6 dossiers clients.", f"{_offset_date(ref_date, -10)}T09:10:00Z"),
            ("CLIENT_CREATED", "gestionnaire@recouvrix.demo", "SOGECOT Bénin SARL", "CLIENT", client_id_map["cli-1"], "Création de la fiche client SOGECOT Bénin SARL.", f"{_offset_date(ref_date, -10)}T09:11:00Z"),
            ("PAYMENT_CONFIRMED", "gestionnaire@recouvrix.demo", "FAC-2026-0429", "CLIENT", client_id_map["cli-4"], "Confirmation d’un acompte de 1 200 000 FCFA sur FAC-2026-0429.", f"{_offset_date(ref_date, -5)}T16:00:00Z"),
            ("DISPUTE_OPENED", "gestionnaire@recouvrix.demo", "FAC-2026-0421", "CLIENT", client_id_map["cli-3"], "Mise en litige de FAC-2026-0421 (Clinique Les Palmiers) : relances suspendues.", f"{_offset_date(ref_date, -3)}T14:25:00Z"),
            ("RECEIPT_RECEIVED", "gestionnaire@recouvrix.demo", "PAY-2026-0097", "CLIENT", client_id_map["cli-2"], "Justificatif Mobile Money reçu pour Atlantique Matériaux SA (850 000 FCFA) — à vérifier.", f"{_offset_date(ref_date, -1)}T11:45:00Z"),
            ("REMINDER_PREPARED", "Système d’assistance", "FAC-2026-0418", "CLIENT", client_id_map["cli-1"], "Relance Email préparée pour SOGECOT Bénin SARL en attente de validation.", f"{ref_date}T08:05:00Z"),
            ("PAYMENT_DECLARED", "gestionnaire@recouvrix.demo", "PAY-2026-0099", "CLIENT", client_id_map["cli-5"], "Paiement déclaré de 450 000 FCFA par Éric Tossou sans justificatif joint.", f"{ref_date}T08:15:00Z"),
        ]
        for ev_type, actor, t_label, ent_type, ent_id, summary, ts in logs_data:
            db.add(
                ActivityLog(
                    id=str(uuid.uuid4()),
                    organization_id=organization_id,
                    event_type=ev_type,
                    category="RECOVERY",
                    actor_label=actor,
                    target_label=t_label,
                    entity_type=ent_type,
                    entity_id=ent_id,
                    summary=summary,
                    created_at=ts,
                )
            )

        _upsert_meta(db, seeded_key, "1")
        _upsert_meta(db, active_key, "1")
        _upsert_meta(db, "demo_seeded_once", "1")
        _upsert_meta(db, "demo_data_active", "1")

        db.add(
            ActivityLog(
                id=str(uuid.uuid4()),
                organization_id=organization_id,
                event_type="DEMO_DATA_SEEDED",
                category="RECOVERY",
                actor_label=actor_label,
                summary="Jeu de données de démonstration initialisé.",
                created_at=now_iso,
            )
        )
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise


def clear_business_portfolio(
    db: Session,
    *,
    organization_id: str = "org-default",
    actor_label: str = "Administrateur",
) -> None:
    now_iso = utc_now_iso()
    try:
        db.execute(delete(Document).where(Document.organization_id == organization_id))
        db.execute(delete(Reminder).where(Reminder.organization_id == organization_id))
        db.execute(delete(Dispute).where(Dispute.organization_id == organization_id))
        db.execute(delete(PromiseToPay).where(PromiseToPay.organization_id == organization_id))
        db.execute(delete(CreditNote).where(CreditNote.organization_id == organization_id))
        db.execute(delete(PaymentAllocation).where(PaymentAllocation.organization_id == organization_id))
        db.execute(delete(Payment).where(Payment.organization_id == organization_id))
        db.execute(delete(Invoice).where(Invoice.organization_id == organization_id))
        db.execute(delete(ImportBatch).where(ImportBatch.organization_id == organization_id))
        db.execute(delete(IdempotencyRecord).where(IdempotencyRecord.organization_id == organization_id))
        db.execute(
            delete(CommunicationPreference).where(
                CommunicationPreference.organization_id == organization_id
            )
        )
        db.execute(delete(Client).where(Client.organization_id == organization_id))
        db.execute(
            delete(ActivityLog).where(
                ActivityLog.organization_id == organization_id,
                ActivityLog.category == "RECOVERY",
            )
        )

        _upsert_meta(db, f"demo_data_active:{organization_id}", "0")
        _upsert_meta(db, "demo_data_active", "0")

        db.add(
            ActivityLog(
                id=str(uuid.uuid4()),
                organization_id=organization_id,
                event_type="DEMO_DATA_CLEARED",
                category="SECURITY",
                actor_label=actor_label,
                summary="Données métier vidées pour contrôle à vide.",
                created_at=now_iso,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
