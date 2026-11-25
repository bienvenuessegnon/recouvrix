import React, { useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Building2,
  CalendarClock,
  Edit3,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  ShieldAlert,
  User,
} from 'lucide-react';
import {
  AlertBanner,
  Button,
  ConfirmModal,
  DataTable,
  DataTableColumn,
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
  ClientDetail,
  ClientGlobalStatus,
  ClientInvoiceSummary,
  PreferredChannel,
} from '../types/clients';

export interface ClientDetailPageProps {
  client: ClientDetail | null;
  loading: boolean;
  error: string | null;
  actionLoading: boolean;
  onBack: () => void;
  onRetry: () => void;
  onEdit: () => void;
  onArchive: () => Promise<void>;
  onRestore: () => Promise<void>;
  onOpenInvoice?: (invoiceId: string) => void;
}

export const CLIENT_STATUS_META: Record<
  ClientGlobalStatus,
  { label: string; tone: SemanticTone }
> = {
  DISPUTE: { label: 'En litige', tone: 'danger' },
  OVERDUE: { label: 'En retard', tone: 'overdue' },
  PROMISE: { label: 'Promesse en cours', tone: 'warning' },
  UP_TO_DATE: { label: 'À jour', tone: 'info' },
  SETTLED: { label: 'Soldé', tone: 'success' },
  ARCHIVED: { label: 'Archivé', tone: 'neutral' },
};

const INVOICE_STATUS_MAP: Record<string, RecouvrixStatusKey> = {
  UPCOMING: 'upcoming',
  OVERDUE: 'overdue',
  PARTIAL: 'partial',
  DISPUTE: 'dispute',
  PROMISE: 'promise',
  PAID: 'paid',
};

const CHANNEL_LABELS: Record<PreferredChannel, string> = {
  EMAIL: 'Courrier électronique (E-mail)',
  WHATSAPP: 'Messagerie WhatsApp',
  PHONE: 'Appel téléphonique',
};

const PROMISE_STATUS_LABELS: Record<string, { label: string; tone: SemanticTone }> = {
  ACTIVE: { label: 'Active', tone: 'warning' },
  KEPT: { label: 'Tenue', tone: 'success' },
  BROKEN: { label: 'Non tenue', tone: 'danger' },
  CANCELLED: { label: 'Annulée', tone: 'neutral' },
};

const REMINDER_STATUS_LABELS: Record<string, { label: string; tone: SemanticTone }> = {
  PREPARED: { label: 'Préparée', tone: 'info' },
  VALIDATED: { label: 'Validée', tone: 'info' },
  SENT: { label: 'Envoyée', tone: 'success' },
  CANCELLED: { label: 'Annulée', tone: 'neutral' },
};

