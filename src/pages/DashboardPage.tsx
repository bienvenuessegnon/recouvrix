import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Clock3,
  Database,
  FileSpreadsheet,
  HandCoins,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { ReceivablesChart } from '../components/dashboard/ReceivablesChart';
import {
  AlertBanner,
  Button,
  ConfirmModal,
  EmptyState,
  LoadingState,
  RecouvrixStatusKey,
  StatusBadge,
  SummaryCard,
  Tabs,
  useToast,
} from '../components/ui';
import { NavigationSectionId } from '../design-system/tokens';
import { formatCurrency, formatDateTime, formatDelayDays } from '../design-system/formatters';
import { ApiError, dashboardApi, demoApi } from '../services/api';
import type { AuthUser } from '../types/auth';
import type { DashboardResponse, DerivedInvoiceStatus } from '../types/dashboard';

export interface DashboardPageProps {
  user: AuthUser;
  onNavigate: (section: NavigationSectionId, filter?: string) => void;
  onSyncNotifications?: (
    items: Array<{ id: string; title: string; detail: string; targetSection?: NavigationSectionId; targetFilter?: string }>
  ) => void;
}

const STATUS_BADGE_MAP: Record<DerivedInvoiceStatus, RecouvrixStatusKey> = {
  UPCOMING: 'upcoming',
  OVERDUE: 'overdue',
  PARTIAL: 'partial',
  DISPUTE: 'dispute',
  PROMISE: 'promise',
  PAID: 'paid',
};

const ACTIVITY_LABELS: Record<string, string> = {
  IMPORT_BATCH: 'Nouvelle importation',
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
  DISPUTE_OPENED: 'Dossier mis en litige',
  DISPUTE_UPDATED: 'Litige mis à jour',
  DISPUTE_RESOLVED: 'Litige clôturé',
  PROMISE_RECORDED: 'Promesse enregistrée',
  PROMISE_UPDATED: 'Promesse évaluée',
  CREDIT_NOTE_CREATED: 'Avoir enregistré',
  CREDIT_NOTE_VALIDATED: 'Avoir validé',
  DOCUMENT_ATTACHED: 'Document joint',
  CLIENT_CREATED: 'Client créé',
  CLIENT_UPDATED: 'Fiche client modifiée',
  CLIENT_CONTACT_UPDATED: 'Coordonnées client modifiées',
  CLIENT_PREFERENCES_UPDATED: 'Préférences client modifiées',
  CLIENT_ARCHIVED: 'Client archivé',
  CLIENT_RESTORED: 'Client restauré',
  DEMO_DATA_SEEDED: 'Données de présentation',
  DEMO_DATA_CLEARED: 'Base métier vidée',
  LOGIN_SUCCESS: 'Connexion réussie',
  LOGIN_FAILED: 'Échec de connexion',
  LOGOUT: 'Déconnexion',
  USER_CREATED: 'Création de compte',
  USER_ROLE_CHANGED: 'Changement de rôle',
  USER_STATUS_CHANGED: 'Statut de compte modifié',
};

