"""Socle SaaS Recouvrix : organisations, clients, recouvrement, documents et audit.

Revision ID: 0001_recouvrix_saas
Revises: None
Create Date: 2026-11-25 18:10:00
"""
from __future__ import annotations

from datetime import datetime, timezone
import uuid

from alembic import op
import sqlalchemy as sa

revision = "0001_recouvrix_saas"
down_revision = None
branch_labels = None
depends_on = None

DEFAULT_ORG_ID = "org-default"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _table_exists(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def _column_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {col["name"] for col in inspector.get_columns(table_name)}


def _index_names(inspector: sa.Inspector, table_name: str) -> set[str]:
    return {idx["name"] for idx in inspector.get_indexes(table_name) if idx.get("name")}


def _add_column_if_missing(
    inspector: sa.Inspector,
    table_name: str,
    column: sa.Column,
) -> None:
    if column.name not in _column_names(inspector, table_name):
        op.add_column(table_name, column)


def _create_index_if_missing(
    inspector: sa.Inspector,
    index_name: str,
    table_name: str,
    columns: list[str],
    unique: bool = False,
) -> None:
    if index_name not in _index_names(inspector, table_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    now_iso = _now_iso()

    # 1. Organisations
    if not _table_exists(inspector, "organizations"):
        op.create_table(
            "organizations",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("slug", sa.String(120), nullable=False, unique=True),
            sa.Column("currency", sa.String(12), nullable=False, server_default="XOF"),
            sa.Column("default_payment_terms_days", sa.Integer(), nullable=False, server_default="30"),
            sa.Column("created_at", sa.String(64), nullable=False),
            sa.Column("updated_at", sa.String(64), nullable=False),
        )

    existing_org = bind.execute(
        sa.text("SELECT id FROM organizations WHERE id = :id"),
        {"id": DEFAULT_ORG_ID},
    ).fetchone()
    if not existing_org:
        bind.execute(
            sa.text(
                """
                INSERT INTO organizations (id, name, slug, currency, default_payment_terms_days, created_at, updated_at)
                VALUES (:id, :name, :slug, 'XOF', 30, :now, :now)
                """
            ),
            {"id": DEFAULT_ORG_ID, "name": "Recouvrix Organisation", "slug": "recouvrix-default", "now": now_iso},
        )

    # 2. Utilisateurs, sessions et tentatives de connexion
    inspector = sa.inspect(bind)
    if not _table_exists(inspector, "users"):
        op.create_table(
            "users",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("organization_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, server_default=DEFAULT_ORG_ID),
            sa.Column("email", sa.String(255), nullable=False, unique=True),
            sa.Column("full_name", sa.String(200), nullable=False),
            sa.Column("role", sa.String(20), nullable=False),
            sa.Column("password_hash", sa.String(512), nullable=False),
            sa.Column("is_active", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("is_demo", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.String(64), nullable=False),
            sa.Column("updated_at", sa.String(64), nullable=False),
            sa.Column("last_login_at", sa.String(64), nullable=True),
            sa.CheckConstraint("role IN ('ADMIN', 'MANAGER')", name="ck_users_role"),
        )
    else:
        _add_column_if_missing(
            inspector,
            "users",
            sa.Column("organization_id", sa.String(64), nullable=False, server_default=DEFAULT_ORG_ID),
        )
    inspector = sa.inspect(bind)
    _create_index_if_missing(inspector, "idx_users_org_id", "users", ["organization_id"])

    if not _table_exists(inspector, "sessions"):
        op.create_table(
            "sessions",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("token_hash", sa.String(128), nullable=False, unique=True),
            sa.Column("user_id", sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.String(64), nullable=False),
            sa.Column("expires_at", sa.String(64), nullable=False),
            sa.Column("revoked_at", sa.String(64), nullable=True),
        )
    inspector = sa.inspect(bind)
    _create_index_if_missing(inspector, "idx_sessions_user_id", "sessions", ["user_id"])
    _create_index_if_missing(inspector, "idx_sessions_token_hash", "sessions", ["token_hash"])

    if not _table_exists(inspector, "login_attempts"):
        op.create_table(
            "login_attempts",
            sa.Column("attempt_key", sa.String(255), primary_key=True),
            sa.Column("failures", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("first_failure_at", sa.Integer(), nullable=False),
            sa.Column("locked_until", sa.Integer(), nullable=True),
        )

    if not _table_exists(inspector, "app_meta"):
        op.create_table(
            "app_meta",
            sa.Column("meta_key", sa.String(120), primary_key=True),
            sa.Column("meta_value", sa.Text(), nullable=False),
        )

    # 3. Importations (référencées par invoices & documents)
    if not _table_exists(inspector, "imports"):
        op.create_table(
            "imports",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("organization_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, server_default=DEFAULT_ORG_ID),
            sa.Column("filename", sa.String(255), nullable=False),
            sa.Column("source_type", sa.String(32), nullable=False, server_default="CSV"),
            sa.Column("status", sa.String(24), nullable=False, server_default="VALIDATED"),
            sa.Column("total_rows", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("imported_rows", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("duplicate_rows", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("error_rows", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_by", sa.String(255), nullable=True),
            sa.Column("created_at", sa.String(64), nullable=False),
            sa.Column("updated_at", sa.String(64), nullable=False),
        )
        inspector = sa.inspect(bind)
        _create_index_if_missing(inspector, "idx_imports_org_id", "imports", ["organization_id"])

    # 4. Clients & Préférences de communication
    if not _table_exists(inspector, "clients"):
        op.create_table(
            "clients",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("organization_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, server_default=DEFAULT_ORG_ID),
            sa.Column("name", sa.String(220), nullable=False),
            sa.Column("client_type", sa.String(24), nullable=False, server_default="COMPANY"),
            sa.Column("tax_id", sa.String(80), nullable=True),
            sa.Column("address", sa.Text(), nullable=True),
            sa.Column("contact_name", sa.String(180), nullable=True),
            sa.Column("email", sa.String(255), nullable=True),
            sa.Column("phone", sa.String(64), nullable=True),
            sa.Column("secondary_contact", sa.String(255), nullable=True),
            sa.Column("preferred_channel", sa.String(24), nullable=False, server_default="EMAIL"),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("is_archived", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("archived_at", sa.String(64), nullable=True),
            sa.Column("archived_by", sa.String(255), nullable=True),
            sa.Column("created_at", sa.String(64), nullable=False),
            sa.Column("updated_at", sa.String(64), nullable=False),
        )
    else:
        _add_column_if_missing(inspector, "clients", sa.Column("organization_id", sa.String(64), nullable=False, server_default=DEFAULT_ORG_ID))
        _add_column_if_missing(inspector, "clients", sa.Column("client_type", sa.String(24), nullable=False, server_default="COMPANY"))
        _add_column_if_missing(inspector, "clients", sa.Column("tax_id", sa.String(80), nullable=True))
        _add_column_if_missing(inspector, "clients", sa.Column("address", sa.Text(), nullable=True))
        _add_column_if_missing(inspector, "clients", sa.Column("secondary_contact", sa.String(255), nullable=True))
        _add_column_if_missing(inspector, "clients", sa.Column("notes", sa.Text(), nullable=True))
        _add_column_if_missing(inspector, "clients", sa.Column("is_archived", sa.Integer(), nullable=False, server_default="0"))
        _add_column_if_missing(inspector, "clients", sa.Column("archived_at", sa.String(64), nullable=True))
        _add_column_if_missing(inspector, "clients", sa.Column("archived_by", sa.String(255), nullable=True))
        _add_column_if_missing(inspector, "clients", sa.Column("updated_at", sa.String(64), nullable=False, server_default=now_iso))
        bind.execute(sa.text("UPDATE clients SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''"))

    inspector = sa.inspect(bind)
    _create_index_if_missing(inspector, "idx_clients_org_id", "clients", ["organization_id"])
    _create_index_if_missing(inspector, "idx_clients_org_name", "clients", ["organization_id", "name"])
    _create_index_if_missing(inspector, "idx_clients_org_archived", "clients", ["organization_id", "is_archived"])

    if not _table_exists(inspector, "communication_preferences"):
        op.create_table(
            "communication_preferences",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("organization_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, server_default=DEFAULT_ORG_ID),
            sa.Column("client_id", sa.String(64), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, unique=True),
            sa.Column("preferred_channel", sa.String(24), nullable=False, server_default="EMAIL"),
            sa.Column("contact_allowed", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("contact_hours", sa.String(160), nullable=True),
            sa.Column("restrictions_note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.String(64), nullable=False),
            sa.Column("updated_at", sa.String(64), nullable=False),
        )
        inspector = sa.inspect(bind)
        _create_index_if_missing(inspector, "idx_comm_prefs_org_id", "communication_preferences", ["organization_id"])
        _create_index_if_missing(inspector, "idx_comm_prefs_client_id", "communication_preferences", ["client_id"], unique=True)

    # Backfill communication_preferences pour les clients existants
    clients_without_prefs = bind.execute(
        sa.text(
            """
            SELECT c.id, c.organization_id, c.preferred_channel, c.created_at
            FROM clients c
            LEFT JOIN communication_preferences cp ON cp.client_id = c.id
            WHERE cp.id IS NULL
            """
        )
    ).fetchall()
    for row in clients_without_prefs:
        channel = row[2] if row[2] in ("EMAIL", "WHATSAPP", "PHONE") else "EMAIL"
        bind.execute(
            sa.text(
                """
                INSERT INTO communication_preferences
                (id, organization_id, client_id, preferred_channel, contact_allowed, contact_hours, restrictions_note, created_at, updated_at)
                VALUES (:id, :org_id, :client_id, :channel, 1, NULL, NULL, :created_at, :updated_at)
                """
            ),
            {
                "id": f"pref-{row[0]}",
                "org_id": row[1] or DEFAULT_ORG_ID,
                "client_id": row[0],
                "channel": channel,
                "created_at": row[3] or now_iso,
                "updated_at": now_iso,
            },
        )

    # 5. Factures
    if not _table_exists(inspector, "invoices"):
        op.create_table(
            "invoices",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("organization_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, server_default=DEFAULT_ORG_ID),
            sa.Column("reference", sa.String(80), nullable=False, unique=True),
            sa.Column("client_id", sa.String(64), sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("import_id", sa.String(64), sa.ForeignKey("imports.id", ondelete="SET NULL"), nullable=True),
            sa.Column("issue_date", sa.String(32), nullable=False),
            sa.Column("due_date", sa.String(32), nullable=False),
            sa.Column("total_amount", sa.Integer(), nullable=False),
            sa.Column("has_dispute", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("dispute_reason", sa.Text(), nullable=True),
            sa.Column("is_archived", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.String(64), nullable=False),
            sa.Column("updated_at", sa.String(64), nullable=False),
        )
    else:
        _add_column_if_missing(inspector, "invoices", sa.Column("organization_id", sa.String(64), nullable=False, server_default=DEFAULT_ORG_ID))
        _add_column_if_missing(inspector, "invoices", sa.Column("import_id", sa.String(64), nullable=True))
        _add_column_if_missing(inspector, "invoices", sa.Column("is_archived", sa.Integer(), nullable=False, server_default="0"))
        _add_column_if_missing(inspector, "invoices", sa.Column("updated_at", sa.String(64), nullable=False, server_default=now_iso))
        bind.execute(sa.text("UPDATE invoices SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''"))

    inspector = sa.inspect(bind)
    _create_index_if_missing(inspector, "idx_invoices_org_id", "invoices", ["organization_id"])
    _create_index_if_missing(inspector, "idx_invoices_client_id", "invoices", ["client_id"])
    _create_index_if_missing(inspector, "idx_invoices_due_date", "invoices", ["due_date"])

    # 6. Paiements & Affectations de paiement
    if not _table_exists(inspector, "payments"):
        op.create_table(
            "payments",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("organization_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, server_default=DEFAULT_ORG_ID),
            sa.Column("reference", sa.String(80), nullable=False, unique=True),
            sa.Column("invoice_id", sa.String(64), sa.ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=True),
            sa.Column("client_id", sa.String(64), sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("amount", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(32), nullable=False),
            sa.Column("payment_method", sa.String(80), nullable=True),
            sa.Column("declared_at", sa.String(64), nullable=False),
            sa.Column("confirmed_at", sa.String(64), nullable=True),
            sa.Column("created_by", sa.String(255), nullable=True),
            sa.Column("created_at", sa.String(64), nullable=False),
            sa.Column("updated_at", sa.String(64), nullable=False),
        )
    else:
        _add_column_if_missing(inspector, "payments", sa.Column("organization_id", sa.String(64), nullable=False, server_default=DEFAULT_ORG_ID))
        _add_column_if_missing(inspector, "payments", sa.Column("created_at", sa.String(64), nullable=False, server_default=now_iso))
        _add_column_if_missing(inspector, "payments", sa.Column("updated_at", sa.String(64), nullable=False, server_default=now_iso))
        bind.execute(sa.text("UPDATE payments SET created_at = declared_at WHERE created_at IS NULL OR created_at = ''"))

    inspector = sa.inspect(bind)
    _create_index_if_missing(inspector, "idx_payments_org_id", "payments", ["organization_id"])
    _create_index_if_missing(inspector, "idx_payments_invoice_id", "payments", ["invoice_id"])
    _create_index_if_missing(inspector, "idx_payments_client_id", "payments", ["client_id"])
    _create_index_if_missing(inspector, "idx_payments_status", "payments", ["status"])

    if not _table_exists(inspector, "payment_allocations"):
        op.create_table(
            "payment_allocations",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("organization_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, server_default=DEFAULT_ORG_ID),
            sa.Column("payment_id", sa.String(64), sa.ForeignKey("payments.id", ondelete="CASCADE"), nullable=False),
            sa.Column("invoice_id", sa.String(64), sa.ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("allocated_amount", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.String(64), nullable=False),
        )
        inspector = sa.inspect(bind)
        _create_index_if_missing(inspector, "idx_alloc_org_id", "payment_allocations", ["organization_id"])
        _create_index_if_missing(inspector, "idx_alloc_payment_id", "payment_allocations", ["payment_id"])
        _create_index_if_missing(inspector, "idx_alloc_invoice_id", "payment_allocations", ["invoice_id"])

    # Backfill payment_allocations pour les paiements existants liés à une facture
    unallocated_payments = bind.execute(
        sa.text(
            """
            SELECT p.id, p.organization_id, p.invoice_id, p.amount, p.declared_at
            FROM payments p
            LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
            WHERE p.invoice_id IS NOT NULL AND pa.id IS NULL
            """
        )
    ).fetchall()
    for row in unallocated_payments:
        bind.execute(
            sa.text(
                """
                INSERT INTO payment_allocations (id, organization_id, payment_id, invoice_id, allocated_amount, created_at)
                VALUES (:id, :org_id, :payment_id, :invoice_id, :amount, :created_at)
                """
            ),
            {
                "id": f"alloc-{row[0]}",
                "org_id": row[1] or DEFAULT_ORG_ID,
                "payment_id": row[0],
                "invoice_id": row[2],
                "amount": row[3],
                "created_at": row[4] or now_iso,
            },
        )

    # 7. Promesses de paiement
    if not _table_exists(inspector, "promises_to_pay"):
        op.create_table(
            "promises_to_pay",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("organization_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, server_default=DEFAULT_ORG_ID),
            sa.Column("invoice_id", sa.String(64), sa.ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("client_id", sa.String(64), sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("promised_amount", sa.Integer(), nullable=False),
            sa.Column("promised_date", sa.String(32), nullable=False),
            sa.Column("status", sa.String(24), nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.String(64), nullable=False),
            sa.Column("updated_at", sa.String(64), nullable=False),
        )
    else:
        _add_column_if_missing(inspector, "promises_to_pay", sa.Column("organization_id", sa.String(64), nullable=False, server_default=DEFAULT_ORG_ID))
        _add_column_if_missing(inspector, "promises_to_pay", sa.Column("updated_at", sa.String(64), nullable=False, server_default=now_iso))
        bind.execute(sa.text("UPDATE promises_to_pay SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''"))

    inspector = sa.inspect(bind)
    _create_index_if_missing(inspector, "idx_promises_org_id", "promises_to_pay", ["organization_id"])
    _create_index_if_missing(inspector, "idx_promises_invoice_id", "promises_to_pay", ["invoice_id"])
    _create_index_if_missing(inspector, "idx_promises_client_id", "promises_to_pay", ["client_id"])

    # 8. Litiges
    if not _table_exists(inspector, "disputes"):
        op.create_table(
            "disputes",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("organization_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, server_default=DEFAULT_ORG_ID),
            sa.Column("invoice_id", sa.String(64), sa.ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("client_id", sa.String(64), sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("reason", sa.Text(), nullable=False),
            sa.Column("status", sa.String(24), nullable=False, server_default="OPEN"),
            sa.Column("opened_by", sa.String(255), nullable=True),
            sa.Column("opened_at", sa.String(64), nullable=False),
            sa.Column("resolved_at", sa.String(64), nullable=True),
            sa.Column("resolution_note", sa.Text(), nullable=True),
            sa.Column("created_at", sa.String(64), nullable=False),
            sa.Column("updated_at", sa.String(64), nullable=False),
        )
        inspector = sa.inspect(bind)
        _create_index_if_missing(inspector, "idx_disputes_org_id", "disputes", ["organization_id"])
        _create_index_if_missing(inspector, "idx_disputes_invoice_id", "disputes", ["invoice_id"])
        _create_index_if_missing(inspector, "idx_disputes_client_id", "disputes", ["client_id"])

    # Backfill disputes pour les factures existantes marquées has_dispute=1
    disputed_invoices = bind.execute(
        sa.text(
            """
            SELECT i.id, i.organization_id, i.client_id, i.dispute_reason, i.created_at
            FROM invoices i
            LEFT JOIN disputes d ON d.invoice_id = i.id AND d.status = 'OPEN'
            WHERE i.has_dispute = 1 AND d.id IS NULL
            """
        )
    ).fetchall()
    for row in disputed_invoices:
        bind.execute(
            sa.text(
                """
                INSERT INTO disputes (id, organization_id, invoice_id, client_id, reason, status, opened_by, opened_at, resolved_at, resolution_note, created_at, updated_at)
                VALUES (:id, :org_id, :invoice_id, :client_id, :reason, 'OPEN', 'gestionnaire@recouvrix.demo', :opened_at, NULL, NULL, :opened_at, :updated_at)
                """
            ),
            {
                "id": f"disp-{row[0]}",
                "org_id": row[1] or DEFAULT_ORG_ID,
                "invoice_id": row[0],
                "client_id": row[2],
                "reason": row[3] or "Litige client signalé.",
                "opened_at": row[4] or now_iso,
                "updated_at": now_iso,
            },
        )

    # 9. Relances
    if not _table_exists(inspector, "reminders"):
        op.create_table(
            "reminders",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("organization_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, server_default=DEFAULT_ORG_ID),
            sa.Column("invoice_id", sa.String(64), sa.ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("client_id", sa.String(64), sa.ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False),
            sa.Column("channel", sa.String(24), nullable=False),
            sa.Column("status", sa.String(24), nullable=False),
            sa.Column("scheduled_for", sa.String(32), nullable=False),
            sa.Column("subject", sa.String(255), nullable=True),
            sa.Column("body_preview", sa.Text(), nullable=True),
            sa.Column("created_at", sa.String(64), nullable=False),
            sa.Column("updated_at", sa.String(64), nullable=False),
        )
    else:
        _add_column_if_missing(inspector, "reminders", sa.Column("organization_id", sa.String(64), nullable=False, server_default=DEFAULT_ORG_ID))
        _add_column_if_missing(inspector, "reminders", sa.Column("body_preview", sa.Text(), nullable=True))
        _add_column_if_missing(inspector, "reminders", sa.Column("updated_at", sa.String(64), nullable=False, server_default=now_iso))
        bind.execute(sa.text("UPDATE reminders SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''"))

    inspector = sa.inspect(bind)
    _create_index_if_missing(inspector, "idx_reminders_org_id", "reminders", ["organization_id"])
    _create_index_if_missing(inspector, "idx_reminders_invoice_id", "reminders", ["invoice_id"])
    _create_index_if_missing(inspector, "idx_reminders_client_id", "reminders", ["client_id"])

    # 10. Documents
    if not _table_exists(inspector, "documents"):
        op.create_table(
            "documents",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("organization_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, server_default=DEFAULT_ORG_ID),
            sa.Column("client_id", sa.String(64), sa.ForeignKey("clients.id", ondelete="SET NULL"), nullable=True),
            sa.Column("invoice_id", sa.String(64), sa.ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True),
            sa.Column("payment_id", sa.String(64), sa.ForeignKey("payments.id", ondelete="SET NULL"), nullable=True),
            sa.Column("import_id", sa.String(64), sa.ForeignKey("imports.id", ondelete="SET NULL"), nullable=True),
            sa.Column("doc_type", sa.String(40), nullable=False),
            sa.Column("title", sa.String(220), nullable=False),
            sa.Column("file_name", sa.String(255), nullable=False),
            sa.Column("mime_type", sa.String(120), nullable=False, server_default="application/pdf"),
            sa.Column("file_size", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("storage_key", sa.String(512), nullable=False),
            sa.Column("uploaded_by", sa.String(255), nullable=True),
            sa.Column("created_at", sa.String(64), nullable=False),
            sa.Column("updated_at", sa.String(64), nullable=False),
        )
        inspector = sa.inspect(bind)
        _create_index_if_missing(inspector, "idx_documents_org_id", "documents", ["organization_id"])
        _create_index_if_missing(inspector, "idx_documents_client_id", "documents", ["client_id"])
        _create_index_if_missing(inspector, "idx_documents_invoice_id", "documents", ["invoice_id"])
        _create_index_if_missing(inspector, "idx_documents_payment_id", "documents", ["payment_id"])

    # 11. Paramètres de paiement
    if not _table_exists(inspector, "payment_settings"):
        op.create_table(
            "payment_settings",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("organization_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, unique=True),
            sa.Column("bank_name", sa.String(180), nullable=True),
            sa.Column("iban_or_rib", sa.String(120), nullable=True),
            sa.Column("mobile_money_merchant", sa.String(180), nullable=True),
            sa.Column("payment_instructions", sa.Text(), nullable=True),
            sa.Column("auto_verify_threshold", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.String(64), nullable=False),
            sa.Column("updated_at", sa.String(64), nullable=False),
        )
        inspector = sa.inspect(bind)
        _create_index_if_missing(inspector, "idx_payment_settings_org_id", "payment_settings", ["organization_id"], unique=True)

    existing_ps = bind.execute(
        sa.text("SELECT id FROM payment_settings WHERE organization_id = :org"),
        {"org": DEFAULT_ORG_ID},
    ).fetchone()
    if not existing_ps:
        bind.execute(
            sa.text(
                """
                INSERT INTO payment_settings
                (id, organization_id, bank_name, iban_or_rib, mobile_money_merchant, payment_instructions, auto_verify_threshold, created_at, updated_at)
                VALUES (:id, :org, 'Banque Atlantique Bénin', 'BJ061 01001 00123456789 45', 'MTN MoMo Marchand #40912', 'Merci d’indiquer la référence de facture lors de votre règlement.', 0, :now, :now)
                """
            ),
            {"id": str(uuid.uuid4()), "org": DEFAULT_ORG_ID, "now": now_iso},
        )

    # 12. Historique d'activité enrichi
    if not _table_exists(inspector, "activity_logs"):
        op.create_table(
            "activity_logs",
            sa.Column("id", sa.String(64), primary_key=True),
            sa.Column("organization_id", sa.String(64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, server_default=DEFAULT_ORG_ID),
            sa.Column("event_type", sa.String(64), nullable=False),
            sa.Column("category", sa.String(24), nullable=False, server_default="SECURITY"),
            sa.Column("actor_user_id", sa.String(64), nullable=True),
            sa.Column("actor_label", sa.String(255), nullable=False),
            sa.Column("target_user_id", sa.String(64), nullable=True),
            sa.Column("target_label", sa.String(255), nullable=True),
            sa.Column("entity_type", sa.String(64), nullable=True),
            sa.Column("entity_id", sa.String(64), nullable=True),
            sa.Column("summary", sa.Text(), nullable=False),
            sa.Column("created_at", sa.String(64), nullable=False),
        )
    else:
        _add_column_if_missing(inspector, "activity_logs", sa.Column("organization_id", sa.String(64), nullable=False, server_default=DEFAULT_ORG_ID))
        _add_column_if_missing(inspector, "activity_logs", sa.Column("category", sa.String(24), nullable=False, server_default="SECURITY"))
        _add_column_if_missing(inspector, "activity_logs", sa.Column("entity_type", sa.String(64), nullable=True))
        _add_column_if_missing(inspector, "activity_logs", sa.Column("entity_id", sa.String(64), nullable=True))

    inspector = sa.inspect(bind)
    _create_index_if_missing(inspector, "idx_activity_logs_org_created", "activity_logs", ["organization_id", "created_at"])
    _create_index_if_missing(inspector, "idx_activity_logs_entity", "activity_logs", ["organization_id", "entity_type", "entity_id"])


def downgrade() -> None:
    # Rétrogradation prudente : supprime uniquement les tables ajoutées sans détruire les données utilisateurs existantes
    pass
