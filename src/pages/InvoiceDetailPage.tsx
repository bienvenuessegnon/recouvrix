import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Edit3,
  FilePlus2,
  FileText,
  HandCoins,
  Mail,
  Phone,
  Plus,
  Receipt,
  Scale,
  ShieldAlert,
} from 'lucide-react';
import {
  CreditNoteFormDrawer,
  DISPUTE_CATEGORY_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
  DisputeFormDrawer,
  DocumentUploadDrawer,
  MetadataEditDrawer,
  PromiseFormDrawer,
} from '../components/invoices/InvoiceActionDrawers';
import {
  AlertBanner,
  Button,
  ConfirmModal,
  EmptyState,
  LoadingState,
  RecouvrixStatusKey,
  StatusBadge,
  SummaryCard,
} from '../components/ui';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDelayDays,
} from '../design-system/formatters';
import { SemanticTone } from '../design-system/tokens';
import type {
  CreditNoteCreatePayload,
  DisputeCreatePayload,
  DisputeUpdatePayload,
  InvoiceDerivedStatus,
  InvoiceDetail,
  InvoiceDispute,
  InvoiceDocumentType,
  InvoicePromise,
  PromiseCreatePayload,
  PromiseUpdatePayload,
} from '../types/invoices';

export interface InvoiceDetailPageProps {
  invoice: InvoiceDetail | null;
  loading: boolean;
  error: string | null;
  actionLoading: boolean;
  onBack: () => void;
  onRetry: () => void;
  onOpenClient: (clientId: string) => void;
  onUpdateMetadata: (description: string | null) => Promise<void>;
  onArchive: () => Promise<void>;
  onRestore: () => Promise<void>;
  onCreateDispute: (payload: DisputeCreatePayload) => Promise<void>;
  onUpdateDispute: (disputeId: string, payload: DisputeUpdatePayload) => Promise<void>;
  onCreatePromise: (payload: PromiseCreatePayload) => Promise<void>;
  onUpdatePromise: (promiseId: string, payload: PromiseUpdatePayload) => Promise<void>;
  onCreateCreditNote: (payload: CreditNoteCreatePayload) => Promise<void>;
  onValidateCreditNote: (creditId: string) => Promise<void>;
  onUploadDocument: (params: {
    docType: InvoiceDocumentType;
    title?: string;
    file: File;
  }) => Promise<void>;
  onDownloadDocument: (documentId: string, fileName: string) => Promise<void>;
}

export const INVOICE_STATUS_KEY_MAP: Record<InvoiceDerivedStatus, RecouvrixStatusKey> = {
  UPCOMING: 'upcoming',
  OVERDUE: 'overdue',
  PARTIAL: 'partial',
  DISPUTE: 'dispute',
  PROMISE: 'promise',
  PAID: 'paid',
};

const DISPUTE_STATUS_META: Record<string, { label: string; tone: SemanticTone }> = {
  OPEN: { label: 'Ouvert', tone: 'danger' },
  IN_REVIEW: { label: 'En instruction', tone: 'warning' },
  RESOLVED: { label: 'Résolu', tone: 'success' },
  CANCELLED: { label: 'Annulé', tone: 'neutral' },
};

const PROMISE_STATUS_META: Record<string, { label: string; tone: SemanticTone }> = {
  ACTIVE: { label: 'En attente', tone: 'warning' },
  KEPT: { label: 'Respectée', tone: 'success' },
  BROKEN: { label: 'Non respectée', tone: 'danger' },
  CANCELLED: { label: 'Annulée', tone: 'neutral' },
};

const CREDIT_STATUS_META: Record<string, { label: string; tone: SemanticTone }> = {
  DRAFT: { label: 'Brouillon', tone: 'neutral' },
  VALIDATED: { label: 'Validé', tone: 'success' },
  CANCELLED: { label: 'Annulé', tone: 'danger' },
};

const DECLARED_PAYMENT_META: Record<string, { label: string; tone: SemanticTone }> = {
  DECLARED: { label: 'Déclaré', tone: 'warning' },
  RECEIPT_RECEIVED: { label: 'Justificatif reçu', tone: 'warning' },
  PENDING_VERIFICATION: { label: 'À vérifier', tone: 'warning' },
  REJECTED: { label: 'Rejeté', tone: 'danger' },
};

const REMINDER_STATUS_META: Record<string, { label: string; tone: SemanticTone }> = {
  PLANNED: { label: 'Planifiée', tone: 'info' },
  PREPARED: { label: 'Préparée', tone: 'info' },
  VALIDATED: { label: 'Validée', tone: 'info' },
  SENT: { label: 'Envoyée', tone: 'success' },
  CANCELLED: { label: 'Annulée', tone: 'neutral' },
};

