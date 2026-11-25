export type ClientType = 'COMPANY' | 'INDIVIDUAL';
export type PreferredChannel = 'EMAIL' | 'WHATSAPP' | 'PHONE';
export type ClientGlobalStatus =
  | 'DISPUTE'
  | 'OVERDUE'
  | 'PROMISE'
  | 'UP_TO_DATE'
  | 'SETTLED'
  | 'ARCHIVED';

export interface CommunicationPreferences {
  preferredChannel: PreferredChannel;
  contactAllowed: boolean;
  contactHours: string | null;
  restrictionsNote: string | null;
}

export interface ClientFinancialSummary {
  totalBilled: number;
  totalPaidConfirmed: number;
  remainingAmount: number;
  overdueAmount: number;
  pendingVerificationAmount: number;
  invoicesCount: number;
  openInvoicesCount: number;
  overdueInvoicesCount: number;
  pendingPaymentsCount: number;
  activePromisesCount: number;
  openDisputesCount: number;
  globalStatus: ClientGlobalStatus;
}

export interface ClientListItem {
  id: string;
  name: string;
  clientType: ClientType;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  contactName: string | null;
  preferredChannel: PreferredChannel;
  contactAllowed: boolean;
  isArchived: boolean;
  archivedAt: string | null;
  invoicesCount: number;
  overdueInvoicesCount: number;
  remainingAmount: number;
  overdueAmount: number;
  pendingVerificationAmount: number;
  globalStatus: ClientGlobalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPortfolioSummary {
  activeClients: number;
  archivedClients: number;
  overdueClients: number;
  disputeClients: number;
  totalRemainingPortfolio: number;
}

export interface ClientListResponse {
  items: ClientListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: ClientPortfolioSummary;
}

export interface ClientInvoiceSummary {
  id: string;
  reference: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  confirmedPaidAmount: number;
  pendingVerificationAmount: number;
  remainingAmount: number;
  delayDays: number;
  status: string;
}

export interface ClientPromiseSummary {
  id: string;
  invoiceId: string;
  invoiceReference: string;
  promisedAmount: number;
  promisedDate: string;
  status: string;
  note: string | null;
  createdAt: string;
}

export interface ClientDisputeSummary {
  id: string;
  invoiceId: string;
  invoiceReference: string;
  reason: string;
  status: string;
  openedBy: string | null;
  openedAt: string;
  resolvedAt: string | null;
}

export interface ClientReminderSummary {
  id: string;
  invoiceId: string;
  invoiceReference: string;
  channel: string;
  status: string;
  scheduledFor: string;
  subject: string | null;
  createdAt: string;
}

export interface ClientDocumentSummary {
  id: string;
  docType: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface ClientHistoryEntry {
  id: string;
  eventType: string;
  category: string;
  actorLabel: string;
  summary: string;
  createdAt: string;
}

export interface ClientDetail {
  id: string;
  name: string;
  clientType: ClientType;
  taxId: string | null;
  address: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  secondaryContact: string | null;
  notes: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  archivedBy: string | null;
  createdAt: string;
  updatedAt: string;
  communicationPreferences: CommunicationPreferences;
  financial: ClientFinancialSummary;
  invoices: ClientInvoiceSummary[];
  promises: ClientPromiseSummary[];
  disputes: ClientDisputeSummary[];
  reminders: ClientReminderSummary[];
  history: ClientHistoryEntry[];
  documents: ClientDocumentSummary[];
}

export interface ClientCreatePayload {
  name: string;
  clientType: ClientType;
  taxId?: string | null;
  address?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  secondaryContact?: string | null;
  notes?: string | null;
  communicationPreferences: CommunicationPreferences;
}

export type ClientUpdatePayload = Partial<ClientCreatePayload>;

export interface ClientListParams {
  search?: string;
  status?: 'ALL' | ClientGlobalStatus;
  clientType?: 'ALL' | ClientType;
  channel?: 'ALL' | PreferredChannel;
  includeArchived?: boolean;
  sortBy?: 'remaining_amount' | 'name' | 'invoices_count' | 'status' | 'created_at';
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
