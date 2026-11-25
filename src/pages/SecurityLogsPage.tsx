import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  AlertBanner,
  Button,
  DataTable,
  DataTableColumn,
  StatusBadge,
} from '../components/ui';
import { SemanticTone } from '../design-system/tokens';
import { formatDateTime } from '../design-system/formatters';
import { ApiError, workspaceApi } from '../services/api';
import type { ActivityLogEntry, AuthUser } from '../types/auth';

const EVENT_LABELS: Record<string, { label: string; tone: SemanticTone }> = {
  BOOTSTRAP_SETUP: { label: 'Initialisation', tone: 'info' },
  LOGIN_SUCCESS: { label: 'Connexion réussie', tone: 'success' },
  LOGIN_FAILED: { label: 'Échec de connexion', tone: 'warning' },
  LOGOUT: { label: 'Déconnexion', tone: 'neutral' },
  USER_CREATED: { label: 'Création de compte', tone: 'info' },
  USER_UPDATED: { label: 'Modification de compte', tone: 'info' },
  USER_ROLE_CHANGED: { label: 'Changement de rôle', tone: 'warning' },
  USER_STATUS_CHANGED: { label: 'Statut modifié', tone: 'warning' },
  DEMO_ACCOUNTS_RESET: { label: 'Réinitialisation', tone: 'info' },
  ACCESS_DENIED: { label: 'Accès refusé', tone: 'danger' },
  IMPORT_BATCH: { label: 'Nouvelle importation', tone: 'info' },
  INVOICE_UPDATED: { label: 'Facture mise à jour', tone: 'info' },
  INVOICE_ARCHIVED: { label: 'Facture archivée', tone: 'warning' },
  INVOICE_RESTORED: { label: 'Facture restaurée', tone: 'success' },
  REMINDER_PREPARED: { label: 'Relance préparée', tone: 'info' },
  REMINDER_VALIDATED: { label: 'Relance validée', tone: 'success' },
  REMINDER_SENT: { label: 'Relance envoyée', tone: 'success' },
  CLIENT_REPLY: { label: 'Réponse client reçue', tone: 'info' },
  PAYMENT_DECLARED: { label: 'Paiement déclaré', tone: 'warning' },
  RECEIPT_RECEIVED: { label: 'Justificatif reçu', tone: 'warning' },
  PAYMENT_CONFIRMED: { label: 'Paiement confirmé', tone: 'success' },
  PAYMENT_ALLOCATED: { label: 'Paiement affecté', tone: 'success' },
  DISPUTE_OPENED: { label: 'Dossier mis en litige', tone: 'danger' },
  DISPUTE_UPDATED: { label: 'Litige mis à jour', tone: 'warning' },
  DISPUTE_RESOLVED: { label: 'Litige clôturé', tone: 'success' },
  PROMISE_RECORDED: { label: 'Promesse enregistrée', tone: 'warning' },
  PROMISE_UPDATED: { label: 'Promesse évaluée', tone: 'info' },
  CREDIT_NOTE_CREATED: { label: 'Avoir enregistré', tone: 'info' },
  CREDIT_NOTE_VALIDATED: { label: 'Avoir validé', tone: 'success' },
  DOCUMENT_ATTACHED: { label: 'Document joint', tone: 'info' },
  CLIENT_CREATED: { label: 'Client créé', tone: 'info' },
  CLIENT_UPDATED: { label: 'Fiche client modifiée', tone: 'info' },
  CLIENT_CONTACT_UPDATED: { label: 'Coordonnées client modifiées', tone: 'info' },
  CLIENT_PREFERENCES_UPDATED: { label: 'Préférences client modifiées', tone: 'info' },
  CLIENT_ARCHIVED: { label: 'Client archivé', tone: 'warning' },
  CLIENT_RESTORED: { label: 'Client restauré', tone: 'success' },
  DEMO_DATA_SEEDED: { label: 'Données de démo', tone: 'neutral' },
  DEMO_DATA_CLEARED: { label: 'Base métier vidée', tone: 'neutral' },
};

export interface SecurityLogsPageProps {
  currentUser: AuthUser;
}

export const SecurityLogsPage: React.FC<SecurityLogsPageProps> = ({ currentUser }) => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await workspaceApi.getActivityLogs();
      setLogs(res.logs);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger le journal d’activité.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const columns: Array<DataTableColumn<ActivityLogEntry>> = [
    {
      key: 'createdAt',
      header: 'Date et heure',
      render: (row) => (
        <span className="tabular-amount text-[13px] text-[var(--color-ink-secondary)] whitespace-nowrap">
          {formatDateTime(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'eventType',
      header: 'Événement',
      render: (row) => {
        const meta = EVENT_LABELS[row.eventType] ?? {
          label: row.eventType,
          tone: 'neutral' as SemanticTone,
        };
        return <StatusBadge tone={meta.tone} label={meta.label} />;
      },
    },
    {
      key: 'actor',
      header: 'Utilisateur / Origine',
      render: (row) => (
        <span className="text-[13px] font-medium text-[var(--color-ink)]">
          {row.actorLabel}
        </span>
      ),
    },
    {
      key: 'summary',
      header: 'Détail',
      render: (row) => (
        <span className="text-[13px] text-[var(--color-ink-secondary)]">{row.summary}</span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[14px] text-[var(--color-ink-secondary)]">
          {currentUser.role === 'ADMIN'
            ? 'Journal complet des événements d’authentification, de sécurité et de gestion des comptes.'
            : 'Historique de vos connexions et opérations personnelles.'}
        </p>

        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className="w-4 h-4" />}
          onClick={loadLogs}
          loading={loading}
        >
          Actualiser
        </Button>
      </div>

      {error && (
        <AlertBanner
          tone="error"
          title="Erreur de lecture"
          description={error}
        />
      )}

      <DataTable
        columns={columns}
        data={logs}
        rowKey={(row) => row.id}
        loading={loading}
        caption="Journal d’activité et de sécurité Recouvrix"
        emptyState={{
          title: 'Aucun événement enregistré',
          description: 'Les connexions et modifications de comptes apparaîtront ici.',
        }}
      />
    </div>
  );
};
