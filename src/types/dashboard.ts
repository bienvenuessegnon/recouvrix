import type { ActivityLogEntry, UserRole } from './auth';

export type DerivedInvoiceStatus =
  | 'UPCOMING'
  | 'OVERDUE'
  | 'PARTIAL'
  | 'DISPUTE'
  | 'PROMISE'
  | 'PAID';

export interface PriorityItem {
  id: string;
  kind:
    | 'OVERDUE_CRITICAL'
    | 'HIGH_AMOUNT_OVERDUE'
    | 'PROMISE_DUE'
    | 'PAYMENT_TO_VERIFY'
    | 'DISPUTE'
    | 'REMINDER_TO_VALIDATE';
  clientName: string;
  invoiceReference: string;
  remainingAmount: number;
  pendingAmount?: number;
  delayDays: number;
  reason: string;
  recommendedAction: string;
  targetSection: 'invoices' | 'payments' | 'reminders' | 'clients';
  targetFilter: string;
  urgencyRank: number;
  isAiGenerated: boolean;
  aiJustification?: string;
}

export interface StatusBreakdownItem {
  status: DerivedInvoiceStatus;
  label: string;
  count: number;
  amount: number;
  excludedFromOpen: boolean;
}

export interface EvolutionPoint {
  date: string;
  label: string;
  openAmount: number;
  recoveredAmount: number;
  overdueAmount: number;
}

export interface DashboardMetrics {
  referenceDate: string;
  isEmpty: boolean;
  isDemoDataActive: boolean;
  counts: {
    clientsCount: number;
    invoicesCount: number;
    openInvoicesCount: number;
    overdueInvoicesCount: number;
    pendingPaymentsCount: number;
    preparedRemindersCount: number;
    activePromisesCount: number;
    disputesCount: number;
  };
  kpis: {
    totalOpenReceivables: number;
    overdueReceivables: number;
    notYetDueReceivables: number;
    pendingVerificationAmount: number;
    confirmedRecoveredTotal: number;
    totalBilledPortfolio: number;
    recoveryRatePercent: number | null;
    recoveryFormula: string;
    recoveryPeriodLabel: string;
  };
  priorities: PriorityItem[];
  statusBreakdown: StatusBreakdownItem[];
  evolution: EvolutionPoint[];
}

export interface DashboardAiState {
  status: 'available' | 'unavailable' | 'not_needed';
  modelUsed?: string;
  generatedAt?: string;
  executiveSummary?: string;
  items: Array<{
    invoiceReference: string;
    justification: string;
    recommendedAction: string;
  }>;
  message?: string;
}

export interface AdminSupervisionSummary {
  totalUsers: number;
  activeUsers: number;
  managerCount: number;
  totalOperationsLogged: number;
  aiAvailable: boolean;
}

export interface DashboardResponse {
  role: UserRole;
  periodDays: 7 | 30 | 90 | 365;
  metrics: DashboardMetrics;
  recentActivity: ActivityLogEntry[];
  aiAdvisory: DashboardAiState;
  adminSupervision: AdminSupervisionSummary | null;
}
