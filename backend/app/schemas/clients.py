from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from backend.app.core.security import is_valid_email, normalize_email

ClientTypeLiteral = Literal["COMPANY", "INDIVIDUAL"]
PreferredChannelLiteral = Literal["EMAIL", "WHATSAPP", "PHONE"]
ClientGlobalStatusLiteral = Literal[
    "DISPUTE",
    "OVERDUE",
    "PROMISE",
    "UP_TO_DATE",
    "SETTLED",
    "ARCHIVED",
]


class CommunicationPreferencesPayload(BaseModel):
    preferredChannel: PreferredChannelLiteral = "EMAIL"
    contactAllowed: bool = True
    contactHours: str | None = Field(default=None, max_length=160)
    restrictionsNote: str | None = Field(default=None, max_length=1000)

    @field_validator("contactHours", "restrictionsNote", mode="before")
    @classmethod
    def clean_optional_text(cls, value: object) -> str | None:
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None


class ClientCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=220)
    clientType: ClientTypeLiteral = "COMPANY"
    taxId: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=500)
    contactName: str | None = Field(default=None, max_length=180)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    secondaryContact: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=2000)
    communicationPreferences: CommunicationPreferencesPayload = Field(
        default_factory=CommunicationPreferencesPayload
    )

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: object) -> str:
        cleaned = str(value or "").strip()
        if len(cleaned) < 2:
            raise ValueError("Le nom ou la raison sociale doit contenir au moins 2 caractères.")
        return cleaned

    @field_validator("taxId", "address", "contactName", "phone", "secondaryContact", "notes", mode="before")
    @classmethod
    def clean_optional(cls, value: object) -> str | None:
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, value: object) -> str | None:
        if value is None:
            return None
        cleaned = normalize_email(str(value))
        if not cleaned:
            return None
        if not is_valid_email(cleaned):
            raise ValueError("Veuillez saisir une adresse e-mail valide.")
        return cleaned


class ClientUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=220)
    clientType: ClientTypeLiteral | None = None
    taxId: str | None = Field(default=None, max_length=80)
    address: str | None = Field(default=None, max_length=500)
    contactName: str | None = Field(default=None, max_length=180)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)
    secondaryContact: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, max_length=2000)
    communicationPreferences: CommunicationPreferencesPayload | None = None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name(cls, value: object) -> str | None:
        if value is None:
            return None
        cleaned = str(value).strip()
        if len(cleaned) < 2:
            raise ValueError("Le nom ou la raison sociale doit contenir au moins 2 caractères.")
        return cleaned

    @field_validator("taxId", "address", "contactName", "phone", "secondaryContact", "notes", mode="before")
    @classmethod
    def clean_optional(cls, value: object) -> str | None:
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, value: object) -> str | None:
        if value is None:
            return None
        cleaned = normalize_email(str(value))
        if not cleaned:
            return None
        if not is_valid_email(cleaned):
            raise ValueError("Veuillez saisir une adresse e-mail valide.")
        return cleaned


class ClientFinancialSummaryOut(BaseModel):
    totalBilled: int
    totalPaidConfirmed: int
    remainingAmount: int
    overdueAmount: int
    pendingVerificationAmount: int
    invoicesCount: int
    openInvoicesCount: int
    overdueInvoicesCount: int
    pendingPaymentsCount: int
    activePromisesCount: int
    openDisputesCount: int
    globalStatus: ClientGlobalStatusLiteral


class ClientListItemOut(BaseModel):
    id: str
    name: str
    clientType: ClientTypeLiteral
    taxId: str | None = None
    email: str | None = None
    phone: str | None = None
    contactName: str | None = None
    preferredChannel: PreferredChannelLiteral
    contactAllowed: bool
    isArchived: bool
    archivedAt: str | None = None
    invoicesCount: int
    overdueInvoicesCount: int
    remainingAmount: int
    overdueAmount: int
    pendingVerificationAmount: int
    globalStatus: ClientGlobalStatusLiteral
    createdAt: str
    updatedAt: str


class ClientListResponseOut(BaseModel):
    items: list[ClientListItemOut]
    total: int
    page: int
    pageSize: int
    totalPages: int
    summary: dict[str, int]


class ClientInvoiceSummaryOut(BaseModel):
    id: str
    reference: str
    issueDate: str
    dueDate: str
    totalAmount: int
    confirmedPaidAmount: int
    pendingVerificationAmount: int
    remainingAmount: int
    delayDays: int
    status: str


class ClientPromiseSummaryOut(BaseModel):
    id: str
    invoiceId: str
    invoiceReference: str
    promisedAmount: int
    promisedDate: str
    status: str
    note: str | None = None
    createdAt: str


class ClientDisputeSummaryOut(BaseModel):
    id: str
    invoiceId: str
    invoiceReference: str
    reason: str
    status: str
    openedBy: str | None = None
    openedAt: str
    resolvedAt: str | None = None


class ClientReminderSummaryOut(BaseModel):
    id: str
    invoiceId: str
    invoiceReference: str
    channel: str
    status: str
    scheduledFor: str
    subject: str | None = None
    createdAt: str


class ClientDocumentSummaryOut(BaseModel):
    id: str
    docType: str
    title: str
    fileName: str
    mimeType: str
    fileSize: int
    createdAt: str


class ClientHistoryEntryOut(BaseModel):
    id: str
    eventType: str
    category: str
    actorLabel: str
    summary: str
    createdAt: str


class ClientDetailOut(BaseModel):
    id: str
    name: str
    clientType: ClientTypeLiteral
    taxId: str | None = None
    address: str | None = None
    contactName: str | None = None
    email: str | None = None
    phone: str | None = None
    secondaryContact: str | None = None
    notes: str | None = None
    isArchived: bool
    archivedAt: str | None = None
    archivedBy: str | None = None
    createdAt: str
    updatedAt: str
    communicationPreferences: CommunicationPreferencesPayload
    financial: ClientFinancialSummaryOut
    invoices: list[ClientInvoiceSummaryOut]
    promises: list[ClientPromiseSummaryOut]
    disputes: list[ClientDisputeSummaryOut]
    reminders: list[ClientReminderSummaryOut]
    history: list[ClientHistoryEntryOut]
    documents: list[ClientDocumentSummaryOut]
