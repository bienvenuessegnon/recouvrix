from __future__ import annotations

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.core.database import Base


class ImportBatch(Base):
    __tablename__ = "imports"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'PREVIEW', 'VALIDATED', 'FAILED', 'CANCELLED')",
            name="ck_imports_status",
        ),
        Index("idx_imports_org_id", "organization_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
        default="org-default",
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False, default="CSV")
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="VALIDATED")
    total_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    imported_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duplicate_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_rows: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(64), nullable=False)


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (
        Index("idx_documents_org_id", "organization_id"),
        Index("idx_documents_client_id", "client_id"),
        Index("idx_documents_invoice_id", "invoice_id"),
        Index("idx_documents_payment_id", "payment_id"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
        default="org-default",
    )
    client_id: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
    )
    invoice_id: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey("invoices.id", ondelete="SET NULL"),
        nullable=True,
    )
    payment_id: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey("payments.id", ondelete="SET NULL"),
        nullable=True,
    )
    import_id: Mapped[str | None] = mapped_column(
        String(64),
        ForeignKey("imports.id", ondelete="SET NULL"),
        nullable=True,
    )
    doc_type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(220), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False, default="application/pdf")
    file_size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    uploaded_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(64), nullable=False)
