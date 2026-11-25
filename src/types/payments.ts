export type PaymentStatus =
  | 'DECLARED'
  | 'RECEIPT_RECEIVED'
  | 'PENDING_VERIFICATION'
  | 'CONFIRMED'
  | 'RECORDED'
  | 'REJECTED';

export type PaymentMethod =
  | 'VIREMENT_BANCAIRE'
  | 'MTN_MOBILE_MONEY'
  | 'MOOV_MONEY'
  | 'CHEQUE'
  | 'ESPECES';

export interface PaymentItem {
  id: string;
  reference: string;
  organizationId: string;
  invoiceId: string;
  invoiceReference: string;
  clientId: string;
  clientName: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: string;
  receiptDocumentId?: string | null;
  receiptFileName?: string | null;
  declaredAt: string;
  confirmedAt?: string | null;
  createdBy: string;
  rejectionReason?: string | null;
  invoiceTotalAmount: number;
  invoiceRemainingAmount: number;
}

export interface PaymentListResponse {
  items: PaymentItem[];
  total: number;
  summary: {
    totalCount: number;
    pendingCount: number;
    confirmedCount: number;
    rejectedCount: number;
    pendingAmount: number;
    confirmedAmount: number;
  };
}

export interface ConfirmPaymentPayload {
  allocationInvoiceId?: string;
  note?: string;
}

export interface RejectPaymentPayload {
  reason: string;
}

export interface PaymentReceipt {
  receiptNumber: string;
  documentId: string;
  organization: {
    name: string;
    taxId: string;
    address: string;
    email: string;
    phone: string;
    bankName: string;
    ibanOrRib: string;
    mobileMoneyMerchant: string;
  };
  client: {
    id: string;
    name: string;
    taxId: string | null;
    address: string | null;
    email: string | null;
    phone: string | null;
  };
  invoice: {
    id: string;
    reference: string;
    totalAmount: number;
    issueDate: string;
    dueDate: string;
    currency: string;
  };
  payment: {
    id: string;
    reference: string;
    amount: number;
    paymentMethod: string;
    declaredAt: string;
    confirmedAt: string;
    confirmedBy: string;
  };
  financials: {
    previousRemaining: number;
    amountPaid: number;
    newRemaining: number;
    isFullyPaid: boolean;
    badgeLabel: 'FACTURE ENTIÈREMENT PAYÉE' | 'PAIEMENT REÇU';
  };
  legalNotice: string;
  generatedAt: string;
}

