from __future__ import annotations

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.core.database import Base


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        Index("idx_invoices_org_id", "organization_id"),
        Index("idx_invoices_client_id", "client_id"),
        Index("idx_invoices_due_date", "due_date"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
        default="org-default",
    )
    reference: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    client_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
    )
    import_id: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey("imports.id", ondelete="SET NULL"),
        nullable=True,
    )
    issue_date: Mapped[str] = mapped_column(String(32), nullable=False)
    due_date: Mapped[str] = mapped_column(String(32), nullable=False)
    total_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(12), nullable=False, default="XOF")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    has_dispute: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dispute_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_archived: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    archived_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    archived_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(64), nullable=False)


class CreditNote(Base):
    __tablename__ = "credit_notes"
    __table_args__ = (
        CheckConstraint(
            "status IN ('DRAFT', 'VALIDATED', 'CANCELLED')",
            name="ck_credit_notes_status",
        ),
        CheckConstraint("amount > 0", name="ck_credit_notes_positive_amount"),
        Index("idx_credit_notes_org_id", "organization_id"),
        Index("idx_credit_notes_invoice_id", "invoice_id"),
        Index("idx_credit_notes_client_id", "client_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
        default="org-default",
    )
    invoice_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("invoices.id", ondelete="RESTRICT"),
        nullable=False,
    )
    client_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
    )
    reference: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="DRAFT")
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    validated_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    validated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(64), nullable=False)


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint(
            "status IN ('DECLARED', 'RECEIPT_RECEIVED', 'PENDING_VERIFICATION', 'CONFIRMED', 'RECORDED', 'REJECTED')",
            name="ck_payments_status",
        ),
        Index("idx_payments_org_id", "organization_id"),
        Index("idx_payments_invoice_id", "invoice_id"),
        Index("idx_payments_client_id", "client_id"),
        Index("idx_payments_status", "status"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
        default="org-default",
    )
    reference: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    invoice_id: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey("invoices.id", ondelete="RESTRICT"),
        nullable=True,
    )
    client_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    payment_method: Mapped[str | None] = mapped_column(String(80), nullable=True)
    declared_at: Mapped[str] = mapped_column(String(64), nullable=False)
    confirmed_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(64), nullable=False)


class PaymentAllocation(Base):
    __tablename__ = "payment_allocations"
    __table_args__ = (
        UniqueConstraint("payment_id", "invoice_id", name="uq_alloc_payment_invoice"),
        Index("idx_alloc_org_id", "organization_id"),
        Index("idx_alloc_payment_id", "payment_id"),
        Index("idx_alloc_invoice_id", "invoice_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
        default="org-default",
    )
    payment_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("payments.id", ondelete="CASCADE"),
        nullable=False,
    )
    invoice_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("invoices.id", ondelete="RESTRICT"),
        nullable=False,
    )
    allocated_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)


class PromiseToPay(Base):
    __tablename__ = "promises_to_pay"
    __table_args__ = (
        CheckConstraint(
            "status IN ('ACTIVE', 'KEPT', 'BROKEN', 'CANCELLED')",
            name="ck_promises_status",
        ),
        Index("idx_promises_org_id", "organization_id"),
        Index("idx_promises_invoice_id", "invoice_id"),
        Index("idx_promises_client_id", "client_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
        default="org-default",
    )
    invoice_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("invoices.id", ondelete="RESTRICT"),
        nullable=False,
    )
    client_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
    )
    promised_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    promised_date: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    evaluated_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(64), nullable=False)


class Dispute(Base):
    __tablename__ = "disputes"
    __table_args__ = (
        CheckConstraint(
            "status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CANCELLED')",
            name="ck_disputes_status",
        ),
        Index("idx_disputes_org_id", "organization_id"),
        Index("idx_disputes_invoice_id", "invoice_id"),
        Index("idx_disputes_client_id", "client_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
        default="org-default",
    )
    invoice_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("invoices.id", ondelete="RESTRICT"),
        nullable=False,
    )
    client_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
    )
    category: Mapped[str] = mapped_column(String(40), nullable=False, default="OTHER")
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="OPEN")
    opened_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    opened_at: Mapped[str] = mapped_column(String(64), nullable=False)
    resolved_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(64), nullable=False)


class Reminder(Base):
    __tablename__ = "reminders"
    __table_args__ = (
        CheckConstraint("channel IN ('EMAIL', 'WHATSAPP', 'PHONE')", name="ck_reminders_channel"),
        CheckConstraint(
            "status IN ('PLANNED', 'PREPARED', 'VALIDATED', 'SENT', 'CANCELLED')",
            name="ck_reminders_status",
        ),
        Index("idx_reminders_org_id", "organization_id"),
        Index("idx_reminders_invoice_id", "invoice_id"),
        Index("idx_reminders_client_id", "client_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
        default="org-default",
    )
    invoice_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("invoices.id", ondelete="RESTRICT"),
        nullable=False,
    )
    client_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("clients.id", ondelete="RESTRICT"),
        nullable=False,
    )
    channel: Mapped[str] = mapped_column(String(24), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    scheduled_for: Mapped[str] = mapped_column(String(32), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    body_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(64), nullable=False)
