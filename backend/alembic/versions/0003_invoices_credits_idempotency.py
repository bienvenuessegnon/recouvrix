"""Extension du modèle factures : avoirs, litiges détaillés, promesses, unicité des affectations et idempotence.

Revision ID: 0003_invoices_credits_idemp
Revises: 0002_enrich_demo_clients
Create Date: 2026-11-25 18:30:00
"""
from __future__ import annotations

from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa

revision = "0003_invoices_credits_idemp"
down_revision = "0002_enrich_demo_clients"
branch_labels = None
depends_on = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _table_exists(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table_name)}


def _index_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {idx["name"] for idx in inspector.get_indexes(table_name) if idx.get("name")}


def _add_column_if_missing(inspector: sa.Inspector, table_name: str, column: sa.Column) -> None:
    if column.name not in _column_names(inspector, table_name):
        op.add_column(table_name, column)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    now_iso = _now_iso()

    # 1. Enrichissement de la table invoices
    _add_column_if_missing(
        inspector,
        "invoices",
        sa.Column("currency", sa.String(12), nullable=False, server_default="XOF"),
    )
    _add_column_if_missing(
        inspector,
        "invoices",
        sa.Column("description", sa.Text(), nullable=True),
    )
    _add_column_if_missing(
        inspector,
        "invoices",
        sa.Column("archived_at", sa.String(64), nullable=True),
    )
    _add_column_if_missing(
        inspector,
        "invoices",
        sa.Column("archived_by", sa.String(255), nullable=True),
    )

    # 2. Enrichissement de promises_to_pay
    inspector = sa.inspect(bind)
    _add_column_if_missing(
        inspector,
        "promises_to_pay",
        sa.Column("recorded_by", sa.String(255), nullable=True),
    )
    _add_column_if_missing(
        inspector,
        "promises_to_pay",
        sa.Column("evaluated_at", sa.String(64), nullable=True),
    )

    # 3. Enrichissement de disputes (catégorie + statut IN_REVIEW via batch_alter_table sur SQLite)
    inspector = sa.inspect(bind)
    _add_column_if_missing(
        inspector,
        "disputes",
        sa.Column("category", sa.String(40), nullable=False, server_default="OTHER"),
    )
    inspector = sa.inspect(bind)
    existing_checks = {
        c.get("name"): (c.get("sqltext") or "")
        for c in inspector.get_check_constraints("disputes")
        if c.get("name")
    }
    needs_status_check = "ck_disputes_status" not in existing_checks or "IN_REVIEW" not in existing_checks.get("ck_disputes_status", "")
    if needs_status_check:
        with op.batch_alter_table("disputes") as batch_op:
            if "ck_disputes_status" in existing_checks:
                batch_op.drop_constraint("ck_disputes_status", type_="check")
            batch_op.create_check_constraint(
                "ck_disputes_status",
                "status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CANCELLED')",
            )

    # 4. Unicité (payment_id, invoice_id) sur payment_allocations pour empêcher toute double affectation
    inspector = sa.inspect(bind)
    if "uq_alloc_payment_invoice_idx" not in _index_names(inspector, "payment_allocations"):
        op.create_index(
            "uq_alloc_payment_invoice_idx",
            "payment_allocations",
            ["payment_id", "invoice_id"],
            unique=True,
        )

    # 5. Table credit_notes (Avoirs)
    inspector = sa.inspect(bind)
    if not _table_exists(inspector, "credit_notes"):
        op.create_table(
            "credit_notes",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column(
                "organization_id",
                sa.String(64),
                sa.ForeignKey("organizations.id", ondelete="RESTRICT"),
                nullable=False,
                server_default="org-default",
            ),
            sa.Column(
                "invoice_id",
                sa.String(64),
                sa.ForeignKey("invoices.id", ondelete="RESTRICT"),
                nullable=False,
            ),
            sa.Column(
                "client_id",
                sa.String(64),
                sa.ForeignKey("clients.id", ondelete="RESTRICT"),
                nullable=False,
            ),
            sa.Column("reference", sa.String(80), nullable=False, unique=True),
            sa.Column("amount", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(24), nullable=False, server_default="DRAFT"),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("validated_at", sa.String(64), nullable=True),
            sa.Column("validated_by", sa.String(255), nullable=True),
            sa.Column("created_by", sa.String(255), nullable=True),
            sa.Column("created_at", sa.String(64), nullable=False),
            sa.Column("updated_at", sa.String(64), nullable=False),
            sa.CheckConstraint(
                "status IN ('DRAFT', 'VALIDATED', 'CANCELLED')",
                name="ck_credit_notes_status",
            ),
            sa.CheckConstraint("amount > 0", name="ck_credit_notes_positive_amount"),
        )
    inspector = sa.inspect(bind)
    for idx_name, cols in [
        ("idx_credit_notes_org_id", ["organization_id"]),
        ("idx_credit_notes_invoice_id", ["invoice_id"]),
        ("idx_credit_notes_client_id", ["client_id"]),
    ]:
        if idx_name not in _index_names(inspector, "credit_notes"):
            op.create_index(idx_name, "credit_notes", cols)

    # 6. Table idempotency_records
    inspector = sa.inspect(bind)
    if not _table_exists(inspector, "idempotency_records"):
        op.create_table(
            "idempotency_records",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column(
                "organization_id",
                sa.String(64),
                sa.ForeignKey("organizations.id", ondelete="RESTRICT"),
                nullable=False,
            ),
            sa.Column("actor_user_id", sa.String(64), nullable=False),
            sa.Column("action_name", sa.String(80), nullable=False),
            sa.Column("idempotency_key", sa.String(128), nullable=False),
            sa.Column("target_id", sa.String(64), nullable=True),
            sa.Column("response_status", sa.Integer(), nullable=False, server_default="200"),
            sa.Column("response_body", sa.Text(), nullable=False),
            sa.Column("created_at", sa.String(64), nullable=False),
        )
    inspector = sa.inspect(bind)
    if "uq_idempotency_scope_key_idx" not in _index_names(inspector, "idempotency_records"):
        op.create_index(
            "uq_idempotency_scope_key_idx",
            "idempotency_records",
            ["organization_id", "actor_user_id", "action_name", "idempotency_key"],
            unique=True,
        )
    if "idx_idempotency_org_id" not in _index_names(inspector, "idempotency_records"):
        op.create_index("idx_idempotency_org_id", "idempotency_records", ["organization_id"])

    # 7. Enrichissement non destructif des descriptions des factures de démonstration existantes
    descriptions = {
        "inv-1": "Fourniture de lots de quincaillerie industrielle — Bon de livraison BL-418",
        "inv-2": "Livraison ciment et fer à béton — Chantier Akpakpa",
        "inv-3": "Prestations de dédouanement et manutention conteneur #TCNU-409",
        "inv-4": "Équipements médicaux consommables — Commande CMP-0421",
        "inv-5": "Impression catalogues commerciaux et brochures institutionnelles",
        "inv-6": "Approvisionnement marchandises générales — Lot novembre",
        "inv-7": "Approvisionnement marchandises générales — Lot octobre",
        "inv-8": "Maintenance préventive équipements de levage — Trimestre 3",
    }
    for iid, desc in descriptions.items():
        bind.execute(
            sa.text(
                """
                UPDATE invoices
                SET description = COALESCE(description, :desc),
                    updated_at = COALESCE(updated_at, :now)
                WHERE id = :iid
                """
            ),
            {"iid": iid, "desc": desc, "now": now_iso},
        )


def downgrade() -> None:
    pass
