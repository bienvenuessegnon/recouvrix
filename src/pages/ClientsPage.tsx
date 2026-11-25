import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import { ClientFormDrawer } from '../components/clients/ClientFormDrawer';
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
import { formatCurrency } from '../design-system/formatters';
import { ApiError, clientsApi } from '../services/api';
import type {
  ClientCreatePayload,
  ClientDetail,
  ClientGlobalStatus,
  ClientListItem,
  ClientListResponse,
  ClientType,
  ClientUpdatePayload,
  PreferredChannel,
} from '../types/clients';
import { CLIENT_STATUS_META, ClientDetailPage } from './ClientDetailPage';

export interface ClientsPageProps {
  initialFilter?: string;
  onOpenInvoice?: (invoiceId: string) => void;
}

type StatusFilterValue = 'ALL' | ClientGlobalStatus;
type TypeFilterValue = 'ALL' | ClientType;
type ChannelFilterValue = 'ALL' | PreferredChannel;
type SortOptionValue =
  | 'remaining_desc'
  | 'name_asc'
  | 'invoices_desc'
  | 'created_desc';

function parseClientsInitialFilter(initialFilter?: string): {
  status: StatusFilterValue;
  directClientId: string | null;
} {
  if (!initialFilter) return { status: 'ALL', directClientId: null };
  const trimmed = initialFilter.trim();
  if (trimmed.toLowerCase().startsWith('client:')) {
    const id = trimmed.slice('client:'.length).trim();
    return { status: 'ALL', directClientId: id || null };
  }
  const normalized = trimmed.toLowerCase();
  if (normalized === 'en-retard' || normalized === 'overdue') {
    return { status: 'OVERDUE', directClientId: null };
  }
  if (normalized === 'en-litige' || normalized === 'dispute') {
    return { status: 'DISPUTE', directClientId: null };
  }
  if (normalized === 'promesse' || normalized === 'promise') {
    return { status: 'PROMISE', directClientId: null };
  }
  if (normalized === 'a-jour' || normalized === 'up_to_date') {
    return { status: 'UP_TO_DATE', directClientId: null };
  }
  if (normalized === 'solde' || normalized === 'settled') {
    return { status: 'SETTLED', directClientId: null };
  }
  if (normalized === 'archives' || normalized === 'archived') {
    return { status: 'ARCHIVED', directClientId: null };
  }
  return { status: 'ALL', directClientId: null };
}

