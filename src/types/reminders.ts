export type ReminderChannel = 'EMAIL' | 'WHATSAPP' | 'PHONE';

export type ReminderStatus =
  | 'PLANNED'
  | 'PREPARED'
  | 'VALIDATED'
  | 'SENT'
  | 'CANCELLED';

export interface ReminderItem {
  id: string;
  organizationId: string;
  invoiceId: string;
  invoiceReference: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  channel: ReminderChannel;
  status: ReminderStatus;
  scheduledFor: string;
  subject: string;
  bodyPreview: string;
  overdueDays: number;
  remainingAmount: number;
  hasDispute: boolean;
  contactAllowed: boolean;
  contactHours: string | null;
  restrictionsNote: string | null;
  createdAt: string;
  sentAt?: string | null;
  validatedAt?: string | null;
  attachOriginalInvoice?: boolean;
  attachPaymentInstructions?: boolean;
}

export interface PaymentInstructionsData {
  organization: {
    name: string;
    taxId: string;
    address: string;
    email: string;
    phone: string;
    bankName: string;
    ibanOrRib: string;
    mobileMoneyMerchant: string;
    paymentInstructions: string;
  };
  invoice: {
    id: string;
    reference: string;
    issueDate: string;
    dueDate: string;
    totalAmount: number;
    remainingAmount: number;
    currency: string;
    delayDays: number;
  };
  client: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    taxId?: string | null;
  };
  qrCodePayload: string;
  postPaymentSteps: Array<{
    step: number;
    title: string;
    description: string;
  }>;
}

export interface ReminderListResponse {
  items: ReminderItem[];
  total: number;
  summary: {
    totalCount: number;
    toValidateCount: number;
    validatedCount: number;
    sentCount: number;
    plannedCount: number;
  };
}

export interface GenerateDraftRequest {
  invoiceReference: string;
  clientName: string;
  clientContact?: string;
  channel: ReminderChannel;
  amount: number;
  delayDays: number;
  tone?: 'COURTEOUS' | 'FIRM' | 'FORMAL_NOTICE';
}

export interface GenerateDraftResponse {
  subject: string;
  body: string;
  aiGenerated: boolean;
}
