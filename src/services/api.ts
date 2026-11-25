import type {
  ActivityLogEntry,
  AuthStatusResponse,
  AuthUser,
  LoginResponse,
  UserRole,
  WorkspaceOverviewResponse,
} from '../types/auth';
import type { DashboardAiState, DashboardResponse } from '../types/dashboard';
import type {
  ClientCreatePayload,
  ClientDetail,
  ClientListParams,
  ClientListResponse,
  ClientUpdatePayload,
} from '../types/clients';
import type {
  CreditNoteCreatePayload,
  DisputeCreatePayload,
  DisputeUpdatePayload,
  InvoiceDetail,
  InvoiceDocumentType,
  InvoiceListParams,
  InvoiceListResponse,
  PromiseCreatePayload,
  PromiseUpdatePayload,
} from '../types/invoices';
import type {
  GenerateDraftRequest,
  GenerateDraftResponse,
  PaymentInstructionsData,
  ReminderItem,
  ReminderListResponse,
} from '../types/reminders';
import type {
  ConfirmPaymentPayload,
  PaymentItem,
  PaymentListResponse,
  PaymentReceipt,
  RejectPaymentPayload,
} from '../types/payments';
import type { OrganizationSettings } from '../types/settings';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let inMemoryToken: string | null = null;
let unauthorizedHandler: ((reason?: string) => void) | null = null;

export function setSessionToken(token: string | null): void {
  inMemoryToken = token;
}

export function getSessionToken(): string | null {
  return inMemoryToken;
}

export function setUnauthorizedHandler(handler: ((reason?: string) => void) | null): void {
  unauthorizedHandler = handler;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  isProtected = true
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (isProtected && inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(
      'Problème temporaire de connexion au serveur. Veuillez réessayer.',
      0,
      'NETWORK_ERROR'
    );
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const errorMessage =
      typeof payload.error === 'string'
        ? payload.error
        : typeof payload.message === 'string'
          ? payload.message
          : response.status === 401
            ? 'Identifiant ou mot de passe incorrect.'
            : response.status === 403
              ? 'Accès refusé. Vérifiez la configuration initiale ou vos droits.'
              : response.status === 429
                ? 'Trop de requêtes. Réessayez dans un instant.'
                : response.status >= 500
                  ? 'Le serveur est temporairement indisponible. Réessayez.'
                  : `Impossible de traiter la demande (code ${response.status}).`;
    const errorCode = typeof payload.code === 'string' ? payload.code : undefined;

    if (response.status === 401 && isProtected) {
      inMemoryToken = null;
      if (unauthorizedHandler) {
        unauthorizedHandler(errorMessage);
      }
    }

    throw new ApiError(errorMessage, response.status, errorCode);
  }

  return payload as T;
}

export const authApi = {
  getStatus: () => request<AuthStatusResponse>('/api/auth/status', { method: 'GET' }, false),

  bootstrapDemo: (adminPassword: string, managerPassword: string) =>
    request<{ message: string }>(
      '/api/auth/bootstrap',
      {
        method: 'POST',
        body: JSON.stringify({ adminPassword, managerPassword }),
      },
      false
    ),

  login: (email: string, password: string) =>
    request<LoginResponse>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      false
    ),

  logout: () => request<{ message: string }>('/api/auth/logout', { method: 'POST' }, true),

  me: () => request<{ user: AuthUser; expiresAt: string }>('/api/auth/me', { method: 'GET' }, true),
};

export const workspaceApi = {
  getOverview: () =>
    request<WorkspaceOverviewResponse>('/api/workspace/overview', { method: 'GET' }, true),

  getActivityLogs: () =>
    request<{ logs: ActivityLogEntry[] }>('/api/workspace/activity-logs', { method: 'GET' }, true),
};

export const dashboardApi = {
  getDashboard: (period: 7 | 30 | 90 | 365 = 30) =>
    request<DashboardResponse>(`/api/dashboard?period=${period}`, { method: 'GET' }, true),

  refreshAi: () =>
    request<{ aiAdvisory: DashboardAiState }>(
      '/api/dashboard/ai-refresh',
      { method: 'POST' },
      true
    ),
};

export const demoApi = {
  seed: () => request<{ message: string }>('/api/demo/seed', { method: 'POST' }, true),
  clear: () => request<{ message: string }>('/api/demo/clear', { method: 'POST' }, true),
};