export const ClientsPage: React.FC<ClientsPageProps> = ({
  initialFilter,
  onOpenInvoice,
}) => {
  const { notify } = useToast();

  const initialParsed = parseClientsInitialFilter(initialFilter);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(initialParsed.status);
  const [typeFilter, setTypeFilter] = useState<TypeFilterValue>('ALL');
  const [channelFilter, setChannelFilter] = useState<ChannelFilterValue>('ALL');
  const [sortOption, setSortOption] = useState<SortOptionValue>('remaining_desc');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [listData, setListData] = useState<ClientListResponse | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    initialParsed.directClientId
  );
  const [detailData, setDetailData] = useState<ClientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailActionLoading, setDetailActionLoading] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');

  const loadClientDetail = useCallback(async (clientId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await clientsApi.getById(clientId);
      setDetailData(detail);
    } catch (err) {
      setDetailError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger cette fiche client.'
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const parsed = parseClientsInitialFilter(initialFilter);
    setStatusFilter(parsed.status);
    setPage(1);
    if (parsed.directClientId) {
      setSelectedClientId(parsed.directClientId);
      setDetailData(null);
      void loadClientDetail(parsed.directClientId);
    }
  }, [initialFilter, loadClientDetail]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const sortParams = useMemo(() => {
    switch (sortOption) {
      case 'name_asc':
        return { sortBy: 'name' as const, sortDir: 'asc' as const };
      case 'invoices_desc':
        return { sortBy: 'invoices_count' as const, sortDir: 'desc' as const };
      case 'created_desc':
        return { sortBy: 'created_at' as const, sortDir: 'desc' as const };
      case 'remaining_desc':
      default:
        return { sortBy: 'remaining_amount' as const, sortDir: 'desc' as const };
    }
  }, [sortOption]);

  const loadClients = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await clientsApi.list({
        search: debouncedSearch,
        status: statusFilter,
        clientType: typeFilter,
        channel: channelFilter,
        includeArchived: statusFilter === 'ARCHIVED',
        sortBy: sortParams.sortBy,
        sortDir: sortParams.sortDir,
        page,
        pageSize,
      });
      setListData(res);
    } catch (err) {
      setListError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger la liste des clients.'
      );
    } finally {
      setListLoading(false);
    }
  }, [
    debouncedSearch,
    statusFilter,
    typeFilter,
    channelFilter,
    sortParams,
    page,
  ]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const handleOpenDetail = (clientId: string) => {
    setSelectedClientId(clientId);
    setDetailData(null);
    void loadClientDetail(clientId);
  };

  const handleCreateClient = async (payload: ClientCreatePayload | ClientUpdatePayload) => {
    const created = await clientsApi.create(payload as ClientCreatePayload);
    setDrawerOpen(false);
    notify({
      tone: 'success',
      title: 'Client créé',
      description: `La fiche de ${created.name} a été enregistrée.`,
    });
    await loadClients();
    setSelectedClientId(created.id);
    setDetailData(created);
  };

  const handleUpdateClient = async (payload: ClientCreatePayload | ClientUpdatePayload) => {
    if (!detailData) return;
    const updated = await clientsApi.update(detailData.id, payload as ClientUpdatePayload);
    setDrawerOpen(false);
    setDetailData(updated);
    notify({
      tone: 'success',
      title: 'Fiche client mise à jour',
      description: `Les modifications sur ${updated.name} ont été enregistrées.`,
    });
    await loadClients();
  };

  const handleArchiveClient = async () => {
    if (!detailData) return;
    setDetailActionLoading(true);
    try {
      const archived = await clientsApi.archive(detailData.id);
      setDetailData(archived);
      notify({
        tone: 'info',
        title: 'Client archivé',
        description: `${archived.name} a été archivé avec conservation de tout son historique.`,
      });
      await loadClients();
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Archivage impossible',
        description:
          err instanceof ApiError
            ? err.message
            : 'Impossible d’archiver ce client pour le moment.',
      });
    } finally {
      setDetailActionLoading(false);
    }
  };

  const handleRestoreClient = async () => {
    if (!detailData) return;
    setDetailActionLoading(true);
    try {
      const restored = await clientsApi.restore(detailData.id);
      setDetailData(restored);
      notify({
        tone: 'success',
        title: 'Client restauré',
        description: `Le dossier ${restored.name} est de nouveau actif.`,
      });
      await loadClients();
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Restauration impossible',
        description:
          err instanceof ApiError
            ? err.message
            : 'Impossible de restaurer ce client pour le moment.',
      });
    } finally {
      setDetailActionLoading(false);
    }
  };

  const hasActiveFilters =
    Boolean(debouncedSearch) ||
    statusFilter !== 'ALL' ||
    typeFilter !== 'ALL' ||
    channelFilter !== 'ALL';

  const resetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setChannelFilter('ALL');
    setSortOption('remaining_desc');
    setPage(1);
  };

  const columns: Array<DataTableColumn<ClientListItem>> = [
    {
      key: 'name',
      header: 'Nom ou raison sociale',
      render: (row) => (
        <div className="space-y-0.5 min-w-0">
          <p className="font-semibold text-[var(--color-ink)] truncate">{row.name}</p>
          {row.taxId && (
            <p className="font-mono text-[11px] text-[var(--color-ink-muted)] truncate">
              {row.taxId}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'clientType',
      header: 'Type de client',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-[13px] text-[var(--color-ink-secondary)] whitespace-nowrap">
          {row.clientType === 'COMPANY' ? 'Entreprise' : 'Particulier'}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'Adresse e-mail',
      hideOnMobile: true,
      render: (row) => (
        <span className="text-[13px] text-[var(--color-ink-secondary)] break-all">
          {row.email || '—'}
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'Téléphone',
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular-amount text-[13px] text-[var(--color-ink-secondary)] whitespace-nowrap">
          {row.phone || '—'}
        </span>
      ),
    },
    {
      key: 'contactName',
      header: 'Personne de contact',
      render: (row) => (
        <span className="text-[13px] text-[var(--color-ink)]">
          {row.contactName || '—'}
        </span>
      ),
    },
    {
      key: 'invoicesCount',
      header: 'Factures associées',
      align: 'right',
      render: (row) => (
        <div className="space-y-0.5">
          <span className="tabular-amount font-medium text-[var(--color-ink)] block">
            {row.invoicesCount}
          </span>
          {row.overdueInvoicesCount > 0 && (
            <span className="text-[11px] text-[var(--color-overdue)] block">
              {row.overdueInvoicesCount} en retard
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'remainingAmount',
      header: 'Montant restant dû',
      align: 'right',
      render: (row) => (
        <div className="space-y-0.5">
          <span className="tabular-amount font-semibold text-[var(--color-ink)] block whitespace-nowrap">
            {formatCurrency(row.remainingAmount)}
          </span>
          {row.pendingVerificationAmount > 0 && (
            <span className="text-[11px] text-[var(--color-warning)] block whitespace-nowrap">
              {formatCurrency(row.pendingVerificationAmount)} à vérifier
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'globalStatus',
      header: 'Statut global du dossier',
      render: (row) => {
        const meta = CLIENT_STATUS_META[row.globalStatus];
        return <StatusBadge tone={meta.tone} label={meta.label} />;
      },
    },
  ];

  // Vue Fiche Client détaillée
  if (selectedClientId) {
    return (
      <>
        <ClientDetailPage
          client={detailData}
          loading={detailLoading}
          error={detailError}
          actionLoading={detailActionLoading}
          onBack={() => {
            setSelectedClientId(null);
            setDetailData(null);
            setDetailError(null);
          }}
          onRetry={() => loadClientDetail(selectedClientId)}
          onEdit={() => {
            setDrawerMode('edit');
            setDrawerOpen(true);
          }}
          onArchive={handleArchiveClient}
          onRestore={handleRestoreClient}
          onOpenInvoice={onOpenInvoice}
        />

        <ClientFormDrawer
          open={drawerOpen}
          mode={drawerMode}
          initialClient={drawerMode === 'edit' ? detailData : null}
          onClose={() => setDrawerOpen(false)}
          onSubmit={drawerMode === 'edit' ? handleUpdateClient : handleCreateClient}
        />
      </>
    );
  }

  const summary = listData?.summary;
  const portfolioCompletelyEmpty =
    summary !== undefined &&
    summary.activeClients === 0 &&
    summary.archivedClients === 0;

  return (
    <div className="space-y-6">
      {/* Bandeau synthétique du portefeuille clients */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Clients actifs"
          value={summary ? String(summary.activeClients) : '—'}
          helper={
            summary && summary.archivedClients > 0
              ? `${summary.archivedClients} dossier(s) archivé(s)`
              : 'Portefeuille suivi'
          }
        />
        <SummaryCard
          label="Clients en retard"
          value={summary ? String(summary.overdueClients) : '—'}
          tone={summary && summary.overdueClients > 0 ? 'overdue' : 'default'}
          helper="Échéances dépassées"
        />
        <SummaryCard
          label="Clients en litige"
          value={summary ? String(summary.disputeClients) : '—'}
          tone={summary && summary.disputeClients > 0 ? 'danger' : 'default'}
          helper="Relances suspendues"
        />
        <SummaryCard
          label="Encours total portefeuille"
          value={summary ? formatCurrency(summary.totalRemainingPortfolio) : '—'}
          helper="Solde restant dû sur dossiers actifs"
        />
      </div>

      {/* Barre d'actions, recherche et filtres */}
      <section className="bg-white border border-[var(--color-border)] rounded-lg p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex-1 max-w-xl">
            <Input
              aria-label="Rechercher un client"
              placeholder="Rechercher par nom, contact, e-mail, téléphone ou IFU…"
              leftIcon={<Search className="w-4 h-4" />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                icon={<RotateCcw className="w-4 h-4" />}
                onClick={resetFilters}
              >
                Réinitialiser
              </Button>
            )}
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setDrawerMode('create');
                setDrawerOpen(true);
              }}
            >
              Ajouter un client
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-[var(--color-border)]">
          <Select
            label="Statut du dossier"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilterValue);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Tous les dossiers actifs' },
              { value: 'OVERDUE', label: 'En retard' },
              { value: 'DISPUTE', label: 'En litige' },
              { value: 'PROMISE', label: 'Promesse en cours' },
              { value: 'UP_TO_DATE', label: 'À jour' },
              { value: 'SETTLED', label: 'Soldés' },
              { value: 'ARCHIVED', label: 'Dossiers archivés' },
            ]}
          />

          <Select
            label="Type de client"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as TypeFilterValue);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Tous les types' },
              { value: 'COMPANY', label: 'Entreprise / Société' },
              { value: 'INDIVIDUAL', label: 'Particulier / Indépendant' },
            ]}
          />

          <Select
            label="Canal privilégié"
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value as ChannelFilterValue);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'Tous les canaux' },
              { value: 'EMAIL', label: 'E-mail' },
              { value: 'WHATSAPP', label: 'WhatsApp' },
              { value: 'PHONE', label: 'Téléphone' },
            ]}
          />

          <Select
            label="Trier par"
            value={sortOption}
            onChange={(e) => {
              setSortOption(e.target.value as SortOptionValue);
              setPage(1);
            }}
            options={[
              { value: 'remaining_desc', label: 'Montant restant dû (décroissant)' },
              { value: 'name_asc', label: 'Nom / Raison sociale (A → Z)' },
              { value: 'invoices_desc', label: 'Nombre de factures' },
              { value: 'created_desc', label: 'Plus récemment ajoutés' },
            ]}
          />
        </div>
      </section>

      {listError && (
        <AlertBanner
          tone="error"
          title="Erreur de chargement"
          description={listError}
          action={
            <Button variant="secondary" size="sm" onClick={loadClients}>
              Réessayer
            </Button>
          }
        />
      )}

      {/* Tableau des clients */}
      <DataTable
        columns={columns}
        data={listData?.items ?? []}
        rowKey={(row) => row.id}
        onRowClick={(row) => handleOpenDetail(row.id)}
        loading={listLoading}
        skeletonRows={5}
        caption="Répertoire des clients suivis dans Recouvrix"
        emptyState={
          portfolioCompletelyEmpty
            ? {
                icon: <Users className="w-5 h-5" aria-hidden="true" />,
                title: 'Aucun client enregistré pour le moment',
                description:
                  'Créez votre premier dossier client pour centraliser ses coordonnées, ses préférences de relance et le suivi de ses créances.',
                action: (
                  <Button
                    variant="primary"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={() => {
                      setDrawerMode('create');
                      setDrawerOpen(true);
                    }}
                  >
                    Ajouter un client
                  </Button>
                ),
              }
            : {
                icon: <Search className="w-5 h-5" aria-hidden="true" />,
                title: 'Aucun client ne correspond à ces critères',
                description:
                  'Modifiez vos filtres ou votre recherche pour afficher les dossiers correspondants.',
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
            dossier(s) affiché(s) · Page{' '}
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

      <ClientFormDrawer
        open={drawerOpen}
        mode={drawerMode}
        initialClient={null}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleCreateClient}
      />
    </div>
  );
};