export const DashboardPage: React.FC<DashboardPageProps> = ({
  user,
  onNavigate,
  onSyncNotifications,
}) => {
  const { notify } = useToast();
  const [period, setPeriod] = useState<30 | 90 | 365>(30);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingAi, setRefreshingAi] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [demoActionLoading, setDemoActionLoading] = useState(false);

  const loadDashboard = useCallback(
    async (selectedPeriod: 30 | 90 | 365) => {
      setLoading(true);
      setError(null);
      try {
        const res = await dashboardApi.getDashboard(selectedPeriod);
        setData(res);
        if (onSyncNotifications) {
          const alerts = res.metrics.priorities.slice(0, 4).map((p) => ({
            id: p.id,
            title: `${p.clientName} · ${p.invoiceReference}`,
            detail: p.reason,
            targetSection: p.targetSection,
            targetFilter: p.targetFilter,
          }));
          onSyncNotifications(alerts);
        }
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de charger les indicateurs du tableau de bord.'
        );
      } finally {
        setLoading(false);
      }
    },
    [onSyncNotifications]
  );

  useEffect(() => {
    void loadDashboard(period);
  }, [loadDashboard, period]);

  const handleRefreshAi = async () => {
    setRefreshingAi(true);
    try {
      const res = await dashboardApi.refreshAi();
      setData((prev) => (prev ? { ...prev, aiAdvisory: res.aiAdvisory } : prev));
      if (res.aiAdvisory.status === 'available') {
        await loadDashboard(period);
        notify({
          tone: 'success',
          title: 'Analyse IA actualisée',
          description: 'Les recommandations ont été régénérées à partir des dossiers actuels.',
        });
      } else {
        notify({
          tone: 'warning',
          title: 'Analyse IA indisponible',
          description:
            res.aiAdvisory.message ||
            'Le service d’analyse IA ne répond pas pour le moment.',
        });
      }
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Erreur lors de l’actualisation',
        description:
          err instanceof ApiError
            ? err.message
            : 'Impossible de joindre le service d’analyse.',
      });
    } finally {
      setRefreshingAi(false);
    }
  };

  const handleSeedDemo = async () => {
    setDemoActionLoading(true);
    try {
      const res = await demoApi.seed();
      notify({
        tone: 'success',
        title: 'Données de présentation chargées',
        description: res.message,
      });
      await loadDashboard(period);
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Opération impossible',
        description:
          err instanceof ApiError
            ? err.message
            : 'Impossible d’initialiser les données de présentation.',
      });
    } finally {
      setDemoActionLoading(false);
    }
  };

  const handleClearDemo = async () => {
    setDemoActionLoading(true);
    try {
      const res = await demoApi.clear();
      setConfirmClearOpen(false);
      notify({
        tone: 'info',
        title: 'Données métier vidées',
        description: res.message,
      });
      await loadDashboard(period);
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Opération impossible',
        description:
          err instanceof ApiError
            ? err.message
            : 'Impossible de vider les données métier.',
      });
    } finally {
      setDemoActionLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="bg-white border border-[var(--color-border)] rounded-lg p-8">
        <LoadingState label="Calcul des indicateurs de recouvrement…" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <AlertBanner
        tone="error"
        title="Chargement du tableau de bord impossible"
        description={error}
        action={
          <Button variant="secondary" size="sm" onClick={() => loadDashboard(period)}>
            Réessayer
          </Button>
        }
      />
    );
  }

  if (!data) return null;

  const { metrics, aiAdvisory, recentActivity, adminSupervision } = data;
  const { kpis, counts } = metrics;

  return (
    <div className="space-y-6">
      {/* Supervision Administrateur : vue organisationnelle sans palmarès individuel trompeur */}
      {user.role === 'ADMIN' && adminSupervision && (
        <section className="bg-white border border-[var(--color-border)] rounded-lg p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--color-border)]">
            <div className="space-y-0.5">
              <h2 className="text-[16px] font-semibold text-[var(--color-ink)]">
                Supervision de l’organisation
              </h2>
              <p className="text-[13px] text-[var(--color-ink-muted)]">
                État général des accès, volume des opérations tracées et disponibilité des services.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={<UserCheck className="w-4 h-4" />}
                onClick={() => onNavigate('users')}
              >
                Gérer les utilisateurs
              </Button>
              {metrics.isEmpty && (
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Database className="w-4 h-4" />}
                  loading={demoActionLoading}
                  onClick={handleSeedDemo}
                >
                  Charger les données de démonstration
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[14px]">
            <div className="p-3.5 rounded-md bg-[var(--color-canvas)] border border-[var(--color-border)] space-y-1">
              <span className="text-[12px] text-[var(--color-ink-muted)]">
                Comptes actifs
              </span>
              <p className="font-display text-[20px] font-bold tabular-amount">
                {adminSupervision.activeUsers} / {adminSupervision.totalUsers}
              </p>
              <span className="text-[12px] text-[var(--color-ink-secondary)]">
                Dont {adminSupervision.managerCount} gestionnaire(s)
              </span>
            </div>

            <div className="p-3.5 rounded-md bg-[var(--color-canvas)] border border-[var(--color-border)] space-y-1">
              <span className="text-[12px] text-[var(--color-ink-muted)]">
                Volume d’opérations tracées
              </span>
              <p className="font-display text-[20px] font-bold tabular-amount">
                {adminSupervision.totalOperationsLogged}
              </p>
              <span className="text-[12px] text-[var(--color-ink-secondary)]">
                Événements sécurité et recouvrement
              </span>
            </div>

            <div className="p-3.5 rounded-md bg-[var(--color-canvas)] border border-[var(--color-border)] space-y-1">
              <span className="text-[12px] text-[var(--color-ink-muted)]">
                Dossiers ouverts / Litiges
              </span>
              <p className="font-display text-[20px] font-bold tabular-amount">
                {counts.openInvoicesCount} / {counts.disputesCount}
              </p>
              <span className="text-[12px] text-[var(--color-ink-secondary)]">
                {counts.preparedRemindersCount} relance(s) à valider
              </span>
            </div>

            <div className="p-3.5 rounded-md bg-[var(--color-canvas)] border border-[var(--color-border)] space-y-1">
              <span className="text-[12px] text-[var(--color-ink-muted)]">
                État du système et de l’IA
              </span>
              <div className="pt-1 flex flex-wrap gap-1.5">
                <StatusBadge tone="success" label="Base active" />
                <StatusBadge
                  tone={adminSupervision.aiAvailable ? 'info' : 'warning'}
                  label={adminSupervision.aiAvailable ? 'IA active' : 'IA indisponible'}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* État particulier : base métier vide */}
      {metrics.isEmpty ? (
        <EmptyState
          icon={<FileSpreadsheet className="w-5 h-5" aria-hidden="true" />}
          title="Aucune créance enregistrée pour le moment"
          description="Importez vos clients et factures existantes pour calculer les soldes, suivre les retards et identifier les dossiers prioritaires."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                variant="primary"
                onClick={() => onNavigate('imports')}
              >
                Importer des factures
              </Button>
              {user.role === 'ADMIN' && (
                <Button
                  variant="secondary"
                  loading={demoActionLoading}
                  onClick={handleSeedDemo}
                >
                  Charger les données de démonstration
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <>
          {/* Actions prioritaires du jour — premier bloc opérationnel */}
          <section aria-label="Actions prioritaires du jour" className="space-y-3">
            <div>
              <h2 className="text-[18px] font-semibold text-[var(--color-ink)]">
                Actions prioritaires du jour
              </h2>
              <p className="text-[13px] text-[var(--color-ink-muted)] mt-0.5">
                Ce qu’il faut traiter maintenant — un clic ouvre la file filtrée.
              </p>
            </div>
            {(() => {
              const brokenPromises = metrics.priorities.filter(
                (p) =>
                  p.kind === 'PROMISE_DUE' &&
                  (p.reason.toLowerCase().includes('dépass') ||
                    p.reason.toLowerCase().includes('échue') ||
                    p.urgencyRank <= 3)
              );
              const staleOverdue = metrics.priorities.filter(
                (p) =>
                  (p.kind === 'OVERDUE_CRITICAL' || p.kind === 'HIGH_AMOUNT_OVERDUE') &&
                  p.delayDays > 30
              );
              const pendingCount = counts.pendingPaymentsCount;
              const cards = [
                {
                  key: 'promises',
                  count: brokenPromises.length || metrics.priorities.filter((p) => p.kind === 'PROMISE_DUE').length,
                  title:
                    (brokenPromises.length ||
                      metrics.priorities.filter((p) => p.kind === 'PROMISE_DUE').length) === 1
                      ? '1 promesse non tenue'
                      : `${
                          brokenPromises.length ||
                          metrics.priorities.filter((p) => p.kind === 'PROMISE_DUE').length
                        } promesses non tenues`,
                  detail: 'Clients ayant promis un règlement dont le solde reste ouvert.',
                  tone: 'danger' as const,
                  Icon: HandCoins,
                  section: 'invoices' as const,
                  filter: 'promise',
                },
                {
                  key: 'stale',
                  count: staleOverdue.length || counts.overdueInvoicesCount,
                  title: `${staleOverdue.length || counts.overdueInvoicesCount} facture${
                    (staleOverdue.length || counts.overdueInvoicesCount) > 1 ? 's' : ''
                  } avec retard > 30 jours sans relance cette semaine`,
                  detail: 'Créances anciennes à relancer en priorité.',
                  tone: 'overdue' as const,
                  Icon: Clock3,
                  section: 'reminders' as const,
                  filter: 'priority',
                },
                {
                  key: 'pending',
                  count: pendingCount,
                  title: `${pendingCount} paiement${pendingCount > 1 ? 's' : ''} déclaré${
                    pendingCount > 1 ? 's' : ''
                  } en attente de rapprochement bancaire`,
                  detail: 'Versements annoncés à confirmer avant écriture au grand livre.',
                  tone: 'warning' as const,
                  Icon: Banknote,
                  section: 'payments' as const,
                  filter: 'en-attente',
                },
              ];
              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {cards.map((card) => (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => onNavigate(card.section, card.filter)}
                      className={`text-left rounded-lg border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
                        card.tone === 'danger'
                          ? 'bg-[var(--color-danger-soft)] border-red-200'
                          : card.tone === 'overdue'
                            ? 'bg-[var(--color-overdue-soft)] border-orange-200'
                            : 'bg-[var(--color-warning-soft)] border-amber-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="rounded-md bg-white/80 p-2 text-[var(--color-ink-secondary)]">
                          <card.Icon className="w-4 h-4" aria-hidden="true" />
                        </span>
                        <span className="font-display text-[22px] font-bold tabular-amount text-[var(--color-ink)]">
                          {card.count}
                        </span>
                      </div>
                      <p className="mt-3 text-[14px] font-semibold leading-snug text-[var(--color-ink)]">
                        {card.title}
                      </p>
                      <p className="mt-1 text-[12px] text-[var(--color-ink-secondary)] leading-relaxed">
                        {card.detail}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-primary)]">
                        Traiter <ArrowRight className="w-3 h-3" aria-hidden="true" />
                      </span>
                    </button>
                  ))}
                </div>
              );
            })()}
          </section>

          {/* 3. Indicateurs financiers principaux (cliquables vers les listes détaillées) */}
          <section aria-label="Indicateurs financiers principaux" className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              <button
                type="button"
                onClick={() => onNavigate('invoices', 'ouvertes')}
                className="text-left rounded-lg transition-colors hover:border-[var(--color-primary)] focus-visible:outline-2"
              >
                <SummaryCard
                  label="Total des créances ouvertes"
                  value={formatCurrency(kpis.totalOpenReceivables)}
                  helper={`${counts.openInvoicesCount} facture(s) non soldée(s) · Voir`}
                  className="h-full hover:border-slate-400 transition-colors"
                />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('invoices', 'en-retard')}
                className="text-left rounded-lg"
              >
                <SummaryCard
                  label="Créances en retard"
                  value={formatCurrency(kpis.overdueReceivables)}
                  tone={kpis.overdueReceivables > 0 ? 'overdue' : 'default'}
                  helper={`${counts.overdueInvoicesCount} facture(s) échue(s) · Voir`}
                  className="h-full hover:border-slate-400 transition-colors"
                />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('invoices', 'non-echues')}
                className="text-left rounded-lg"
              >
                <SummaryCard
                  label="Créances non échues"
                  value={formatCurrency(kpis.notYetDueReceivables)}
                  helper="Échéance non encore dépassée · Voir"
                  className="h-full hover:border-slate-400 transition-colors"
                />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('payments', 'en-attente')}
                className="text-left rounded-lg"
              >
                <SummaryCard
                  label="Paiements en attente"
                  value={formatCurrency(kpis.pendingVerificationAmount)}
                  tone={kpis.pendingVerificationAmount > 0 ? 'warning' : 'default'}
                  helper={`${counts.pendingPaymentsCount} à vérifier (non déduits) · Voir`}
                  className="h-full hover:border-slate-400 transition-colors"
                />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('invoices', 'soldees')}
                className="text-left rounded-lg"
              >
                <SummaryCard
                  label="Taux de recouvrement"
                  value={
                    kpis.recoveryRatePercent !== null
                      ? `${kpis.recoveryRatePercent.toFixed(1).replace('.', ',')} %`
                      : 'Non calculable'
                  }
                  tone="success"
                  helper={`${formatCurrency(kpis.confirmedRecoveredTotal)} confirmés / ${formatCurrency(kpis.totalBilledPortfolio)}`}
                  className="h-full hover:border-slate-400 transition-colors"
                />
              </button>
            </div>
            <p className="text-[12px] text-[var(--color-ink-muted)]">
              Règle appliquée : les paiements déclarés ou en attente de vérification ne réduisent jamais les créances ouvertes tant qu’ils ne sont pas confirmés.
            </p>
          </section>

          {/* 4. Section « Priorités du jour » */}
          <section className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="text-[18px] font-semibold text-[var(--color-ink)]">
                  Priorités du jour
                </h2>
                <p className="text-[13px] text-[var(--color-ink-muted)]">
                  Dossiers nécessitant une intervention rapide, une vérification de paiement ou une validation de relance.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                loading={refreshingAi}
                onClick={handleRefreshAi}
              >
                Actualiser l’analyse IA
              </Button>
            </div>

            {/* Statut explicite du moteur IA */}
            <div className="px-5 pt-4">
              {aiAdvisory.status === 'available' ? (
                <div className="bg-[var(--color-primary-soft)] border border-blue-200 rounded-md p-3.5 flex items-start gap-3">
                  <Sparkles
                    className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div className="space-y-1 text-[13px]">
                    <p className="font-semibold text-[var(--color-ink)]">
                      Synthèse d’assistance IA (décision finale conservée par le gestionnaire)
                    </p>
                    <p className="text-[var(--color-ink-secondary)] leading-relaxed">
                      {aiAdvisory.executiveSummary}
                    </p>
                  </div>
                </div>
              ) : aiAdvisory.status === 'unavailable' ? (
                <AlertBanner
                  tone="warning"
                  title="Assistance IA temporairement indisponible"
                  description={aiAdvisory.message}
                />
              ) : null}
            </div>

            <div className="p-5">
              {metrics.priorities.length === 0 ? (
                <EmptyState
                  icon={<ShieldCheck className="w-5 h-5" aria-hidden="true" />}
                  title="Aucune action urgente détectée"
                  description="Aucun retard critique, paiement à vérifier, promesse à échéance ou litige ouvert ne demande d’intervention immédiate."
                />
              ) : (
                <div className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-md">
                  {metrics.priorities.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-semibold text-[15px] text-[var(--color-ink)]">
                            {item.clientName}
                          </span>
                          <span className="font-mono text-[12px] text-[var(--color-ink-muted)]">
                            {item.invoiceReference}
                          </span>
                          {item.delayDays > 0 && (
                            <span className="text-[12px] font-medium text-[var(--color-overdue)]">
                              · {formatDelayDays(item.delayDays)}
                            </span>
                          )}
                          {item.isAiGenerated && (
                            <StatusBadge tone="info" label="Recommandation IA" />
                          )}
                        </div>

                        <p className="text-[13px] text-[var(--color-ink-secondary)] leading-relaxed">
                          {item.isAiGenerated && item.aiJustification
                            ? item.aiJustification
                            : item.reason}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-4 shrink-0">
                        <div className="sm:text-right">
                          <p className="text-[11px] text-[var(--color-ink-muted)]">
                            {item.pendingAmount ? 'Montant à vérifier' : 'Solde restant dû'}
                          </p>
                          <p className="font-display text-[16px] font-bold tabular-amount text-[var(--color-ink)]">
                            {formatCurrency(item.pendingAmount ?? item.remainingAmount)}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<ArrowRight className="w-3.5 h-3.5" />}
                          onClick={() =>
                            onNavigate(item.targetSection, item.targetFilter)
                          }
                        >
                          {item.recommendedAction}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 5. Évolution des créances + 6. Répartition des factures */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 bg-white border border-[var(--color-border)] rounded-lg p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h2 className="text-[17px] font-semibold text-[var(--color-ink)]">
                    Évolution des créances
                  </h2>
                  <p className="text-[13px] text-[var(--color-ink-muted)]">
                    Historique réel basé sur les dates d’émission, d’échéance et de confirmation.
                  </p>
                </div>

                <Tabs
                  variant="segmented"
                  activeId={String(period)}
                  onChange={(id) => setPeriod(Number(id) as 30 | 90 | 365)}
                  items={[
                    { id: '30', label: '30 jours' },
                    { id: '90', label: 'Trimestre' },
                    { id: '365', label: 'Année' },
                  ]}
                />
              </div>

              <ReceivablesChart data={metrics.evolution} />
            </section>

            <section className="lg:col-span-5 bg-white border border-[var(--color-border)] rounded-lg p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="space-y-0.5">
                  <h2 className="text-[17px] font-semibold text-[var(--color-ink)]">
                    Répartition des factures
                  </h2>
                  <p className="text-[13px] text-[var(--color-ink-muted)]">
                    Ventilation par statut. Les factures soldées ne font plus partie des créances ouvertes.
                  </p>
                </div>

                <div className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-md">
                  {metrics.statusBreakdown.map((item) => (
                    <button
                      key={item.status}
                      type="button"
                      onClick={() =>
                        onNavigate('invoices', item.status.toLowerCase())
                      }
                      className="w-full px-3.5 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <StatusBadge status={STATUS_BADGE_MAP[item.status]} />
                        <span className="tabular-amount text-[12px] text-[var(--color-ink-muted)]">
                          ({item.count})
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[14px] font-semibold tabular-amount text-[var(--color-ink)]">
                          {formatCurrency(item.amount)}
                        </p>
                        {item.excludedFromOpen && (
                          <p className="text-[11px] text-[var(--color-ink-muted)]">
                            Hors créances ouvertes
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {counts.disputesCount > 0 && (
                <div className="flex items-start gap-2.5 text-[12px] text-[var(--color-ink-secondary)] pt-1">
                  <AlertTriangle
                    className="w-4 h-4 text-[var(--color-danger)] shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>
                    {counts.disputesCount} facture(s) en litige restent incluses dans les créances ouvertes jusqu’à résolution, avec relances suspendues.
                  </span>
                </div>
              )}
            </section>
          </div>

          {/* 7. Activité récente centralisée */}
          <section className="bg-white border border-[var(--color-border)] rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="text-[17px] font-semibold text-[var(--color-ink)]">
                  Activité récente
                </h2>
                <p className="text-[13px] text-[var(--color-ink-muted)]">
                  Derniers événements enregistrés dans le journal centralisé.
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                icon={<ArrowRight className="w-4 h-4" />}
                onClick={() => onNavigate('history')}
              >
                Tout l’historique
              </Button>
            </div>

            {recentActivity.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="Aucune activité récente"
                  description="Les importations, relances, réponses et validations de paiements apparaîtront ici."
                />
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {recentActivity.map((event) => (
                  <div
                    key={event.id}
                    className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[13px]">
                        <span className="font-semibold text-[var(--color-ink)]">
                          {ACTIVITY_LABELS[event.eventType] ?? event.eventType}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-[var(--color-ink-muted)]">
                          {event.actorLabel}
                        </span>
                      </div>
                      <p className="text-[13px] text-[var(--color-ink-secondary)]">
                        {event.summary}
                      </p>
                    </div>
                    <span className="tabular-amount text-[12px] text-[var(--color-ink-muted)] whitespace-nowrap shrink-0">
                      {formatDateTime(event.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Confirmation pour vider la base métier (test état vide Admin) */}
      <ConfirmModal
        open={confirmClearOpen}
        tone="destructive"
        title="Vider les données métier de démonstration ?"
        description="Les clients, factures, paiements, promesses et relances de démonstration seront supprimés pour vérifier l’affichage à vide. Les comptes utilisateurs seront conservés."
        confirmLabel="Vider les données"
        loading={demoActionLoading}
        onClose={() => setConfirmClearOpen(false)}
        onConfirm={handleClearDemo}
      />
    </div>
  );
};
