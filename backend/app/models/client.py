from __future__ import annotations

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.core.database import Base


class Client(Base):
    __tablename__ = "clients"
    __table_args__ = (
        CheckConstraint("client_type IN ('COMPANY', 'INDIVIDUAL')", name="ck_clients_type"),
        CheckConstraint(
            "preferred_channel IN ('EMAIL', 'WHATSAPP', 'PHONE')",
            name="ck_clients_preferred_channel",
        ),
        Index("idx_clients_org_id", "organization_id"),
        Index("idx_clients_org_name", "organization_id", "name"),
        Index("idx_clients_org_archived", "organization_id", "is_archived"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
        default="org-default",
    )
    name: Mapped[str] = mapped_column(String(220), nullable=False)
    client_type: Mapped[str] = mapped_column(String(24), nullable=False, default="COMPANY")
    tax_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(180), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    secondary_contact: Mapped[str | None] = mapped_column(String(255), nullable=True)
    preferred_channel: Mapped[str] = mapped_column(String(24), nullable=False, default="EMAIL")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_archived: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    archived_at: Mapped[str | None] = mapped_column(String(64), nullable=True)
    archived_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(64), nullable=False)


class CommunicationPreference(Base):
    __tablename__ = "communication_preferences"
    __table_args__ = (
        CheckConstraint(
            "preferred_channel IN ('EMAIL', 'WHATSAPP', 'PHONE')",
            name="ck_comm_prefs_channel",
        ),
        Index("idx_comm_prefs_org_id", "organization_id"),
        Index("idx_comm_prefs_client_id", "client_id", unique=True),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
        default="org-default",
    )
    client_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    preferred_channel: Mapped[str] = mapped_column(String(24), nullable=False, default="EMAIL")
    contact_allowed: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    contact_hours: Mapped[str | None] = mapped_column(String(160), nullable=True)
    restrictions_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(64), nullable=False)
