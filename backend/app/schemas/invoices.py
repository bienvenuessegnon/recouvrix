from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

InvoiceStatusLiteral = Literal[
    "UPCOMING",
    "OVERDUE",
    "PARTIAL",
    "DISPUTE",
    "PROMISE",
    "PAID",
]

DisputeCategoryLiteral = Literal[
    "QUANTITY_DISCREPANCY",
    "PRICING_ERROR",
    "QUALITY_ISSUE",
    "ALREADY_PAID",
    "MISSING_DOCUMENT",
    "OTHER",
]

DisputeStatusLiteral = Literal["OPEN", "IN_REVIEW", "RESOLVED", "CANCELLED"]
PromiseStatusLiteral = Literal["ACTIVE", "KEPT", "BROKEN", "CANCELLED"]
CreditNoteStatusLiteral = Literal["DRAFT", "VALIDATED", "CANCELLED"]
DocumentTypeLiteral = Literal[
    "ORIGINAL_INVOICE",
    "FACTURE_PDF",
    "CREDIT_NOTE",
    "JUSTIFICATIF_PAIEMENT",
    "DISPUTE_EVIDENCE",
    "SUPPORTING_DOC",
]


class InvoiceMetadataUpdateRequest(BaseModel):
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("description", mode="before")
    @classmethod
    def clean_description(cls, value: object) -> str | None:
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None


class DisputeCreateRequest(BaseModel):
    category: DisputeCategoryLiteral = "OTHER"
    reason: str = Field(..., min_length=4, max_length=2000)

    @field_validator("reason", mode="before")
    @classmethod
    def validate_reason(cls, value: object) -> str:
        cleaned = str(value or "").strip()
        if len(cleaned) < 4:
            raise ValueError("Veuillez préciser le motif détaillé du litige (4 caractères minimum).")
        return cleaned


class DisputeUpdateRequest(BaseModel):
    status: DisputeStatusLiteral
    category: DisputeCategoryLiteral | None = None
    reason: str | None = Field(default=None, max_length=2000)
    resolutionNote: str | None = Field(default=None, max_length=2000)

    @field_validator("reason", "resolutionNote", mode="before")
    @classmethod
    def clean_text(cls, value: object) -> str | None:
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None


class PromiseCreateRequest(BaseModel):
    promisedAmount: int = Field(..., gt=0)
    promisedDate: str = Field(..., min_length=10, max_length=32)
    note: str | None = Field(default=None, max_length=1500)

    @field_validator("promisedDate", mode="before")
    @classmethod
    def validate_date(cls, value: object) -> str:
        raw = str(value or "").strip()[:10]
        if len(raw) != 10 or raw[4] != "-" or raw[7] != "-":
            raise ValueError("Veuillez saisir une date de paiement prévue valide.")
        return raw

    @field_validator("note", mode="before")
    @classmethod
    def clean_note(cls, value: object) -> str | None:
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None


class PromiseUpdateRequest(BaseModel):
    status: PromiseStatusLiteral
    note: str | None = Field(default=None, max_length=1500)

    @field_validator("note", mode="before")
    @classmethod
    def clean_note(cls, value: object) -> str | None:
        if value is None:
            return None
        cleaned = str(value).strip()
        return cleaned or None


class CreditNoteCreateRequest(BaseModel):
    reference: str = Field(..., min_length=2, max_length=80)
    amount: int = Field(..., gt=0)
    reason: str = Field(..., min_length=4, max_length=1500)
    validateNow: bool = True

    @field_validator("reference", mode="before")
    @classmethod
    def validate_reference(cls, value: object) -> str:
        cleaned = str(value or "").strip()
        if len(cleaned) < 2:
            raise ValueError("Veuillez saisir une référence d’avoir valide.")
        return cleaned

    @field_validator("reason", mode="before")
    @classmethod
    def validate_reason(cls, value: object) -> str:
        cleaned = str(value or "").strip()
        if len(cleaned) < 4:
            raise ValueError("Veuillez préciser le motif de l’avoir (4 caractères minimum).")
        return cleaned


class AllocationItemRequest(BaseModel):
    invoiceId: str = Field(..., min_length=1, max_length=64)
    amount: int = Field(..., gt=0)


