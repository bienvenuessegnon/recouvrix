export type InvoiceDerivedStatus =
  | 'UPCOMING'
  | 'OVERDUE'
  | 'PARTIAL'
  | 'DISPUTE'
  | 'PROMISE'
  | 'PAID';

export type DisputeCategory =
  | 'QUANTITY_DISCREPANCY'
  | 'PRICING_ERROR'
  | 'QUALITY_ISSUE'
  | 'ALREADY_PAID'
  | 'MISSING_DOCUMENT'
  | 'OTHER';

export type DisputeStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'CANCELLED';

export type PromiseStatus = 'ACTIVE' | 'KEPT' | 'BROKEN' | 'CANCELLED';

export type CreditNoteStatus = 'DRAFT' | 'VALIDATED' | 'CANCELLED';

export type InvoiceDocumentType =
  | 'ORIGINAL_INVOICE'
  | 'CREDIT_NOTE'
  | 'JUSTIFICATIF_PAIEMENT'
  | 'DISPUTE_EVIDENCE'
  | 'SUPPORTING_DOC';

export type InvoiceStatusFilterValue =
  | 'ALL'
  | 'OPEN'
  | 'NOT_DUE'
  | 'OVERDUE'
  | 'UPCOMING'
  | 'PARTIAL'
  | 'DISPUTE'
  | 'PROMISE'
  | 'PAID'
  | 'ARCHIVED';

export type InvoiceSortField =
  | 'due_date'
  | 'remaining_amount'
  | 'total_amount'
  | 'delay_days'
  | 'issue_date'
  | 'reference';

export interface InvoiceListParams {
  search?: string;
  status?: InvoiceStatusFilterValue;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  dateField?: 'due_date' | 'issue_date';
  sortBy?: InvoiceSortField;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface InvoiceListItem {
  id: string;
  reference: string;
  clientId: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  description?: string | null;
  totalAmount: number;
  confirmedPaidAmount: number;
  validatedCreditNotesAmount: number;
  pendingVerificationAmount: number;
  remainingAmount: number;
  delayDays: number;
  isOverdue: boolean;
  isPartiallyPaid: boolean;
  hasDispute: boolean;
  activePromiseDate?: string | null;
  isPromiseOverdue: boolean;
  isArchived: boolean;
  status: InvoiceDerivedStatus;
}

export interface InvoiceListSummary {
  totalCount: number;
  openCount: number;
  overdueCount: number;
  upcomingCount: number;
  partialCount: number;
  disputeCount: number;
  promiseCount: number;
  paidCount: number;
  archivedCount: number;
  totalOpenAmount: number;
  totalOverdueAmount: number;
  pendingVerificationAmount: number;
}

export interface InvoiceListResponse {
  items: InvoiceListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  referenceDate: string;
  summary: InvoiceListSummary;
}

export interface InvoiceAllocation {
  id: string;
  paymentId: string;
  paymentReference: string;
  paymentMethod?: string | null;
  paymentStatus: string;
  allocatedAmount: number;
  declaredAt: string;
  confirmedAt?: string | null;
  createdAt: string;
}

export interface InvoiceDeclaredPayment {
  id: string;
  reference: string;
  amount: number;
  status: string;
  paymentMethod?: string | null;
  declaredAt: string;
  createdBy?: string | null;
}

export interface InvoiceCreditNote {
  id: string;
  reference: string;
  amount: number;
  status: CreditNoteStatus;
  reason: string;
  validatedAt?: string | null;
  validatedBy?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface InvoicePromise {
  id: string;
  promisedAmount: number;
  promisedDate: string;
  status: PromiseStatus;
  isOverdue: boolean;
  note?: string | null;
  recordedBy?: string | null;
  evaluatedAt?: string | null;
  createdAt: string;
}

export interface InvoiceDispute {
  id: string;
  category: string;
  reason: string;
  status: DisputeStatus;
  openedBy?: string | null;
  openedAt: string;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
}

export interface InvoiceReminder {
  id: string;
  channel: string;
  status: string;
  scheduledFor: string;
  subject?: string | null;
  createdAt: string;
}

export interface InvoiceDocument {
  id: string;
  docType: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy?: string | null;
  createdAt: string;
}

export interface InvoiceHistoryEntry {
  id: string;
  eventType: string;
  category: string;
  actorLabel: string;
  summary: string;
  createdAt: string;
}

export interface InvoiceDetail {
  id: string;
  reference: string;
  clientId: string;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  description?: string | null;
  isArchived: boolean;
  archivedAt?: string | null;
  archivedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  referenceDate: string;
  totalAmount: number;
  confirmedPaidAmount: number;
  validatedCreditNotesAmount: number;
  pendingVerificationAmount: number;
  remainingAmount: number;
  delayDays: number;
  isOverdue: boolean;
  isPartiallyPaid: boolean;
  hasDispute: boolean;
  remindersSuspended: boolean;
  suspensionReason?: string | null;
  status: InvoiceDerivedStatus;
  statusExplanation: string;
  allocations: InvoiceAllocation[];
  declaredPayments: InvoiceDeclaredPayment[];
  creditNotes: InvoiceCreditNote[];
  promises: InvoicePromise[];
  disputes: InvoiceDispute[];
  reminders: InvoiceReminder[];
  documents: InvoiceDocument[];
  history: InvoiceHistoryEntry[];
}

export interface DisputeCreatePayload {
  category: DisputeCategory;
  reason: string;
}

export interface DisputeUpdatePayload {
  status: DisputeStatus;
  category?: DisputeCategory;
  reason?: string;
  resolutionNote?: string | null;
}

export interface PromiseCreatePayload {
  promisedAmount: number;
  promisedDate: string;
  note?: string | null;
}

export interface PromiseUpdatePayload {
  status: PromiseStatus;
  note?: string | null;
}

export interface CreditNoteCreatePayload {
  reference: string;
  amount: number;
  reason: string;
  validateNow: boolean;
}
