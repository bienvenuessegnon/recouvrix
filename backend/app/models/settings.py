from __future__ import annotations

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.core.database import Base


class PaymentSetting(Base):
    __tablename__ = "payment_settings"
    __table_args__ = (Index("idx_payment_settings_org_id", "organization_id", unique=True),)

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
        default="org-default",
    )
    bank_name: Mapped[str | None] = mapped_column(String(180), nullable=True)
    iban_or_rib: Mapped[str | None] = mapped_column(String(120), nullable=True)
    mobile_money_merchant: Mapped[str | None] = mapped_column(String(180), nullable=True)
    payment_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    auto_verify_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[str] = mapped_column(String(64), nullable=False)


class AppMeta(Base):
    __tablename__ = "app_meta"

    meta_key: Mapped[str] = mapped_column(String(120), primary_key=True)
    meta_value: Mapped[str] = mapped_column(Text, nullable=False)