const INVOICE_HISTORY_LABELS: Record<string, string> = {
  IMPORT_BATCH: 'Importation initiale',
  INVOICE_UPDATED: 'Objet de la facture modifié',
  INVOICE_ARCHIVED: 'Facture archivée',
  INVOICE_RESTORED: 'Facture restaurée',
  DISPUTE_OPENED: 'Litige déclaré',
  DISPUTE_UPDATED: 'Litige mis à jour',
  DISPUTE_RESOLVED: 'Litige clôturé',
  PROMISE_RECORDED: 'Promesse de paiement enregistrée',
  PROMISE_UPDATED: 'Promesse de paiement évaluée',
  CREDIT_NOTE_CREATED: 'Avoir enregistré (brouillon)',
  CREDIT_NOTE_VALIDATED: 'Avoir validé',
  PAYMENT_DECLARED: 'Paiement déclaré',
  RECEIPT_RECEIVED: 'Justificatif reçu',
  PAYMENT_CONFIRMED: 'Paiement confirmé',
  PAYMENT_ALLOCATED: 'Paiement affecté',
  DOCUMENT_ATTACHED: 'Document justificatif joint',
  REMINDER_PREPARED: 'Relance préparée',
  REMINDER_VALIDATED: 'Relance validée',
  REMINDER_SENT: 'Relance envoyée',
  CLIENT_REPLY: 'Réponse client reçue',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

function getDisputeCategoryLabel(category: string): string {
  return DISPUTE_CATEGORY_OPTIONS.find((opt) => opt.value === category)?.label ?? category;
}

function getDocTypeLabel(docType: string): string {
  if (docType === 'FACTURE_PDF') return 'Facture originale';
  return DOCUMENT_TYPE_OPTIONS.find((opt) => opt.value === docType)?.label ?? docType;
}

export const InvoiceDetailPage: React.FC<InvoiceDetailPageProps> = ({
  invoice,
  loading,
  error,
  actionLoading,
  onBack,
  onRetry,
  onOpenClient,
  onUpdateMetadata,
  onArchive,
  onRestore,
  onCreateDispute,
  onUpdateDispute,
  onCreatePromise,
  onUpdatePromise,
  onCreateCreditNote,
  onValidateCreditNote,
  onUploadDocument,
  onDownloadDocument,
}) => {
  const [metadataDrawerOpen, setMetadataDrawerOpen] = useState(false);
  const [disputeDrawerOpen, setDisputeDrawerOpen] = useState(false);
  const [editingDispute, setEditingDispute] = useState<InvoiceDispute | null>(null);
  const [promiseDrawerOpen, setPromiseDrawerOpen] = useState(false);
  const [editingPromise, setEditingPromise] = useState<InvoicePromise | null>(null);
  const [creditDrawerOpen, setCreditDrawerOpen] = useState(false);
  const [docDrawerOpen, setDocDrawerOpen] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [validatingCreditId, setValidatingCreditId] = useState<string | null>(null);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!actionsMenuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setActionsMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [actionsMenuOpen]);

  if (loading && !invoice) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={onBack}>
          Retour à la liste des factures
        </Button>
        <div className="bg-white border border-[var(--color-border)] rounded-lg p-8">
          <LoadingState label="Chargement du dossier de facture…" />
        </div>
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={onBack}>
          Retour à la liste des factures
        </Button>
        <AlertBanner
          tone="error"
          title="Chargement du dossier impossible"
          description={error}
          action={
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Réessayer
            </Button>
          }
        />
      </div>
    );
  }

  if (!invoice) return null;

  const promises = invoice.promises || [];
  const disputes = invoice.disputes || [];
  const allocations = invoice.allocations || [];
  const declaredPayments = invoice.declaredPayments || [];
  const creditNotes = invoice.creditNotes || [];
  const documents = invoice.documents || [];
  const reminders = invoice.reminders || [];
  const history = invoice.history || [];

  const canActOnReceivable = !invoice.isArchived && invoice.remainingAmount > 0;
  const overduePromises = promises.filter((p) => p.isOverdue);

  const handleConfirmArchive = async () => {
    await onArchive();
    setConfirmArchiveOpen(false);
  };

  const handleDownload = async (docId: string, fileName: string) => {
    setDownloadingDocId(docId);
    try {
      await onDownloadDocument(docId, fileName);
    } finally {
      setDownloadingDocId(null);
    }
  };

  const handleValidateCredit = async (creditId: string) => {
    setValidatingCreditId(creditId);
    try {
      await onValidateCreditNote(creditId);
    } finally {
      setValidatingCreditId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barre de retour et en-tête principal */}
      <div className="flex flex-col gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="w-4 h-4" />}
            onClick={onBack}
          >
            Retour à la liste des factures
          </Button>
        </div>

        <div className="bg-white border border-[var(--color-border)] rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-ink-secondary)] shrink-0">
                <Receipt className="w-4 h-4" aria-hidden="true" />
              </div>
              <h2 className="font-mono text-[20px] font-bold text-[var(--color-ink)] tracking-tight">
                {invoice.reference}
              </h2>
              <StatusBadge status={INVOICE_STATUS_KEY_MAP[invoice.status]} />
              {invoice.isArchived && <StatusBadge tone="neutral" label="Archivée" />}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--color-ink-muted)] pl-12">
              <button
                type="button"
                onClick={() => onOpenClient(invoice.clientId)}
                className="font-semibold text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
              >
                <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{invoice.clientName}</span>
              </button>
              <span aria-hidden="true">·</span>
              <span>
                Émise le <span className="tabular-amount">{formatDate(invoice.issueDate)}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Échéance le <span className="tabular-amount">{formatDate(invoice.dueDate)}</span>
              </span>
              {invoice.delayDays > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-[var(--color-overdue)]">
                    {formatDelayDays(invoice.delayDays)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 pl-12 lg:pl-0">
            <Button
              variant="secondary"
              size="sm"
              icon={<Building2 className="w-4 h-4" />}
              onClick={() => onOpenClient(invoice.clientId)}
            >
              Fiche client
            </Button>

            <div className="relative" ref={actionsMenuRef}>
              <Button
                variant="primary"
                size="sm"
                icon={<ChevronDown className="w-4 h-4" />}
                onClick={() => setActionsMenuOpen((open) => !open)}
                disabled={actionLoading}
              >
                Menu Actions
              </Button>
              {actionsMenuOpen && (
                <div className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-lg border border-[var(--color-border)] bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-slate-50 disabled:opacity-50"
                    disabled={!canActOnReceivable}
                    onClick={() => {
                      setActionsMenuOpen(false);
                      setEditingPromise(null);
                      setPromiseDrawerOpen(true);
                    }}
                  >
                    <HandCoins className="w-4 h-4 text-[var(--color-ink-muted)]" />
                    Enregistrer une promesse
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-slate-50 disabled:opacity-50"
                    disabled={!canActOnReceivable}
                    onClick={() => {
                      setActionsMenuOpen(false);
                      setEditingDispute(null);
                      setDisputeDrawerOpen(true);
                    }}
                  >
                    <Scale className="w-4 h-4 text-[var(--color-ink-muted)]" />
                    Déclarer un litige
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-slate-50"
                    onClick={() => {
                      setActionsMenuOpen(false);
                      setDocDrawerOpen(true);
                    }}
                  >
                    <Download className="w-4 h-4 text-[var(--color-ink-muted)]" />
                    Joindre / télécharger un document
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-slate-50 disabled:opacity-50"
                    disabled={!canActOnReceivable}
                    onClick={() => {
                      setActionsMenuOpen(false);
                      setCreditDrawerOpen(true);
                    }}
                  >
                    <FilePlus2 className="w-4 h-4 text-[var(--color-ink-muted)]" />
                    Ajouter un avoir
                  </button>
                  <div className="my-1 border-t border-[var(--color-border)]" />
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-slate-50"
                    onClick={() => {
                      setActionsMenuOpen(false);
                      setMetadataDrawerOpen(true);
                    }}
                  >
                    <Edit3 className="w-4 h-4 text-[var(--color-ink-muted)]" />
                    Modifier l’objet
                  </button>
                  {invoice.isArchived ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-slate-50"
                      onClick={() => {
                        setActionsMenuOpen(false);
                        void onRestore();
                      }}
                    >
                      <ArchiveRestore className="w-4 h-4 text-[var(--color-ink-muted)]" />
                      Restaurer
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-slate-50"
                      onClick={() => {
                        setActionsMenuOpen(false);
                        setConfirmArchiveOpen(true);
                      }}
                    >
                      <Archive className="w-4 h-4 text-[var(--color-ink-muted)]" />
                      Archiver
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline visuelle du cycle de vie */}
      {(() => {
        const sentReminders = reminders.filter((r) => r.status === 'SENT');
        const lastReminder = sentReminders[sentReminders.length - 1];
        const activePromise = promises.find((p) => p.status === 'ACTIVE' || p.status === 'BROKEN');
        const openDispute = disputes.find((d) => d.status === 'OPEN' || d.status === 'IN_REVIEW');
        const settled = invoice.remainingAmount <= 0;
        const steps: Array<{ key: string; label: string; detail: string; state: 'done' | 'current' | 'todo' }> = [
          {
            key: 'issued',
            label: 'Émise',
            detail: formatDate(invoice.issueDate),
            state: 'done',
          },
          {
            key: 'due',
            label:
              invoice.delayDays > 0
                ? `Échue (+${invoice.delayDays}j)`
                : settled
                  ? 'Échue'
                  : 'Échéance',
            detail: formatDate(invoice.dueDate),
            state: invoice.delayDays >= 0 || settled ? 'done' : 'todo',
          },
          {
            key: 'reminder',
            label: lastReminder
              ? `Relance N°${sentReminders.length} envoyée`
              : invoice.delayDays > 0 && !settled
                ? 'Relance à préparer'
                : 'Relance',
            detail: lastReminder
              ? formatDate(lastReminder.scheduledFor || lastReminder.createdAt)
              : '',
            state: lastReminder
              ? 'done'
              : invoice.delayDays > 0 && !settled && !openDispute && !activePromise
                ? 'current'
                : 'todo',
          },
          {
            key: 'promise',
            label: openDispute
              ? 'Litige ouvert'
              : activePromise
                ? 'Promesse de paiement'
                : settled
                  ? 'Promesse / suivi'
                  : 'Promesse de paiement',
            detail: openDispute
              ? openDispute.reason?.slice(0, 42) || ''
              : activePromise
                ? formatDate(activePromise.promisedDate)
                : '',
            state: openDispute || activePromise ? 'current' : settled ? 'done' : 'todo',
          },
          {
            key: 'paid',
            label: 'Soldée / Quittance',
            detail: settled
              ? formatCurrency(0, invoice.currency)
              : formatCurrency(invoice.remainingAmount, invoice.currency),
            state: settled ? 'done' : 'todo',
          },
        ];
        const hasCurrent = steps.some((s) => s.state === 'current');
        if (!hasCurrent && !settled) {
          const firstTodo = steps.find((s) => s.state === 'todo');
          if (firstTodo) firstTodo.state = 'current';
        }
        return (
          <ol
            className="bg-white border border-[var(--color-border)] rounded-lg px-4 py-4 flex flex-col sm:flex-row sm:items-stretch gap-3 sm:gap-0 overflow-x-auto"
            aria-label="Cycle de vie de la créance"
          >
            {steps.map((step, index) => (
              <li
                key={step.key}
                className={`relative flex sm:flex-1 sm:flex-col items-start sm:items-center gap-3 sm:gap-2 min-w-0 sm:px-2 ${
                  step.state === 'done'
                    ? 'text-[var(--color-success)]'
                    : step.state === 'current'
                      ? 'text-[var(--color-primary)]'
                      : 'text-[var(--color-ink-muted)]'
                }`}
              >
                {index > 0 && (
                  <span
                    className={`hidden sm:block absolute top-3 right-1/2 w-full h-0.5 -translate-y-1/2 -z-0 ${
                      steps[index - 1].state === 'done' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-border)]'
                    }`}
                    aria-hidden="true"
                  />
                )}
                <span
                  className={`relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 text-[11px] font-bold ${
                    step.state === 'done'
                      ? 'bg-[var(--color-success)] border-[var(--color-success)] text-white'
                      : step.state === 'current'
                        ? 'bg-white border-[var(--color-primary)] text-[var(--color-primary)]'
                        : 'bg-white border-[var(--color-border-strong)] text-[var(--color-ink-muted)]'
                  }`}
                  aria-hidden="true"
                >
                  {step.state === 'done' ? '✓' : index + 1}
                </span>
                <span className="min-w-0 sm:text-center space-y-0.5">
                  <span className="block text-[13px] font-semibold text-[var(--color-ink)] leading-snug">
                    {step.label}
                  </span>
                  {step.detail ? (
                    <span className="block text-[11px] text-[var(--color-ink-muted)] tabular-amount">
                      {step.detail}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        );
      })()}

      {/* Bandeaux d'alerte métier */}
      {invoice.isArchived && (
        <AlertBanner
          tone="warning"
          title="Facture archivée"
          description={`Cette créance a été archivée${
            invoice.archivedAt ? ` le ${formatDateTime(invoice.archivedAt)}` : ''
          }${
            invoice.archivedBy ? ` par ${invoice.archivedBy}` : ''
          }. Toutes les pièces, paiements et écritures restent conservés sans modification des soldes historiques.`}
        />
      )}

      {invoice.remindersSuspended && (
        <AlertBanner
          tone="error"
          title="Litige actif — Relances automatiques suspendues"
          description={`${
            invoice.suspensionReason || 'Une contestation est en cours sur cette créance.'
          } La créance reste incluse dans les créances ouvertes jusqu’à résolution ou régularisation par avoir.`}
        />
      )}

      {overduePromises.length > 0 && (
        <AlertBanner
          tone="warning"
          title="Promesse de paiement arrivée à échéance sans règlement confirmé"
          description="La date annoncée par le client est dépassée sans encaissement validé. Évaluez la promesse et décidez de la prochaine action de recouvrement."
        />
      )}

      {/* Situation financière détaillée */}
      <section aria-label="Situation financière de la facture" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <h3 className="text-[16px] font-semibold text-[var(--color-ink)]">
            Situation financière
          </h3>
          <span className="text-[12px] text-[var(--color-ink-muted)]">
            {invoice.statusExplanation}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <SummaryCard
            label="Montant initial"
            value={formatCurrency(invoice.totalAmount, invoice.currency)}
            helper={`Devise : ${invoice.currency}`}
          />
          <SummaryCard
            label="Paiements confirmés affectés"
            value={formatCurrency(invoice.confirmedPaidAmount, invoice.currency)}
            tone="success"
            helper={`${allocations.length} affectation(s) validée(s)`}
          />
          <SummaryCard
            label="Avoirs validés"
            value={formatCurrency(invoice.validatedCreditNotesAmount, invoice.currency)}
            tone="default"
            helper="Déduits du solde dû"
          />
          <SummaryCard
            label="Solde restant dû"
            value={formatCurrency(invoice.remainingAmount, invoice.currency)}
            tone={invoice.remainingAmount > 0 ? 'default' : 'success'}
            helper={
              invoice.remainingAmount === 0
                ? 'Créance soldée'
                : invoice.pendingVerificationAmount > 0
                ? `Dont ${formatCurrency(
                    invoice.pendingVerificationAmount,
                    invoice.currency
                  )} déclarés non déduits`
                : 'Montant à recouvrer'
            }
          />
          <SummaryCard
            label="Retard éventuel"
            value={invoice.delayDays > 0 ? formatDelayDays(invoice.delayDays) : 'Aucun retard'}
            tone={invoice.delayDays > 0 ? 'overdue' : 'default'}
            helper={`Date de référence : ${formatDate(invoice.referenceDate)}`}
          />
        </div>
      </section>

      {/* Informations générales + Synthèse client */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white border border-[var(--color-border)] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-[var(--color-border)]">
            <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
              Informations générales de la créance
            </h3>
            <Button
              variant="ghost"
              size="sm"
              icon={<Edit3 className="w-3.5 h-3.5" />}
              onClick={() => setMetadataDrawerOpen(true)}
            >
              Modifier l’objet
            </Button>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
            <div>
              <dt className="text-[var(--color-ink-muted)]">Référence de facture</dt>
              <dd className="font-mono font-semibold text-[var(--color-ink)] mt-0.5">
                {invoice.reference}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Client associé</dt>
              <dd className="mt-0.5">
                <button
                  type="button"
                  onClick={() => onOpenClient(invoice.clientId)}
                  className="font-semibold text-[var(--color-primary)] hover:underline"
                >
                  {invoice.clientName}
                </button>
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Date d’émission</dt>
              <dd className="tabular-amount text-[var(--color-ink)] mt-0.5">
                {formatDate(invoice.issueDate)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Date d’échéance</dt>
              <dd className="tabular-amount font-medium text-[var(--color-ink)] mt-0.5">
                {formatDate(invoice.dueDate)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--color-ink-muted)]">Description / Objet de la facture</dt>
              <dd className="text-[var(--color-ink-secondary)] mt-1 leading-relaxed">
                {invoice.description || 'Aucun objet renseigné pour cette créance.'}
              </dd>
            </div>
          </dl>
        </section>

        <section className="bg-white border border-[var(--color-border)] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--color-border)]">
            <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
              Coordonnées du débiteur
            </h3>
            <button
              type="button"
              onClick={() => onOpenClient(invoice.clientId)}
              className="text-[12px] font-medium text-[var(--color-primary)] hover:underline"
            >
              Ouvrir le dossier
            </button>
          </div>
          <dl className="space-y-3 text-[13px]">
            <div>
              <dt className="text-[var(--color-ink-muted)]">Raison sociale</dt>
              <dd className="font-medium text-[var(--color-ink)] mt-0.5">{invoice.clientName}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Adresse e-mail</span>
              </dt>
              <dd className="text-[var(--color-ink)] mt-0.5 break-all">
                {invoice.clientEmail || 'Non renseignée'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Téléphone</span>
              </dt>
              <dd className="tabular-amount text-[var(--color-ink)] mt-0.5">
                {invoice.clientPhone || 'Non renseigné'}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Suivi recouvrement : Litiges & Promesses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Litiges */}
        <section className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
                Litiges et contestations ({disputes.length})
              </h3>
              <p className="text-[12px] text-[var(--color-ink-muted)]">
                Un litige ouvert suspend les relances automatiques.
              </p>
            </div>
            {canActOnReceivable && (
              <Button
                variant="secondary"
                size="sm"
                icon={<ShieldAlert className="w-3.5 h-3.5" />}
                onClick={() => {
                  setEditingDispute(null);
                  setDisputeDrawerOpen(true);
                }}
              >
                Déclarer un litige
              </Button>
            )}
          </div>

          {disputes.length === 0 ? (
            <div className="p-5 text-[13px] text-[var(--color-ink-muted)]">
              Aucun litige déclaré sur cette facture.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {disputes.map((dispute) => {
                const meta = DISPUTE_STATUS_META[dispute.status] ?? {
                  label: dispute.status,
                  tone: 'neutral' as SemanticTone,
                };
                return (
                  <div key={dispute.id} className="p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={meta.tone} label={meta.label} />
                        <span className="text-[12px] font-medium text-[var(--color-ink)]">
                          {getDisputeCategoryLabel(dispute.category)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingDispute(dispute);
                          setDisputeDrawerOpen(true);
                        }}
                      >
                        Mettre à jour
                      </Button>
                    </div>
                    <p className="text-[13px] text-[var(--color-ink-secondary)] leading-relaxed">
                      {dispute.reason}
                    </p>
                    {dispute.resolutionNote && (
                      <p className="text-[12px] text-[var(--color-ink-muted)] bg-[var(--color-canvas)] border border-[var(--color-border)] rounded px-2.5 py-1.5">
                        Note : {dispute.resolutionNote}
                      </p>
                    )}
                    <p className="text-[12px] text-[var(--color-ink-muted)] tabular-amount">
                      Ouvert le {formatDate(dispute.openedAt)}
                      {dispute.openedBy ? ` par ${dispute.openedBy}` : ''}
                      {dispute.resolvedAt ? ` · Clôturé le ${formatDate(dispute.resolvedAt)}` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Promesses de paiement */}
        <section className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
                Promesses de paiement ({promises.length})
              </h3>
              <p className="text-[12px] text-[var(--color-ink-muted)]">
                Ne réduit jamais le solde tant que le paiement n’est pas confirmé.
              </p>
            </div>
            {canActOnReceivable && (
              <Button
                variant="secondary"
                size="sm"
                icon={<CalendarClock className="w-3.5 h-3.5" />}
                onClick={() => {
                  setEditingPromise(null);
                  setPromiseDrawerOpen(true);
                }}
              >
                Enregistrer une promesse
              </Button>
            )}
          </div>

          {promises.length === 0 ? (
            <div className="p-5 text-[13px] text-[var(--color-ink-muted)]">
              Aucune promesse de paiement enregistrée sur cette facture.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {promises.map((promise) => {
                const meta = PROMISE_STATUS_META[promise.status] ?? {
                  label: promise.status,
                  tone: 'neutral' as SemanticTone,
                };
                return (
                  <div key={promise.id} className="p-4 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone={meta.tone} label={meta.label} />
                          {promise.isOverdue && (
                            <StatusBadge tone="overdue" label="Échéance dépassée" />
                          )}
                        </div>
                        <p className="text-[13px] text-[var(--color-ink-secondary)]">
                          Date prévue :{' '}
                          <span className="tabular-amount font-semibold text-[var(--color-ink)]">
                            {formatDate(promise.promisedDate)}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-display text-[15px] font-bold tabular-amount text-[var(--color-ink)]">
                          {formatCurrency(promise.promisedAmount, invoice.currency)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingPromise(promise);
                            setPromiseDrawerOpen(true);
                          }}
                        >
                          Évaluer
                        </Button>
                      </div>
                    </div>

                    {promise.note && (
                      <p className="text-[12px] text-[var(--color-ink-secondary)]">{promise.note}</p>
                    )}
                    <p className="text-[12px] text-[var(--color-ink-muted)] tabular-amount">
                      Enregistrée le {formatDate(promise.createdAt)}
                      {promise.recordedBy ? ` par ${promise.recordedBy}` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Paiements confirmés affectés & Paiements déclarés en attente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--color-border)]">
            <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
              Paiements confirmés affectés ({allocations.length})
            </h3>
            <p className="text-[12px] text-[var(--color-ink-muted)]">
              Seuls ces règlements viennent en déduction du solde restant dû.
            </p>
          </div>
          {allocations.length === 0 ? (
            <div className="p-5 text-[13px] text-[var(--color-ink-muted)]">
              Aucun paiement confirmé affecté à cette facture.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {allocations.map((alloc) => (
                <div key={alloc.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[13px] font-semibold text-[var(--color-ink)]">
                        {alloc.paymentReference}
                      </span>
                      <StatusBadge
                        status={alloc.paymentStatus === 'RECORDED' ? 'recorded' : 'confirmed'}
                      />
                    </div>
                    <p className="text-[12px] text-[var(--color-ink-muted)] tabular-amount">
                      {alloc.paymentMethod || 'Mode non précisé'} · Confirmé le{' '}
                      {formatDate(alloc.confirmedAt || alloc.declaredAt)}
                    </p>
                  </div>
                  <span className="font-display text-[15px] font-bold tabular-amount text-[var(--color-success)] shrink-0">
                    -{formatCurrency(alloc.allocatedAmount, invoice.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--color-border)]">
            <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
              Paiements déclarés en attente ({declaredPayments.length})
            </h3>
            <p className="text-[12px] text-[var(--color-ink-muted)]">
              Non déduits du solde restant dû tant que le contrôle bancaire n’est pas validé.
            </p>
          </div>
          {declaredPayments.length === 0 ? (
            <div className="p-5 text-[13px] text-[var(--color-ink-muted)]">
              Aucun paiement déclaré en attente de vérification sur cette facture.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {declaredPayments.map((pay) => {
                const meta = DECLARED_PAYMENT_META[pay.status] ?? {
                  label: pay.status,
                  tone: 'warning' as SemanticTone,
                };
                return (
                  <div key={pay.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[13px] font-semibold text-[var(--color-ink)]">
                          {pay.reference}
                        </span>
                        <StatusBadge tone={meta.tone} label={meta.label} />
                      </div>
                      <p className="text-[12px] text-[var(--color-ink-muted)] tabular-amount">
                        {pay.paymentMethod || 'Justificatif client'} · Déclaré le{' '}
                        {formatDate(pay.declaredAt)}
                      </p>
                    </div>
                    <span className="font-display text-[15px] font-semibold tabular-amount text-[var(--color-warning)] shrink-0">
                      {formatCurrency(pay.amount, invoice.currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Avoirs / Régularisations & Documents justificatifs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
                Avoirs et régularisations ({creditNotes.length})
              </h3>
              <p className="text-[12px] text-[var(--color-ink-muted)]">
                Seuls les avoirs validés diminuent le solde restant dû.
              </p>
            </div>
            {canActOnReceivable && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => setCreditDrawerOpen(true)}
              >
                Enregistrer un avoir
              </Button>
            )}
          </div>

          {creditNotes.length === 0 ? (
            <div className="p-5 text-[13px] text-[var(--color-ink-muted)]">
              Aucun avoir enregistré sur cette facture.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {creditNotes.map((cn) => {
                const meta = CREDIT_STATUS_META[cn.status] ?? {
                  label: cn.status,
                  tone: 'neutral' as SemanticTone,
                };
                return (
                  <div key={cn.id} className="p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[13px] font-semibold text-[var(--color-ink)]">
                          {cn.reference}
                        </span>
                        <StatusBadge tone={meta.tone} label={meta.label} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-[15px] font-bold tabular-amount text-[var(--color-ink)]">
                          {formatCurrency(cn.amount, invoice.currency)}
                        </span>
                        {cn.status === 'DRAFT' && !invoice.isArchived && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                            loading={validatingCreditId === cn.id}
                            onClick={() => handleValidateCredit(cn.id)}
                          >
                            Valider
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-[13px] text-[var(--color-ink-secondary)]">{cn.reason}</p>
                    <p className="text-[12px] text-[var(--color-ink-muted)] tabular-amount">
                      Créé le {formatDate(cn.createdAt)}
                      {cn.validatedAt ? ` · Validé le ${formatDate(cn.validatedAt)}` : ''}
                      {cn.validatedBy ? ` par ${cn.validatedBy}` : ''}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Documents et justificatifs */}
        <section className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
                Documents et justificatifs ({documents.length})
              </h3>
              <p className="text-[12px] text-[var(--color-ink-muted)]">
                Facture originale, avoirs, justificatifs et pièces de litige.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<FilePlus2 className="w-3.5 h-3.5" />}
              onClick={() => setDocDrawerOpen(true)}
            >
              Joindre un document
            </Button>
          </div>

          {documents.length === 0 ? (
            <div className="p-5 text-[13px] text-[var(--color-ink-muted)]">
              Aucun document joint à cette facture pour le moment.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {documents.map((doc) => (
                <div key={doc.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText
                      className="w-4 h-4 text-[var(--color-ink-muted)] mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-[13px] font-medium text-[var(--color-ink)] truncate">
                        {doc.title}
                      </p>
                      <p className="text-[12px] text-[var(--color-ink-muted)] truncate">
                        {getDocTypeLabel(doc.docType)} · {doc.fileName} ·{' '}
                        {formatFileSize(doc.fileSize)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Download className="w-3.5 h-3.5" />}
                    loading={downloadingDocId === doc.id}
                    onClick={() => handleDownload(doc.id, doc.fileName)}
                  >
                    Télécharger
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Historique des relances */}
      <section className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--color-border)]">
          <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
            Historique des relances ({reminders.length})
          </h3>
        </div>
        {reminders.length === 0 ? (
          <div className="p-5 text-[13px] text-[var(--color-ink-muted)]">
            Aucune relance enregistrée pour cette facture.
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {reminders.map((rem) => {
              const meta = REMINDER_STATUS_META[rem.status] ?? {
                label: rem.status,
                tone: 'neutral' as SemanticTone,
              };
              return (
                <div key={rem.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={meta.tone} label={meta.label} />
                      <span className="text-[12px] text-[var(--color-ink-muted)]">
                        Canal :{' '}
                        {rem.channel === 'WHATSAPP'
                          ? 'WhatsApp'
                          : rem.channel === 'PHONE'
                          ? 'Téléphone'
                          : 'E-mail'}
                      </span>
                    </div>
                    <p className="text-[13px] text-[var(--color-ink)] truncate">
                      {rem.subject || 'Relance de règlement'}
                    </p>
                  </div>
                  <span className="tabular-amount text-[12px] text-[var(--color-ink-muted)] shrink-0 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    {formatDate(rem.scheduledFor)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Historique de traçabilité */}
      <section className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--color-border)]">
          <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
            Historique de traçabilité
          </h3>
        </div>
        {history.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Aucun événement enregistré"
              description="Les opérations effectuées sur cette facture apparaîtront ici de façon chronologique."
            />
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="font-semibold text-[var(--color-ink)]">
                      {INVOICE_HISTORY_LABELS[entry.eventType] ?? entry.eventType}
                    </span>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-[var(--color-ink-muted)]">{entry.actorLabel}</span>
                  </div>
                  <p className="text-[13px] text-[var(--color-ink-secondary)]">{entry.summary}</p>
                </div>
                <span className="tabular-amount text-[12px] text-[var(--color-ink-muted)] whitespace-nowrap shrink-0">
                  {formatDateTime(entry.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tiroirs d'action métier */}
      <MetadataEditDrawer
        open={metadataDrawerOpen}
        invoice={invoice}
        onClose={() => setMetadataDrawerOpen(false)}
        onSubmit={onUpdateMetadata}
      />

      <DisputeFormDrawer
        open={disputeDrawerOpen}
        invoice={invoice}
        editingDispute={editingDispute}
        onClose={() => {
          setDisputeDrawerOpen(false);
          setEditingDispute(null);
        }}
        onCreate={onCreateDispute}
        onUpdate={onUpdateDispute}
      />

      <PromiseFormDrawer
        open={promiseDrawerOpen}
        invoice={invoice}
        editingPromise={editingPromise}
        onClose={() => {
          setPromiseDrawerOpen(false);
          setEditingPromise(null);
        }}
        onCreate={onCreatePromise}
        onUpdate={onUpdatePromise}
      />

      <CreditNoteFormDrawer
        open={creditDrawerOpen}
        invoice={invoice}
        onClose={() => setCreditDrawerOpen(false)}
        onSubmit={onCreateCreditNote}
      />

      <DocumentUploadDrawer
        open={docDrawerOpen}
        invoice={invoice}
        onClose={() => setDocDrawerOpen(false)}
        onUpload={onUploadDocument}
      />

      <ConfirmModal
        open={confirmArchiveOpen}
        tone="destructive"
        title={`Archiver la facture ${invoice.reference} ?`}
        description="La facture ne figurera plus dans les listes actives ni dans les créances ouvertes, tout en conservant intégralement ses paiements, avoirs, pièces jointes et son historique."
        confirmLabel="Archiver la facture"
        loading={actionLoading}
        onClose={() => setConfirmArchiveOpen(false)}
        onConfirm={handleConfirmArchive}
      />
    </div>
  );
};
