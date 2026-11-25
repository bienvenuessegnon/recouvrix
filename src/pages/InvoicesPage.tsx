import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Receipt,
  RotateCcw,
  Search,
} from 'lucide-react';
import {
  AlertBanner,
  Button,
  DataTable,
  DataTableColumn,
  Input,
  Select,
  StatusBadge,
  SummaryCard,
  useToast,
} from '../components/ui';
import {
  formatCurrency,
  formatDate,
  formatNumber,
} from '../design-system/formatters';
import { NavigationSectionId } from '../design-system/tokens';
import { ApiError, documentsApi, invoicesApi } from '../services/api';
import type {
  CreditNoteCreatePayload,
  DisputeCreatePayload,
  DisputeUpdatePayload,
  InvoiceDetail,
  InvoiceDocumentType,
  InvoiceListItem,
  InvoiceListResponse,
  InvoiceSortField,
  InvoiceStatusFilterValue,
  PromiseCreatePayload,
  PromiseUpdatePayload,
} from '../types/invoices';
import { INVOICE_STATUS_KEY_MAP, InvoiceDetailPage } from './InvoiceDetailPage';

export interface InvoicesPageProps {
  initialFilter?: string;
  onOpenClient: (clientId: string) => void;
  onNavigate?: (section: NavigationSectionId, filter?: string) => void;
}

function parseInitialFilter(initialFilter?: string): {
  status: InvoiceStatusFilterValue;
  directInvoiceId: string | null;
} {
  if (!initialFilter) {
    return { status: 'ALL', directInvoiceId: null };
  }
  const trimmed = initialFilter.trim();
  if (trimmed.toLowerCase().startsWith('facture:')) {
    const id = trimmed.slice('facture:'.length).trim();
    return { status: 'ALL', directInvoiceId: id || null };
  }
  const normalized = trimmed.toLowerCase();
  if (normalized === 'ouvertes' || normalized === 'open') {
    return { status: 'OPEN', directInvoiceId: null };
  }
  if (normalized === 'non-echues' || normalized === 'not_due') {
    return { status: 'NOT_DUE', directInvoiceId: null };
  }
  if (normalized === 'en-retard' || normalized === 'overdue') {
    return { status: 'OVERDUE', directInvoiceId: null };
  }
  if (normalized === 'a-echoir' || normalized === 'upcoming') {
    return { status: 'UPCOMING', directInvoiceId: null };
  }
  if (normalized === 'partiel' || normalized === 'partial') {
    return { status: 'PARTIAL', directInvoiceId: null };
  }
  if (normalized === 'en-litige' || normalized === 'dispute') {
    return { status: 'DISPUTE', directInvoiceId: null };
  }
  if (normalized === 'promesse' || normalized === 'promise') {
    return { status: 'PROMISE', directInvoiceId: null };
  }
  if (normalized === 'soldees' || normalized === 'soldee' || normalized === 'paid') {
    return { status: 'PAID', directInvoiceId: null };
  }
  if (normalized === 'archives' || normalized === 'archived') {
    return { status: 'ARCHIVED', directInvoiceId: null };
  }
  return { status: 'ALL', directInvoiceId: null };
}