export const adminApi = {
  listUsers: () => request<{ users: AuthUser[] }>('/api/admin/users', { method: 'GET' }, true),

  createUser: (payload: {
    fullName: string;
    email: string;
    role: UserRole;
    password: string;
  }) =>
    request<{ user: AuthUser }>(
      '/api/admin/users',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      true
    ),

  updateUser: (
    userId: string,
    payload: {
      fullName?: string;
      role?: UserRole;
      isActive?: boolean;
    }
  ) =>
    request<{ user: AuthUser }>(
      `/api/admin/users/${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      true
    ),

  resetDemoAccounts: (payload?: { adminPassword?: string; managerPassword?: string }) =>
    request<{ message: string; users: AuthUser[] }>(
      '/api/admin/users/reset-demo',
      {
        method: 'POST',
        body: JSON.stringify(payload ?? {}),
      },
      true
    ),
};

export const clientsApi = {
  list: (params: ClientListParams = {}) => {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.status) query.set('status', params.status);
    if (params.clientType) query.set('client_type', params.clientType);
    if (params.channel) query.set('channel', params.channel);
    if (params.includeArchived !== undefined) {
      query.set('include_archived', String(params.includeArchived));
    }
    if (params.sortBy) query.set('sort_by', params.sortBy);
    if (params.sortDir) query.set('sort_dir', params.sortDir);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('page_size', String(params.pageSize));
    const qs = query.toString();
    return request<ClientListResponse>(
      `/api/clients${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      true
    );
  },

  getById: (clientId: string) =>
    request<ClientDetail>(`/api/clients/${encodeURIComponent(clientId)}`, { method: 'GET' }, true),

  create: (payload: ClientCreatePayload) =>
    request<ClientDetail>(
      '/api/clients',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      true
    ),

  update: (clientId: string, payload: ClientUpdatePayload) =>
    request<ClientDetail>(
      `/api/clients/${encodeURIComponent(clientId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      true
    ),

  archive: (clientId: string) =>
    request<ClientDetail>(
      `/api/clients/${encodeURIComponent(clientId)}/archive`,
      { method: 'POST' },
      true
    ),

  restore: (clientId: string) =>
    request<ClientDetail>(
      `/api/clients/${encodeURIComponent(clientId)}/restore`,
      { method: 'POST' },
      true
    ),
};

function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const invoicesApi = {
  list: (params: InvoiceListParams = {}) => {
    const query = new URLSearchParams();
    if (params.search?.trim()) query.set('search', params.search.trim());
    if (params.status) query.set('status', params.status);
    if (params.clientId) query.set('client_id', params.clientId);
    if (params.dateFrom) query.set('date_from', params.dateFrom);
    if (params.dateTo) query.set('date_to', params.dateTo);
    if (params.dateField) query.set('date_field', params.dateField);
    if (params.sortBy) query.set('sort_by', params.sortBy);
    if (params.sortDir) query.set('sort_dir', params.sortDir);
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('page_size', String(params.pageSize));
    const qs = query.toString();
    return request<InvoiceListResponse>(
      `/api/invoices${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      true
    );
  },

  getById: (invoiceId: string) =>
    request<InvoiceDetail>(`/api/invoices/${encodeURIComponent(invoiceId)}`, { method: 'GET' }, true),

  updateMetadata: (invoiceId: string, description: string | null) =>
    request<InvoiceDetail>(
      `/api/invoices/${encodeURIComponent(invoiceId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ description }),
      },
      true
    ),

  archive: (invoiceId: string) =>
    request<InvoiceDetail>(
      `/api/invoices/${encodeURIComponent(invoiceId)}/archive`,
      { method: 'POST' },
      true
    ),

  restore: (invoiceId: string) =>
    request<InvoiceDetail>(
      `/api/invoices/${encodeURIComponent(invoiceId)}/restore`,
      { method: 'POST' },
      true
    ),

  openDispute: (invoiceId: string, payload: DisputeCreatePayload, idempotencyKey?: string) =>
    request<InvoiceDetail>(
      `/api/invoices/${encodeURIComponent(invoiceId)}/disputes`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey || createIdempotencyKey() },
        body: JSON.stringify(payload),
      },
      true
    ),

  updateDispute: (invoiceId: string, disputeId: string, payload: DisputeUpdatePayload) =>
    request<InvoiceDetail>(
      `/api/invoices/${encodeURIComponent(invoiceId)}/disputes/${encodeURIComponent(disputeId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      true
    ),

  recordPromise: (invoiceId: string, payload: PromiseCreatePayload, idempotencyKey?: string) =>
    request<InvoiceDetail>(
      `/api/invoices/${encodeURIComponent(invoiceId)}/promises`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey || createIdempotencyKey() },
        body: JSON.stringify(payload),
      },
      true
    ),

  updatePromise: (invoiceId: string, promiseId: string, payload: PromiseUpdatePayload) =>
    request<InvoiceDetail>(
      `/api/invoices/${encodeURIComponent(invoiceId)}/promises/${encodeURIComponent(promiseId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      true
    ),

  createCreditNote: (
    invoiceId: string,
    payload: CreditNoteCreatePayload,
    idempotencyKey?: string
  ) =>
    request<InvoiceDetail>(
      `/api/invoices/${encodeURIComponent(invoiceId)}/credit-notes`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey || createIdempotencyKey() },
        body: JSON.stringify(payload),
      },
      true
    ),

  validateCreditNote: (invoiceId: string, creditId: string, idempotencyKey?: string) =>
    request<InvoiceDetail>(
      `/api/invoices/${encodeURIComponent(invoiceId)}/credit-notes/${encodeURIComponent(creditId)}/validate`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey || createIdempotencyKey() },
      },
      true
    ),

  uploadDocument: async (
    invoiceId: string,
    params: { docType: InvoiceDocumentType; title?: string; file: File }
  ): Promise<InvoiceDetail> => {
    const formData = new FormData();
    formData.append('docType', params.docType);
    if (params.title?.trim()) {
      formData.append('title', params.title.trim());
    }
    formData.append('file', params.file);

    const headers = new Headers();
    if (inMemoryToken) {
      headers.set('Authorization', `Bearer ${inMemoryToken}`);
    }

    let response: Response;
    try {
      response = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/documents`, {
        method: 'POST',
        headers,
        body: formData,
      });
    } catch {
      throw new ApiError(
        'Problème temporaire lors de l’envoi du document. Veuillez réessayer.',
        0,
        'NETWORK_ERROR'
      );
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const errorMessage =
        typeof payload.error === 'string'
          ? payload.error
          : 'Impossible d’enregistrer le document.';
      if (response.status === 401 && unauthorizedHandler) {
        inMemoryToken = null;
        unauthorizedHandler(errorMessage);
      }
      throw new ApiError(errorMessage, response.status);
    }

    return payload as unknown as InvoiceDetail;
  },
};