const HISTORY_EVENT_LABELS: Record<string, string> = {
  CLIENT_CREATED: 'Création du dossier',
  CLIENT_UPDATED: 'Informations générales modifiées',
  CLIENT_CONTACT_UPDATED: 'Coordonnées modifiées',
  CLIENT_PREFERENCES_UPDATED: 'Préférences de contact modifiées',
  CLIENT_ARCHIVED: 'Dossier archivé',
  CLIENT_RESTORED: 'Dossier restauré',
  IMPORT_BATCH: 'Importation de créances',
  INVOICE_UPDATED: 'Facture mise à jour',
  INVOICE_ARCHIVED: 'Facture archivée',
  INVOICE_RESTORED: 'Facture restaurée',
  REMINDER_PREPARED: 'Relance préparée',
  REMINDER_VALIDATED: 'Relance validée',
  REMINDER_SENT: 'Relance envoyée',
  CLIENT_REPLY: 'Réponse client reçue',
  PAYMENT_DECLARED: 'Paiement déclaré',
  RECEIPT_RECEIVED: 'Justificatif reçu',
  PAYMENT_CONFIRMED: 'Paiement confirmé',
  PAYMENT_ALLOCATED: 'Paiement affecté',
  DISPUTE_OPENED: 'Litige ouvert',
  DISPUTE_UPDATED: 'Litige mis à jour',
  DISPUTE_RESOLVED: 'Litige clôturé',
  PROMISE_RECORDED: 'Promesse enregistrée',
  PROMISE_UPDATED: 'Promesse évaluée',
  CREDIT_NOTE_CREATED: 'Avoir enregistré',
  CREDIT_NOTE_VALIDATED: 'Avoir validé',
  DOCUMENT_ATTACHED: 'Document joint',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

export const ClientDetailPage: React.FC<ClientDetailPageProps> = ({
  client,
  loading,
  error,
  actionLoading,
  onBack,
  onRetry,
  onEdit,
  onArchive,
  onRestore,
  onOpenInvoice,
}) => {
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);

  if (loading && !client) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={onBack}>
          Retour à la liste des clients
        </Button>
        <div className="bg-white border border-[var(--color-border)] rounded-lg p-8">
          <LoadingState label="Chargement de la fiche client…" />
        </div>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={onBack}>
          Retour à la liste des clients
        </Button>
        <AlertBanner
          tone="error"
          title="Lecture de la fiche impossible"
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

  if (!client) return null;

  const invoices = client.invoices || [];
  const promises = client.promises || [];
  const disputes = client.disputes || [];
  const reminders = client.reminders || [];
  const documents = client.documents || [];
  const history = client.history || [];

  const statusMeta = CLIENT_STATUS_META[client.financial.globalStatus];

  const invoiceColumns: Array<DataTableColumn<ClientInvoiceSummary>> = [
    {
      key: 'reference',
      header: 'Référence',
      render: (inv) => (
        <span className="font-mono text-[13px] font-medium text-[var(--color-ink)]">
          {inv.reference}
        </span>
      ),
    },
    {
      key: 'issueDate',
      header: 'Émission',
      hideOnMobile: true,
      render: (inv) => (
        <span className="tabular-amount text-[13px] text-[var(--color-ink-secondary)]">
          {formatDate(inv.issueDate)}
        </span>
      ),
    },
    {
      key: 'dueDate',
      header: 'Échéance',
      render: (inv) => (
        <div className="space-y-0.5">
          <span className="tabular-amount text-[13px] text-[var(--color-ink)] block">
            {formatDate(inv.dueDate)}
          </span>
          {inv.delayDays > 0 && (
            <span className="text-[11px] font-medium text-[var(--color-overdue)]">
              {formatDelayDays(inv.delayDays)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'totalAmount',
      header: 'Montant facturé',
      align: 'right',
      hideOnMobile: true,
      render: (inv) => formatCurrency(inv.totalAmount),
    },
    {
      key: 'confirmedPaidAmount',
      header: 'Réglé confirmé',
      align: 'right',
      hideOnMobile: true,
      render: (inv) => (
        <span className="text-[var(--color-success)]">
          {formatCurrency(inv.confirmedPaidAmount)}
        </span>
      ),
    },
    {
      key: 'remainingAmount',
      header: 'Solde restant dû',
      align: 'right',
      render: (inv) => (
        <div className="space-y-0.5">
          <span className="font-semibold text-[var(--color-ink)] block">
            {formatCurrency(inv.remainingAmount)}
          </span>
          {inv.pendingVerificationAmount > 0 && (
            <span className="text-[11px] text-[var(--color-warning)] block">
              dont {formatCurrency(inv.pendingVerificationAmount)} à vérifier
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (inv) => (
        <StatusBadge status={INVOICE_STATUS_MAP[inv.status] ?? 'upcoming'} />
      ),
    },
  ];

  const handleConfirmArchive = async () => {
    await onArchive();
    setConfirmArchiveOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Barre supérieure : retour + identité + actions */}
      <div className="flex flex-col gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft className="w-4 h-4" />}
            onClick={onBack}
          >
            Retour à la liste des clients
          </Button>
        </div>

        <div className="bg-white border border-[var(--color-border)] rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-ink-secondary)] shrink-0">
                {client.clientType === 'COMPANY' ? (
                  <Building2 className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <User className="w-4 h-4" aria-hidden="true" />
                )}
              </div>
              <h2 className="text-[20px] font-bold text-[var(--color-ink)] tracking-tight truncate">
                {client.name}
              </h2>
              <StatusBadge tone={statusMeta.tone} label={statusMeta.label} />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--color-ink-muted)] pl-12">
              <span>
                {client.clientType === 'COMPANY' ? 'Entreprise' : 'Particulier'}
              </span>
              {client.taxId && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[12px]">{client.taxId}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>
                Créé le <span className="tabular-amount">{formatDate(client.createdAt)}</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 pl-12 lg:pl-0">
            <Button
              variant="secondary"
              size="sm"
              icon={<Edit3 className="w-4 h-4" />}
              onClick={onEdit}
              disabled={actionLoading}
            >
              Modifier
            </Button>

            {client.isArchived ? (
              <Button
                variant="primary"
                size="sm"
                icon={<ArchiveRestore className="w-4 h-4" />}
                onClick={onRestore}
                loading={actionLoading}
              >
                Restaurer le dossier
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                icon={<Archive className="w-4 h-4" />}
                onClick={() => setConfirmArchiveOpen(true)}
                disabled={actionLoading}
              >
                Archiver
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Bandeau si dossier archivé */}
      {client.isArchived && (
        <AlertBanner
          tone="warning"
          title="Dossier client archivé"
          description={`Ce client a été archivé${
            client.archivedAt ? ` le ${formatDateTime(client.archivedAt)}` : ''
          }${client.archivedBy ? ` par ${client.archivedBy}` : ''}. Toutes les factures, paiements, justificatifs et échanges restent intégralement conservés pour la traçabilité.`}
        />
      )}

      {/* Bandeau alerte restriction de contact */}
      {!client.communicationPreferences.contactAllowed && (
        <AlertBanner
          tone="warning"
          title="Prises de contact suspendues pour ce client"
          description={
            client.communicationPreferences.restrictionsNote ||
            'Les relances directes ont été désactivées dans les préférences de communication.'
          }
        />
      )}

      {/* Section 1 : Situation financière */}
      <section aria-label="Situation financière du client" className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <h3 className="text-[16px] font-semibold text-[var(--color-ink)]">
            Situation financière
          </h3>
          <span className="text-[12px] text-[var(--color-ink-muted)]">
            Soldes calculés automatiquement · Seuls les paiements confirmés sont déduits
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <SummaryCard
            label="Total facturé"
            value={formatCurrency(client.financial.totalBilled)}
            helper={`${client.financial.invoicesCount} facture(s) associée(s)`}
          />
          <SummaryCard
            label="Total réglé confirmé"
            value={formatCurrency(client.financial.totalPaidConfirmed)}
            tone="success"
            helper="Règlements validés"
          />
          <SummaryCard
            label="Solde restant dû"
            value={formatCurrency(client.financial.remainingAmount)}
            tone={client.financial.remainingAmount > 0 ? 'default' : 'success'}
            helper={`${client.financial.openInvoicesCount} facture(s) ouverte(s)`}
          />
          <SummaryCard
            label="Montant en retard"
            value={formatCurrency(client.financial.overdueAmount)}
            tone={client.financial.overdueAmount > 0 ? 'overdue' : 'default'}
            helper={`${client.financial.overdueInvoicesCount} facture(s) échue(s)`}
          />
          <SummaryCard
            label="Paiements à vérifier"
            value={formatCurrency(client.financial.pendingVerificationAmount)}
            tone={client.financial.pendingVerificationAmount > 0 ? 'warning' : 'default'}
            helper={`${client.financial.pendingPaymentsCount} paiement(s) non déduit(s)`}
          />
        </div>
      </section>

      {/* Section 2 : Informations générales, Coordonnées, Préférences de communication */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informations générales */}
        <section className="bg-white border border-[var(--color-border)] rounded-lg p-5 space-y-4">
          <h3 className="text-[15px] font-semibold text-[var(--color-ink)] pb-2.5 border-b border-[var(--color-border)]">
            Informations générales
          </h3>
          <dl className="space-y-3 text-[13px]">
            <div>
              <dt className="text-[var(--color-ink-muted)]">Nom ou raison sociale</dt>
              <dd className="font-medium text-[var(--color-ink)] mt-0.5">{client.name}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Type de client</dt>
              <dd className="text-[var(--color-ink)] mt-0.5">
                {client.clientType === 'COMPANY'
                  ? 'Entreprise / Société'
                  : 'Particulier / Indépendant'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Identifiant fiscal</dt>
              <dd className="font-mono text-[12px] text-[var(--color-ink)] mt-0.5">
                {client.taxId || 'Non renseigné'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Adresse</dt>
              <dd className="text-[var(--color-ink)] mt-0.5">
                {client.address || 'Non renseignée'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Notes internes</dt>
              <dd className="text-[var(--color-ink-secondary)] mt-0.5 leading-relaxed whitespace-pre-line">
                {client.notes || 'Aucune note interne enregistrée.'}
              </dd>
            </div>
          </dl>
        </section>

        {/* Coordonnées */}
        <section className="bg-white border border-[var(--color-border)] rounded-lg p-5 space-y-4">
          <h3 className="text-[15px] font-semibold text-[var(--color-ink)] pb-2.5 border-b border-[var(--color-border)]">
            Coordonnées
          </h3>
          <dl className="space-y-3.5 text-[13px]">
            <div>
              <dt className="text-[var(--color-ink-muted)]">Personne de contact</dt>
              <dd className="font-medium text-[var(--color-ink)] mt-0.5">
                {client.contactName || 'Non renseignée'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)] flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Adresse e-mail</span>
              </dt>
              <dd className="text-[var(--color-ink)] mt-0.5 break-all">
                {client.email || 'Non renseignée'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Téléphone</span>
              </dt>
              <dd className="tabular-amount text-[var(--color-ink)] mt-0.5">
                {client.phone || 'Non renseigné'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Contact secondaire</dt>
              <dd className="text-[var(--color-ink-secondary)] mt-0.5">
                {client.secondaryContact || 'Aucun contact secondaire'}
              </dd>
            </div>
          </dl>
        </section>

        {/* Préférences de communication */}
        <section className="bg-white border border-[var(--color-border)] rounded-lg p-5 space-y-4">
          <h3 className="text-[15px] font-semibold text-[var(--color-ink)] pb-2.5 border-b border-[var(--color-border)]">
            Préférences de communication
          </h3>
          <dl className="space-y-3.5 text-[13px]">
            <div>
              <dt className="text-[var(--color-ink-muted)]">Canal privilégié</dt>
              <dd className="font-medium text-[var(--color-ink)] mt-0.5 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[var(--color-primary)]" aria-hidden="true" />
                <span>{CHANNEL_LABELS[client.communicationPreferences.preferredChannel]}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Statut des relances</dt>
              <dd className="mt-1">
                <StatusBadge
                  tone={client.communicationPreferences.contactAllowed ? 'success' : 'danger'}
                  label={
                    client.communicationPreferences.contactAllowed
                      ? 'Contact autorisé'
                      : 'Contact suspendu'
                  }
                />
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)] flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Horaires de contact souhaités</span>
              </dt>
              <dd className="text-[var(--color-ink)] mt-0.5">
                {client.communicationPreferences.contactHours || 'Aucune plage horaire précisée'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-ink-muted)]">Consignes et restrictions</dt>
              <dd className="text-[var(--color-ink-secondary)] mt-0.5 leading-relaxed">
                {client.communicationPreferences.restrictionsNote || 'Aucune restriction particulière.'}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Section 3 : Suivi — Factures associées */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
          <h3 className="text-[16px] font-semibold text-[var(--color-ink)]">
            Suivi · Factures associées ({invoices.length})
          </h3>
          <span className="text-[12px] text-[var(--color-ink-muted)]">
            Vue consolidée en lecture seule des créances du dossier
          </span>
        </div>

        <DataTable
          columns={invoiceColumns}
          data={invoices}
          rowKey={(inv) => inv.id}
          onRowClick={onOpenInvoice ? (inv) => onOpenInvoice(inv.id) : undefined}
          caption={`Factures associées au dossier ${client.name}`}
          emptyState={{
            title: 'Aucune facture associée',
            description:
              'Les factures rattachées à ce client apparaîtront ici après importation ou affectation.',
          }}
        />
      </section>

      {/* Suivi : Promesses de paiement & Litiges */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
              Promesses de paiement ({promises.length})
            </h3>
          </div>
          {promises.length === 0 ? (
            <div className="p-5 text-[13px] text-[var(--color-ink-muted)]">
              Aucune promesse de paiement enregistrée pour ce client.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {promises.map((promise) => {
                const badge = PROMISE_STATUS_LABELS[promise.status] ?? {
                  label: promise.status,
                  tone: 'neutral' as SemanticTone,
                };
                return (
                  <div key={promise.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12px] font-semibold text-[var(--color-ink)]">
                          {promise.invoiceReference}
                        </span>
                        <StatusBadge tone={badge.tone} label={badge.label} />
                      </div>
                      <p className="text-[13px] text-[var(--color-ink-secondary)]">
                        Échéance annoncée :{' '}
                        <span className="tabular-amount font-medium text-[var(--color-ink)]">
                          {formatDate(promise.promisedDate)}
                        </span>
                      </p>
                      {promise.note && (
                        <p className="text-[12px] text-[var(--color-ink-muted)]">{promise.note}</p>
                      )}
                    </div>
                    <span className="font-display text-[15px] font-bold tabular-amount text-[var(--color-ink)] shrink-0">
                      {formatCurrency(promise.promisedAmount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
              Litiges et contestations ({disputes.length})
            </h3>
          </div>
          {disputes.length === 0 ? (
            <div className="p-5 text-[13px] text-[var(--color-ink-muted)]">
              Aucun litige signalé sur ce dossier client.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {disputes.map((dispute) => (
                <div key={dispute.id} className="p-4 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert
                        className="w-4 h-4 text-[var(--color-danger)] shrink-0"
                        aria-hidden="true"
                      />
                      <span className="font-mono text-[12px] font-semibold text-[var(--color-ink)]">
                        {dispute.invoiceReference}
                      </span>
                    </div>
                    <StatusBadge
                      tone={dispute.status === 'OPEN' ? 'danger' : 'success'}
                      label={dispute.status === 'OPEN' ? 'Litige ouvert' : 'Résolu'}
                    />
                  </div>
                  <p className="text-[13px] text-[var(--color-ink-secondary)]">{dispute.reason}</p>
                  <p className="text-[12px] text-[var(--color-ink-muted)] tabular-amount">
                    Ouvert le {formatDate(dispute.openedAt)}
                    {dispute.resolvedAt ? ` · Résolu le ${formatDate(dispute.resolvedAt)}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Suivi : Dernières relances & Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--color-border)]">
            <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
              Dernières relances ({reminders.length})
            </h3>
          </div>
          {reminders.length === 0 ? (
            <div className="p-5 text-[13px] text-[var(--color-ink-muted)]">
              Aucune relance enregistrée pour ce dossier.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {reminders.map((rem) => {
                const badge = REMINDER_STATUS_LABELS[rem.status] ?? {
                  label: rem.status,
                  tone: 'neutral' as SemanticTone,
                };
                return (
                  <div key={rem.id} className="p-4 flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[12px] font-semibold text-[var(--color-ink)]">
                          {rem.invoiceReference}
                        </span>
                        <span className="text-[12px] text-[var(--color-ink-muted)]">
                          · {rem.channel === 'WHATSAPP' ? 'WhatsApp' : rem.channel === 'PHONE' ? 'Téléphone' : 'E-mail'}
                        </span>
                        <StatusBadge tone={badge.tone} label={badge.label} />
                      </div>
                      <p className="text-[13px] text-[var(--color-ink-secondary)] truncate">
                        {rem.subject || 'Relance de paiement'}
                      </p>
                    </div>
                    <span className="tabular-amount text-[12px] text-[var(--color-ink-muted)] shrink-0">
                      {formatDate(rem.scheduledFor)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[var(--color-border)]">
            <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
              Documents associés ({documents.length})
            </h3>
          </div>
          {documents.length === 0 ? (
            <div className="p-5 text-[13px] text-[var(--color-ink-muted)]">
              Aucun document rattaché à ce client pour le moment.
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
                        {doc.fileName} · {formatFileSize(doc.fileSize)}
                      </p>
                    </div>
                  </div>
                  <span className="tabular-amount text-[12px] text-[var(--color-ink-muted)] shrink-0">
                    {formatDate(doc.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Historique des échanges et modifications */}
      <section className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--color-border)]">
          <h3 className="text-[15px] font-semibold text-[var(--color-ink)]">
            Historique des échanges et modifications
          </h3>
        </div>
        {history.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Aucun événement enregistré"
              description="Les modifications de fiche, relances et opérations sur ce dossier apparaîtront ici."
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
                      {HISTORY_EVENT_LABELS[entry.eventType] ?? entry.eventType}
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

      <ConfirmModal
        open={confirmArchiveOpen}
        tone="destructive"
        title={`Archiver le dossier « ${client.name} » ?`}
        description="Le client n’apparaîtra plus dans la liste active, mais toutes ses factures, paiements, justificatifs, promesses et son historique seront conservés intégralement. Vous pourrez restaurer ce dossier à tout moment."
        confirmLabel="Archiver le client"
        loading={actionLoading}
        onClose={() => setConfirmArchiveOpen(false)}
        onConfirm={handleConfirmArchive}
      />
    </div>
  );
};