export const InvoicesPage: React.FC<InvoicesPageProps> = ({
  initialFilter,
  onOpenClient,
  onNavigate,
}) => {
  const { notify } = useToast();
  const initialParsed = parseInitialFilter(initialFilter);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilterValue>(
    initialParsed.status
  );
  const [dateField, setDateField] = useState<'due_date' | 'issue_date'>('due_date');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<InvoiceSortField>('due_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [listData, setListData] = useState<InvoiceListResponse | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    initialParsed.directInvoiceId
  );
  const [detailData, setDetailData] = useState<InvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailActionLoading, setDetailActionLoading] = useState(false);

  const loadInvoiceDetail = useCallback(async (invoiceId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await invoicesApi.getById(invoiceId);
      setDetailData(detail);
    } catch (err) {
      setDetailError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger le dossier de cette facture.'
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const parsed = parseInitialFilter(initialFilter);
    setStatusFilter(parsed.status);
    setPage(1);
    if (parsed.directInvoiceId) {
      setSelectedInvoiceId(parsed.directInvoiceId);
      setDetailData(null);
      void loadInvoiceDetail(parsed.directInvoiceId);
    }
  }, [initialFilter, loadInvoiceDetail]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadInvoices = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await invoicesApi.list({
        search: debouncedSearch,
        status: statusFilter,
        dateFrom,
        dateTo,
        dateField,
        sortBy,
        sortDir,
        page,
        pageSize,
      });
      setListData(res);
    } catch (err) {
      setListError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger la liste des factures.'
      );
    } finally {
      setListLoading(false);
    }
  }, [debouncedSearch, statusFilter, dateFrom, dateTo, dateField, sortBy, sortDir, page]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  const handleOpenDetail = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setDetailData(null);
    void loadInvoiceDetail(invoiceId);
  };

  const handleUpdateMetadata = async (description: string | null) => {
    if (!detailData) return;
    const updated = await invoicesApi.updateMetadata(detailData.id, description);
    setDetailData(updated);
    notify({
      tone: 'success',
      title: 'Objet mis à jour',
      description: `La description de ${updated.reference} a été enregistrée.`,
    });
    await loadInvoices();
  };

  const handleArchiveInvoice = async () => {
    if (!detailData) return;
    setDetailActionLoading(true);
    try {
      const archived = await invoicesApi.archive(detailData.id);
      setDetailData(archived);
      notify({
        tone: 'info',
        title: 'Facture archivée',
        description: `${archived.reference} a été archivée avec conservation de son historique.`,
      });
      await loadInvoices();
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Archivage impossible',
        description:
          err instanceof ApiError ? err.message : 'Impossible d’archiver cette facture.',
      });
    } finally {
      setDetailActionLoading(false);
    }
  };

  const handleRestoreInvoice = async () => {
    if (!detailData) return;
    setDetailActionLoading(true);
    try {
      const restored = await invoicesApi.restore(detailData.id);
      setDetailData(restored);
      notify({
        tone: 'success',
        title: 'Facture restaurée',
        description: `${restored.reference} est de nouveau suivie dans les dossiers actifs.`,
      });
      await loadInvoices();
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Restauration impossible',
        description:
          err instanceof ApiError ? err.message : 'Impossible de restaurer cette facture.',
      });
    } finally {
      setDetailActionLoading(false);
    }
  };

  const handleCreateDispute = async (payload: DisputeCreatePayload) => {
    if (!detailData) return;
    const updated = await invoicesApi.openDispute(detailData.id, payload);
    setDetailData(updated);
    notify({
      tone: 'warning',
      title: 'Litige déclaré',
      description: `Les relances automatiques sur ${updated.reference} sont suspendues.`,
    });
    await loadInvoices();
  };

  const handleUpdateDispute = async (disputeId: string, payload: DisputeUpdatePayload) => {
    if (!detailData) return;
    const updated = await invoicesApi.updateDispute(detailData.id, disputeId, payload);
    setDetailData(updated);
    notify({
      tone: 'success',
      title: 'Litige mis à jour',
      description: `Le suivi du litige sur ${updated.reference} a été enregistré.`,
    });
    await loadInvoices();
  };

  const handleCreatePromise = async (payload: PromiseCreatePayload) => {
    if (!detailData) return;
    const updated = await invoicesApi.recordPromise(detailData.id, payload);
    setDetailData(updated);
    notify({
      tone: 'success',
      title: 'Promesse enregistrée',
      description: `L’engagement de règlement sur ${updated.reference} a été consigné.`,
    });
    await loadInvoices();
  };

  const handleUpdatePromise = async (promiseId: string, payload: PromiseUpdatePayload) => {
    if (!detailData) return;
    const updated = await invoicesApi.updatePromise(detailData.id, promiseId, payload);
    setDetailData(updated);
    notify({
      tone: 'success',
      title: 'Promesse évaluée',
      description: `Le statut de la promesse sur ${updated.reference} a été mis à jour.`,
    });
    await loadInvoices();
  };

  const handleCreateCreditNote = async (payload: CreditNoteCreatePayload) => {
    if (!detailData) return;
    const updated = await invoicesApi.createCreditNote(detailData.id, payload);
    setDetailData(updated);
    notify({
      tone: 'success',
      title: payload.validateNow ? 'Avoir validé' : 'Avoir enregistré en brouillon',
      description: `L’avoir sur ${updated.reference} a bien été pris en compte.`,
    });
    await loadInvoices();
  };

  const handleValidateCreditNote = async (creditId: string) => {
    if (!detailData) return;
    try {
      const updated = await invoicesApi.validateCreditNote(detailData.id, creditId);
      setDetailData(updated);
      notify({
        tone: 'success',
        title: 'Avoir validé',
        description: `Le solde restant dû de ${updated.reference} a été recalculé.`,
      });
      await loadInvoices();
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Validation impossible',
        description:
          err instanceof ApiError ? err.message : 'Impossible de valider cet avoir.',
      });
    }
  };

  const handleUploadDocument = async (params: {
    docType: InvoiceDocumentType;
    title?: string;
    file: File;
  }) => {
    if (!detailData) return;
    const updated = await invoicesApi.uploadDocument(detailData.id, params);
    setDetailData(updated);
    notify({
      tone: 'success',
      title: 'Document joint',
      description: `La pièce « ${params.file.name} » a été attachée à ${updated.reference}.`,
    });
  };

  const handleDownloadDocument = async (documentId: string, fileName: string) => {
    try {
      await documentsApi.download(documentId, fileName);
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Téléchargement impossible',
        description:
          err instanceof ApiError ? err.message : 'Impossible de récupérer ce document.',
      });
    }
  };

  if (selectedInvoiceId) {
    return (
      <InvoiceDetailPage
        invoice={detailData}
        loading={detailLoading}
        error={detailError}
        actionLoading={detailActionLoading}
        onBack={() => {
          setSelectedInvoiceId(null);
          setDetailData(null);
          setDetailError(null);
        }}
        onRetry={() => loadInvoiceDetail(selectedInvoiceId)}
        onOpenClient={onOpenClient}
        onUpdateMetadata={handleUpdateMetadata}
        onArchive={handleArchiveInvoice}
        onRestore={handleRestoreInvoice}
        onCreateDispute={handleCreateDispute}
        onUpdateDispute={handleUpdateDispute}
        onCreatePromise={handleCreatePromise}
        onUpdatePromise={handleUpdatePromise}
        onCreateCreditNote={handleCreateCreditNote}
        onValidateCreditNote={handleValidateCreditNote}
        onUploadDocument={handleUploadDocument}
        onDownloadDocument={handleDownloadDocument}
      />
    );
  }

  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    statusFilter !== 'ALL' ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  const resetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setStatusFilter('ALL');
    setDateField('due_date');
    setDateFrom('');
    setDateTo('');
    setSortBy('due_date');
    setSortDir('asc');
    setPage(1);
  };

  const summary = listData?.summary;
  const portfolioCompletelyEmpty =
    summary !== undefined && summary.totalCount === 0 && summary.archivedCount === 0;

  const quickFilters: Array<{
    id: InvoiceStatusFilterValue;
    label: string;
    count?: number;
  }> = [
    { id: 'ALL', label: 'Toutes', count: summary?.totalCount },
    { id: 'OPEN', label: 'Ouvertes', count: summary?.openCount },
    { id: 'OVERDUE', label: 'En retard', count: summary?.overdueCount },
    { id: 'UPCOMING', label: 'À échoir', count: summary?.upcomingCount },
    { id: 'PARTIAL', label: 'Partiellement payées', count: summary?.partialCount },
    { id: 'DISPUTE', label: 'En litige', count: summary?.disputeCount },
    { id: 'PROMISE', label: 'Promesse en cours', count: summary?.promiseCount },
    { id: 'PAID', label: 'Soldées', count: summary?.paidCount },
    { id: 'ARCHIVED', label: 'Archivées', count: summary?.archivedCount },
  ];

  const columns: Array<DataTableColumn<InvoiceListItem>> = [
    {
      key: 'reference',
      header: 'Référence',
      render: (row) => (
        <div className="space-y-0.5 min-w-0">
          <span className="font-mono text-[13px] font-semibold text-[var(--color-ink)] block">
            {row.reference}
          </span>
          {row.description && (
            <span className="text-[11px] text-[var(--color-ink-muted)] truncate block max-w-[200px]">
              {row.description}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'clientName',
      header: 'Client',
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenClient(row.clientId);
          }}
          className="text-left font-medium text-[var(--color-primary)] hover:underline truncate max-w-[220px] block"
        >
          {row.clientName}
        </button>
      ),
    },
    {
      key: 'issueDate',
      header: 'Date d’émission',
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular-amount text-[13px] text-[var(--color-ink-secondary)] whitespace-nowrap">
          {formatDate(row.issueDate)}
        </span>
      ),
    },
    {
      key: 'dueDate',
      header: 'Date d’échéance',
      render: (row) => (
        <div className="space-y-0.5">
          <span className="tabular-amount text-[13px] text-[var(--color-ink)] whitespace-nowrap block">
            {formatDate(row.dueDate)}
          </span>
          {row.activePromiseDate && (
            <span
              className={`text-[11px] block whitespace-nowrap ${
                row.isPromiseOverdue
                  ? 'text-[var(--color-danger)] font-medium'
                  : 'text-[var(--color-warning)]'
              }`}
            >
              Promesse : {formatDate(row.activePromiseDate)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Montant initial',
      align: 'right',
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular-amount whitespace-nowrap">
          {formatCurrency(row.totalAmount, row.currency)}
        </span>
      ),
    },
    {
      key: 'confirmedPaidAmount',
      header: 'Montant réglé',
      align: 'right',
      hideOnMobile: true,
      render: (row) => (
        <div className="space-y-0.5">
          <span className="tabular-amount text-[var(--color-success)] whitespace-nowrap block">
            {formatCurrency(row.confirmedPaidAmount, row.currency)}
          </span>
          {row.validatedCreditNotesAmount > 0 && (
            <span className="text-[11px] text-[var(--color-primary)] whitespace-nowrap block">
              + {formatCurrency(row.validatedCreditNotesAmount, row.currency)} avoir
            </span>
          )}
          {row.pendingVerificationAmount > 0 && (
            <span className="text-[11px] text-[var(--color-warning)] whitespace-nowrap block">
              {formatCurrency(row.pendingVerificationAmount, row.currency)} à vérifier
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'remainingAmount',
      header: 'Solde restant dû',
      align: 'right',
      render: (row) => (
        <span className="tabular-amount font-semibold text-[var(--color-ink)] whitespace-nowrap">
          {formatCurrency(row.remainingAmount, row.currency)}
        </span>
      ),
    },
    {
      key: 'delayDays',
      header: 'Retard',
      align: 'right',
      render: (row) =>
        row.delayDays > 0 ? (
          <span className="tabular-amount font-semibold text-[var(--color-overdue)] whitespace-nowrap">
            {formatNumber(row.delayDays)} j
          </span>
        ) : (
          <span className="text-[var(--color-ink-muted)]">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (row) => <StatusBadge status={INVOICE_STATUS_KEY_MAP[row.status]} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Bandeau de synthèse des créances */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Créances ouvertes"
          value={summary ? formatCurrency(summary.totalOpenAmount) : '—'}
          helper={
            summary ? `${summary.openCount} facture(s) non soldée(s)` : 'Portefeuille actif'
          }
        />
        <SummaryCard
          label="Montant en retard"
          value={summary ? formatCurrency(summary.totalOverdueAmount) : '—'}
          tone={summary && summary.totalOverdueAmount > 0 ? 'overdue' : 'default'}
          helper={
            summary
              ? `${summary.overdueCount} facture(s) échue(s)`
              : 'Échéances dépassées'
          }
        />
        <SummaryCard
          label="Paiements en attente"
          value={summary ? formatCurrency(summary.pendingVerificationAmount) : '—'}
          tone={summary && summary.pendingVerificationAmount > 0 ? 'warning' : 'default'}
          helper="Non déduits des soldes"
        />
        <SummaryCard
          label="Dossiers suivis"
          value={summary ? String(summary.totalCount) : '—'}
          helper={
            summary
              ? `${summary.disputeCount} litige(s) · ${summary.promiseCount} promesse(s)`
              : 'Factures importées'
          }
        />
      </div>

      {/* Recherche, filtres rapides, dates et tri */}
      <section className="bg-white border border-[var(--color-border)] rounded-lg p-4 space-y-4">
        {/* Filtres rapides par statut */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="tablist"
          aria-label="Filtres rapides par statut"
        >
          {quickFilters.map((qf) => {
            const active = statusFilter === qf.id;
            return (
              <button
                key={qf.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setStatusFilter(qf.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors border ${
                  active
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                    : 'bg-white text-[var(--color-ink-secondary)] border-[var(--color-border)] hover:bg-slate-50 hover:text-[var(--color-ink)]'
                }`}
              >
                <span>{qf.label}</span>
                {qf.count !== undefined && (
                  <span
                    className={`ml-1.5 tabular-amount text-[12px] ${
                      active ? 'text-blue-100' : 'text-[var(--color-ink-muted)]'
                    }`}
                  >
                    ({qf.count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Barre de recherche et tri */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3 pt-3 border-t border-[var(--color-border)] items-end">
          <div className="xl:col-span-4">
            <Input
              label="Rechercher une créance"
              placeholder="Référence, nom du client ou objet…"
              leftIcon={<Search className="w-4 h-4" />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="xl:col-span-2">
            <Select
              label="Date filtrée"
              value={dateField}
              onChange={(e) => {
                setDateField(e.target.value as 'due_date' | 'issue_date');
                setPage(1);
              }}
              options={[
                { value: 'due_date', label: 'Échéance' },
                { value: 'issue_date', label: 'Émission' },
              ]}
            />
          </div>

          <div className="xl:col-span-2">
            <Input
              label="Du"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="xl:col-span-2">
            <Input
              label="Au"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="xl:col-span-2 flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <Select
                label="Trier par"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as InvoiceSortField);
                  setPage(1);
                }}
                options={[
                  { value: 'due_date', label: 'Échéance' },
                  { value: 'remaining_amount', label: 'Solde dû' },
                  { value: 'delay_days', label: 'Retard (jours)' },
                  { value: 'total_amount', label: 'Montant initial' },
                  { value: 'issue_date', label: 'Émission' },
                  { value: 'reference', label: 'Référence' },
                ]}
              />
            </div>
            <Button
              variant="secondary"
              size="md"
              aria-label={
                sortDir === 'asc'
                  ? 'Ordre croissant, cliquer pour inverser'
                  : 'Ordre décroissant, cliquer pour inverser'
              }
              title={sortDir === 'asc' ? 'Ordre croissant' : 'Ordre décroissant'}
              icon={<ArrowDownUp className="w-4 h-4" />}
              onClick={() => {
                setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                setPage(1);
              }}
            >
              {sortDir === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[12px] text-[var(--color-ink-muted)]">
          <span>
            Règle financière : seuls les paiements confirmés et les avoirs validés réduisent le
            solde restant dû.
          </span>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={resetFilters}
            >
              Réinitialiser les filtres
            </Button>
          )}
        </div>
      </section>

      {listError && (
        <AlertBanner
          tone="error"
          title="Erreur de chargement"
          description={listError}
          action={
            <Button variant="secondary" size="sm" onClick={loadInvoices}>
              Réessayer
            </Button>
          }
        />
      )}

      {/* Tableau des factures */}
      <DataTable
        columns={columns}
        data={listData?.items ?? []}
        rowKey={(row) => row.id}
        onRowClick={(row) => handleOpenDetail(row.id)}
        loading={listLoading}
        skeletonRows={6}
        caption="Liste des factures et créances suivies dans Recouvrix"
        emptyState={
          portfolioCompletelyEmpty
            ? {
                icon: <Receipt className="w-5 h-5" aria-hidden="true" />,
                title: 'Aucune facture importée pour le moment',
                description:
                  'Recouvrix assure le suivi de vos factures existantes sans créer de factures commerciales. Importez un relevé pour démarrer le recouvrement.',
                action: onNavigate ? (
                  <Button
                    variant="primary"
                    icon={<FileSpreadsheet className="w-4 h-4" />}
                    onClick={() => onNavigate('imports')}
                  >
                    Accéder à l’importation
                  </Button>
                ) : undefined,
              }
            : {
                icon: <Search className="w-5 h-5" aria-hidden="true" />,
                title: 'Aucune facture ne correspond à ces critères',
                description:
                  'Modifiez vos filtres de statut, votre recherche ou la période sélectionnée.',
                action: hasActiveFilters ? (
                  <Button variant="secondary" onClick={resetFilters}>
                    Réinitialiser les filtres
                  </Button>
                ) : undefined,
              }
        }
      />

      {/* Pagination */}
      {listData && listData.total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 text-[13px] text-[var(--color-ink-muted)]">
          <span>
            <span className="tabular-amount font-medium text-[var(--color-ink)]">
              {listData.total}
            </span>{' '}
            facture(s) · Page{' '}
            <span className="tabular-amount font-medium text-[var(--color-ink)]">
              {listData.page}
            </span>{' '}
            sur{' '}
            <span className="tabular-amount font-medium text-[var(--color-ink)]">
              {listData.totalPages}
            </span>
          </span>

          {listData.totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<ChevronLeft className="w-4 h-4" />}
                disabled={listData.page <= 1 || listLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Précédent
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<ChevronRight className="w-4 h-4" />}
                disabled={listData.page >= listData.totalPages || listLoading}
                onClick={() => setPage((p) => Math.min(listData.totalPages, p + 1))}
              >
                Suivant
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