export const documentsApi = {
  download: async (documentId: string, fileName: string): Promise<void> => {
    const headers = new Headers();
    if (inMemoryToken) {
      headers.set('Authorization', `Bearer ${inMemoryToken}`);
    }

    let response: Response;
    try {
      response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/download`, {
        method: 'GET',
        headers,
      });
    } catch {
      throw new ApiError(
        'Problème temporaire lors du téléchargement du document.',
        0,
        'NETWORK_ERROR'
      );
    }

    if (!response.ok) {
      let errorMessage = 'Impossible de télécharger ce document.';
      try {
        const errPayload = (await response.json()) as Record<string, unknown>;
        if (typeof errPayload.error === 'string') {
          errorMessage = errPayload.error;
        }
      } catch {
        // Ignore parse error on non-JSON failure
      }
      if (response.status === 401 && unauthorizedHandler) {
        inMemoryToken = null;
        unauthorizedHandler(errorMessage);
      }
      throw new ApiError(errorMessage, response.status);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'document';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export const importsApi = {
  preview: async (file: File, sourceType: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sourceType', sourceType);

    const headers = new Headers();
    if (inMemoryToken) {
      headers.set('Authorization', `Bearer ${inMemoryToken}`);
    }

    let response: Response;
    try {
      response = await fetch('/api/imports/preview', {
        method: 'POST',
        headers,
        body: formData,
      });
    } catch {
      throw new ApiError(
        'Problème temporaire lors de l’analyse du fichier.',
        0,
        'NETWORK_ERROR'
      );
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const errorMessage =
        typeof payload.error === 'string'
          ? payload.error
          : 'Impossible de analyser ce fichier.';
      if (response.status === 401 && unauthorizedHandler) {
        inMemoryToken = null;
        unauthorizedHandler(errorMessage);
      }
      throw new ApiError(errorMessage, response.status);
    }

    return payload as any;
  },

  commit: async (payload: { filename: string; sourceType: string; rows: any[] }) => {
    const headers = new Headers();
    if (inMemoryToken) {
      headers.set('Authorization', `Bearer ${inMemoryToken}`);
    }
    headers.set('Content-Type', 'application/json');

    let response: Response;
    try {
      response = await fetch('/api/imports/commit', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    } catch {
      throw new ApiError(
        'Problème temporaire lors de l’enregistrement de l’importation.',
        0,
        'NETWORK_ERROR'
      );
    }

    let resPayload: Record<string, unknown> = {};
    try {
      resPayload = (await response.json()) as Record<string, unknown>;
    } catch {
      resPayload = {};
    }

    if (!response.ok) {
      const errorMessage =
        typeof resPayload.error === 'string'
          ? resPayload.error
          : 'Impossible d’enregistrer le lot importé.';
      if (response.status === 401 && unauthorizedHandler) {
        inMemoryToken = null;
        unauthorizedHandler(errorMessage);
      }
      throw new ApiError(errorMessage, response.status);
    }

    return resPayload as any;
  },

  history: async () => {
    const headers = new Headers();
    if (inMemoryToken) {
      headers.set('Authorization', `Bearer ${inMemoryToken}`);
    }

    let response: Response;
    try {
      response = await fetch('/api/imports/history', {
        method: 'GET',
        headers,
      });
    } catch {
      throw new ApiError(
        'Problème temporaire lors du chargement de l’historique des imports.',
        0,
        'NETWORK_ERROR'
      );
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    if (!response.ok) {
      const errorMessage =
        typeof payload.error === 'string'
          ? payload.error
          : 'Impossible de charger l’historique.';
      if (response.status === 401 && unauthorizedHandler) {
        inMemoryToken = null;
        unauthorizedHandler(errorMessage);
      }
      throw new ApiError(errorMessage, response.status);
    }

    return payload as any;
  },
};

export const remindersApi = {
  list: (params: { status?: string; channel?: string; search?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.channel) query.set('channel', params.channel);
    if (params.search?.trim()) query.set('search', params.search.trim());
    const qs = query.toString();
    return request<ReminderListResponse>(
      `/api/reminders${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      true
    );
  },

  update: (id: string, payload: Partial<ReminderItem>) =>
    request<ReminderItem>(
      `/api/reminders/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      true
    ),

  create: (payload: Partial<ReminderItem>) =>
    request<ReminderItem>(
      '/api/reminders',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      true
    ),

  generateAiDraft: (payload: GenerateDraftRequest) =>
    request<GenerateDraftResponse>(
      '/api/reminders/generate-draft',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      true
    ),

  getPaymentInstructions: (invoiceId: string) =>
    request<PaymentInstructionsData>(
      `/api/invoices/${encodeURIComponent(invoiceId)}/payment-instructions`,
      { method: 'GET' },
      true
    ),

  downloadPaymentInstructionsPdf: async (invoiceId: string, reference: string) => {
    return documentsApi.download(
      `notice-${invoiceId}`,
      `instructions_paiement_${reference}.pdf`
    );
  },

  downloadOriginalInvoicePdf: async (invoiceId: string, reference: string) => {
    return documentsApi.download(
      `inv-${invoiceId}`,
      `facture_${reference}.pdf`
    );
  },
};

export const paymentsApi = {
  list: (params: { status?: string; search?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.search?.trim()) query.set('search', params.search.trim());
    const qs = query.toString();
    return request<PaymentListResponse>(
      `/api/payments${qs ? `?${qs}` : ''}`,
      { method: 'GET' },
      true
    );
  },

  create: (payload: Partial<PaymentItem>) =>
    request<PaymentItem>(
      '/api/payments',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      true
    ),

  confirm: (id: string, payload: ConfirmPaymentPayload = {}) =>
    request<{ payment: PaymentItem; receipt: PaymentReceipt; message: string }>(
      `/api/payments/${encodeURIComponent(id)}/confirm`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      true
    ),

  getReceipt: (id: string) =>
    request<PaymentReceipt>(
      `/api/payments/${encodeURIComponent(id)}/receipt`,
      { method: 'GET' },
      true
    ),

  sendReceipt: (id: string, channel: 'EMAIL' | 'WHATSAPP') =>
    request<{ success: boolean; message: string; channel: string }>(
      `/api/payments/${encodeURIComponent(id)}/receipt/send`,
      {
        method: 'POST',
        body: JSON.stringify({ channel }),
      },
      true
    ),

  reject: (id: string, payload: RejectPaymentPayload) =>
    request<{ payment: PaymentItem; message: string }>(
      `/api/payments/${encodeURIComponent(id)}/reject`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      true
    ),
};

export const settingsApi = {
  get: () => request<OrganizationSettings>('/api/settings', { method: 'GET' }, true),

  update: (payload: Partial<OrganizationSettings>) =>
    request<OrganizationSettings>(
      '/api/settings',
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      true
    ),
};



