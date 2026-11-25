"""Enrichissement non destructif des dossiers clients de présentation préexistants.

Revision ID: 0002_enrich_demo_clients
Revises: 0001_recouvrix_saas
Create Date: 2026-11-25 18:15:00
"""
from __future__ import annotations

from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa

revision = "0002_enrich_demo_clients"
down_revision = "0001_recouvrix_saas"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    enrichments = [
        (
            "cli-1",
            "COMPANY",
            "IFU 3201810459211",
            "Boulevard Saint-Michel, Lot 412, Cotonou",
            "Direction financière · +229 01 97 12 34 05",
            "Lun–Ven · 08h30 – 17h30",
            None,
        ),
        (
            "cli-2",
            "COMPANY",
            "IFU 3201409823410",
            "Zone Industrielle Akpakpa, Cotonou",
            None,
            "Lun–Ven · 09h00 – 16h00",
            "Privilégier les confirmations écrites avant appel téléphonique.",
        ),
        (
            "cli-3",
            "COMPANY",
            "IFU 3201905541208",
            "Quartier Haie Vive, Rue 318, Cotonou",
            "Secrétariat comptable · compta@lespalmiers.bj",
            "Mar–Ven · 10h00 – 15h00",
            "Relances suspendues tant que le litige sur la livraison reste ouvert.",
        ),
        (
            "cli-4",
            "COMPANY",
            "IFU 3201103349012",
            "Avenue de la Marina, Face Port Autonome, Cotonou",
            None,
            "Lun–Ven · 08h00 – 17h00",
            None,
        ),
        (
            "cli-5",
            "INDIVIDUAL",
            "IFU 1201708843201",
            "Carrefour Dantokpa, Porto-Novo / Cotonou",
            None,
            "Lun–Sam · 09h00 – 18h00",
            None,
        ),
        (
            "cli-6",
            "COMPANY",
            "IFU 3202011294503",
            "Akpakpa Dodomè, Parcelle 88, Cotonou",
            None,
            "Lun–Ven · 08h30 – 17h00",
            None,
        ),
    ]

    for cid, ctype, tax_id, addr, sec, hours, restr in enrichments:
        existing = bind.execute(
            sa.text("SELECT id, tax_id FROM clients WHERE id = :cid"),
            {"cid": cid},
        ).fetchone()
        if existing and not existing[1]:
            bind.execute(
                sa.text(
                    """
                    UPDATE clients
                    SET client_type = :ctype,
                        tax_id = :tax_id,
                        address = :addr,
                        secondary_contact = :sec,
                        updated_at = :now
                    WHERE id = :cid
                    """
                ),
                {
                    "cid": cid,
                    "ctype": ctype,
                    "tax_id": tax_id,
                    "addr": addr,
                    "sec": sec,
                    "now": now_iso,
                },
            )
            bind.execute(
                sa.text(
                    """
                    UPDATE communication_preferences
                    SET contact_hours = COALESCE(contact_hours, :hours),
                        restrictions_note = COALESCE(restrictions_note, :restr),
                        updated_at = :now
                    WHERE client_id = :cid
                    """
                ),
                {"cid": cid, "hours": hours, "restr": restr, "now": now_iso},
            )


def downgrade() -> None:
    pass