class PaymentAllocateRequest(BaseModel):
    allocations: list[AllocationItemRequest] = Field(..., min_length=1)


class InvoiceListItemOut(BaseModel):
    id: str
    reference: str
    clientId: str
    clientName: str
    issueDate: str
    dueDate: str
    currency: str
    description: str | None = None
    totalAmount: int
    confirmedPaidAmount: int
    validatedCreditNotesAmount: int
    pendingVerificationAmount: int
    remainingAmount: int
    delayDays: int
    isOverdue: bool
    isPartiallyPaid: bool
    hasDispute: bool
    activePromiseDate: str | None = None
    isPromiseOverdue: bool
    isArchived: bool
    status: InvoiceStatusLiteral


class InvoiceListSummaryOut(BaseModel):
    totalCount: int
    openCount: int
    overdueCount: int
    upcomingCount: int
    partialCount: int
    disputeCount: int
    promiseCount: int
    paidCount: int
    archivedCount: int
    totalOpenAmount: int
    totalOverdueAmount: int
    pendingVerificationAmount: int


class InvoiceListResponseOut(BaseModel):
    items: list[InvoiceListItemOut]
    total: int
    page: int
    pageSize: int
    totalPages: int
    referenceDate: str
    summary: InvoiceListSummaryOut


class InvoiceAllocationOut(BaseModel):
    id: str
    paymentId: str
    paymentReference: str
    paymentMethod: str | None = None
    paymentStatus: str
    allocatedAmount: int
    declaredAt: str
    confirmedAt: str | None = None
    createdAt: str


class InvoiceDeclaredPaymentOut(BaseModel):
    id: str
    reference: str
    amount: int
    status: str
    paymentMethod: str | None = None
    declaredAt: str
    createdBy: str | None = None


class InvoiceCreditNoteOut(BaseModel):
    id: str
    reference: str
    amount: int
    status: CreditNoteStatusLiteral
    reason: str
    validatedAt: str | None = None
    validatedBy: str | None = None
    createdBy: str | None = None
    createdAt: str


class InvoicePromiseOut(BaseModel):
    id: str
    promisedAmount: int
    promisedDate: str
    status: PromiseStatusLiteral
    isOverdue: bool
    note: str | None = None
    recordedBy: str | None = None
    evaluatedAt: str | None = None
    createdAt: str


class InvoiceDisputeOut(BaseModel):
    id: str
    category: str
    reason: str
    status: DisputeStatusLiteral
    openedBy: str | None = None
    openedAt: str
    resolvedAt: str | None = None
    resolutionNote: str | None = None


class InvoiceReminderOut(BaseModel):
    id: str
    channel: str
    status: str
    scheduledFor: str
    subject: str | None = None
    createdAt: str


class InvoiceDocumentOut(BaseModel):
    id: str
    docType: str
    title: str
    fileName: str
    mimeType: str
    fileSize: int
    uploadedBy: str | None = None
    createdAt: str


class InvoiceHistoryEntryOut(BaseModel):
    id: str
    eventType: str
    category: str
    actorLabel: str
    summary: str
    createdAt: str


class InvoiceDetailOut(BaseModel):
    id: str
    reference: str
    clientId: str
    clientName: str
    clientEmail: str | None = None
    clientPhone: str | None = None
    issueDate: str
    dueDate: str
    currency: str
    description: str | None = None
    isArchived: bool
    archivedAt: str | None = None
    archivedBy: str | None = None
    createdAt: str
    updatedAt: str
    referenceDate: str
    totalAmount: int
    confirmedPaidAmount: int
    validatedCreditNotesAmount: int
    pendingVerificationAmount: int
    remainingAmount: int
    delayDays: int
    isOverdue: bool
    isPartiallyPaid: bool
    hasDispute: bool
    remindersSuspended: bool
    suspensionReason: str | None = None
    status: InvoiceStatusLiteral
    statusExplanation: str
    allocations: list[InvoiceAllocationOut]
    declaredPayments: list[InvoiceDeclaredPaymentOut]
    creditNotes: list[InvoiceCreditNoteOut]
    promises: list[InvoicePromiseOut]
    disputes: list[InvoiceDisputeOut]
    reminders: list[InvoiceReminderOut]
    documents: list[InvoiceDocumentOut]
    history: list[InvoiceHistoryEntryOut]
